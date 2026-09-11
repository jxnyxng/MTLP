import Sortable from "sortablejs";

export function createTaskDragController({
  state,
  addTask,
  moveTask,
  setStatus,
  loadAndRender,
}) {
  let dragSourceList = null;
  let pendingDropList = null;
  let dragPointerListener = null;

  const DROP_PROXIMITY = 18;
  const POSITION_STEP = 1000;

  function dropTargetFor(list) {
    return {
      periodType: list.dataset.periodType,
      targetDate: list.dataset.targetDate,
      timeBlock: list.dataset.timeBlock ?? null,
      splitLane: list.dataset.splitLane ?? null,
    };
  }

  function calculateAppendPosition(list) {
    const positions = Array.from(list.children)
      .filter((child) => child.classList.contains("task-item"))
      .map((child) => Number(child.dataset.position) || 0);
    if (!positions.length) return POSITION_STEP;
    return Math.max(...positions) + POSITION_STEP;
  }

  function taskItemsFor(list) {
    return Array.from(list?.children ?? []).filter((child) =>
      child.classList.contains("task-item"),
    );
  }

  async function saveListOrder(list) {
    if (!list?.classList.contains("task-list")) return;

    const target = dropTargetFor(list);
    const updates = taskItemsFor(list).map((item, index) =>
      moveTask(
        Number(item.dataset.id),
        target.periodType,
        target.targetDate,
        (index + 1) * POSITION_STEP,
        target.timeBlock,
        target.splitLane,
      ),
    );

    await Promise.all(updates);
  }

  function clearDropTargets({ resetDrag = false } = {}) {
    document.querySelectorAll(".drop-target, .drop-list-target, .reorder-list-target").forEach((element) => {
      element.classList.remove("drop-target", "drop-list-target", "reorder-list-target");
    });
    if (resetDrag) {
      document.body.classList.remove("is-dragging-task");
      dragSourceList = null;
      pendingDropList = null;
      if (dragPointerListener) {
        document.removeEventListener("pointermove", dragPointerListener);
        dragPointerListener = null;
      }
    }
  }

  function markDropTarget(list) {
    clearDropTargets();
    if (list?.classList.contains("task-list")) {
      list.classList.add(list === dragSourceList ? "reorder-list-target" : "drop-list-target");
    }
    const target =
      list?.closest(
        ".hour-row, .year-card, .month-card, .day-card, .week-day-card, .period-staging-card",
      ) ?? list;
    if (target) target.classList.add("drop-target");
  }

  function taskListNearPointer(clientX, clientY) {
    if (typeof clientX !== "number" || typeof clientY !== "number") return null;

    const directTarget = document.elementFromPoint(clientX, clientY);
    const directList = directTarget?.closest(".task-list");
    if (directList) return directList;

    const directContainer = directTarget?.closest(
      ".hour-row, .year-card, .month-card, .day-card, .week-day-card, .period-staging-card",
    );
    const containerList = directContainer?.querySelector(".task-list");
    if (containerList) return containerList;

    let nearest = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    document.querySelectorAll(".task-list").forEach((list) => {
      const rect = list.getBoundingClientRect();
      const outsideX =
        clientX < rect.left
          ? rect.left - clientX
          : clientX > rect.right
            ? clientX - rect.right
            : 0;
      const outsideY =
        clientY < rect.top
          ? rect.top - clientY
          : clientY > rect.bottom
            ? clientY - rect.bottom
            : 0;
      const distance = Math.hypot(outsideX, outsideY);
      if (distance <= DROP_PROXIMITY && distance < nearestDistance) {
        nearest = list;
        nearestDistance = distance;
      }
    });

    return nearest;
  }

  function updatePendingDropFromPointer(pointerEvent) {
    const list = taskListNearPointer(pointerEvent?.clientX, pointerEvent?.clientY);
    if (!list) return;

    markDropTarget(list);
    pendingDropList = list === dragSourceList ? null : list;
  }

  function insertionDirection(event) {
    if (event.related?.classList.contains("add-task-row")) return -1;
    if (!event.related?.classList.contains("task-item")) return true;

    const pointerY = event.originalEvent?.clientY;
    if (typeof pointerY !== "number") return true;

    const rect = event.related.getBoundingClientRect();
    return pointerY < rect.top + rect.height / 2 ? -1 : 1;
  }

  async function saveDroppedTask(event, { appendOnly = false } = {}) {
    if (!state.dbReady) return;

    const fromType = event.from.dataset.periodType;
    const target = dropTargetFor(event.to);

    try {
      if (event.pullMode === "clone" || (fromType === "WEEKLY" && target.periodType === "DAILY")) {
        await addTask(
          event.item.dataset.content,
          "DAILY",
          target.targetDate,
          calculateAppendPosition(event.to),
          target.timeBlock,
          target.splitLane,
        );
        setStatus("Daily로 복사 완료");
      } else if (appendOnly) {
        await moveTask(
          Number(event.item.dataset.id),
          target.periodType,
          target.targetDate,
          calculateAppendPosition(event.to),
          target.timeBlock,
          target.splitLane,
        );
        setStatus("이동 저장 완료");
      } else {
        await saveListOrder(event.to);
        setStatus("이동 저장 완료");
      }
      await loadAndRender();
    } catch (error) {
      console.error(error);
      setStatus("드래그 저장 실패");
      await loadAndRender();
    }
  }

  function didDropInOriginalPlace(event) {
    return event.from === event.to && event.oldDraggableIndex === event.newDraggableIndex;
  }

  function bindSortables() {
    if (state.isLocked) return;

    document.querySelectorAll(".task-list").forEach((list) => {
      Sortable.create(list, {
        group: {
          name: "shared-tasks",
          pull(to, from) {
            const fromType = from.el.dataset.periodType;
            const toType = to.el.dataset.periodType;
            return fromType === "WEEKLY" && toType === "DAILY" ? "clone" : true;
          },
          put: true,
        },
        animation: 120,
        forceFallback: true,
        fallbackOnBody: true,
        fallbackClass: "task-dragging",
        emptyInsertThreshold: 32,
        fallbackTolerance: 3,
        ghostClass: "task-ghost",
        chosenClass: "task-chosen",
        filter: ".entry-row, .entry-row *, .task-edit-input, .delete-button, .add-task-button",
        draggable: ".task-item",
        handle: ".drag-handle",
        onStart(event) {
          dragSourceList = event.from;
          const rect = event.item.getBoundingClientRect();
          event.item.style.setProperty("--drag-width", `${rect.width}px`);
          event.item.style.setProperty("--drag-height", `${rect.height}px`);
          document.body.classList.add("is-dragging-task");
          dragPointerListener = updatePendingDropFromPointer;
          document.addEventListener("pointermove", dragPointerListener);
          setStatus("드롭할 칸을 선택하세요");
        },
        onMove(event) {
          const pointerTarget = taskListNearPointer(
            event.originalEvent?.clientX,
            event.originalEvent?.clientY,
          );
          const targetList = pointerTarget ?? event.to;
          markDropTarget(targetList);
          if (event.to !== dragSourceList) {
            pendingDropList = targetList;
            return insertionDirection(event);
          }

          pendingDropList = null;
          return insertionDirection(event);
        },
        async onEnd(event) {
          event.item.style.removeProperty("--drag-width");
          event.item.style.removeProperty("--drag-height");
          const fallbackTargetList = pendingDropList;
          clearDropTargets({ resetDrag: true });

          if (event.from !== event.to) {
            await saveDroppedTask(event);
            return;
          }

          if (fallbackTargetList && fallbackTargetList !== event.from) {
            await saveDroppedTask(
              {
                item: event.item,
                from: event.from,
                to: fallbackTargetList,
                pullMode: event.pullMode,
              },
              { appendOnly: true },
            );
            return;
          }

          if (didDropInOriginalPlace(event)) {
            setStatus("이동 취소");
            return;
          }

          await saveDroppedTask(event);
        },
      });
    });
  }

  return {
    bindSortables,
  };
}
