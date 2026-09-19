import { calculateAppendPosition, getNextPosition } from "../task-layout.js";
import { refreshAfterTaskSave } from "./task-mutation-service.js";

export function createTaskCommandService({
  state,
  addTask,
  updateTaskBlock,
  targetFor,
  setStatus,
  loadAndRender,
}) {
  function taskBlockFromItem(item) {
    if (!item?.classList.contains("task-item")) return null;
    return {
      id: Number(item.dataset.id),
      content: item.dataset.content ?? "",
      status: item.dataset.status ?? "TODO",
    };
  }

  function selectTaskBlock(item) {
    const task = taskBlockFromItem(item);
    if (!task) return;
    state.selectedTaskId = task.id;
    document.querySelectorAll(".task-item.is-block-selected").forEach((element) => {
      element.classList.toggle("is-block-selected", Number(element.dataset.id) === task.id);
    });
    item.classList.add("is-block-selected");
    setStatus("블록 선택됨");
  }

  function selectedTaskItem() {
    if (!state.selectedTaskId) return null;
    return document.querySelector(`.task-item[data-id="${state.selectedTaskId}"]`);
  }

  function tasksFor(periodType, timeBlock = null, targetDate = targetFor(periodType)) {
    const source = periodType === "MONTHLY"
      ? [...state.tasks.MONTHLY, ...state.yearlyMonthTasks]
      : periodType === "DAILY"
        ? [...state.tasks.DAILY, ...state.monthDailyTasks, ...state.weekDailyTasks]
        : periodType === "FUTURE"
          ? state.futureYearTasks
          : state.tasks[periodType];
    const seen = new Set();
    return source.filter((task) => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      const timeMatches = timeBlock ? task.time_block === timeBlock : !task.time_block;
      return task.target_date === targetDate && timeMatches;
    });
  }

  async function createTaskFromTrigger(trigger, content, periodType, timeBlock, targetDate) {
    const sourceList = trigger.closest(".task-list");
    return addTask(
      content,
      periodType,
      targetDate,
      sourceList ? calculateAppendPosition(sourceList) : getNextPosition(tasksFor(periodType, timeBlock, targetDate)),
      timeBlock,
      sourceList?.dataset.splitLane ?? null,
    );
  }

  async function addTaskFromInput(input, periodType, timeBlock = null, targetDate = targetFor(periodType)) {
    const content = input.value.trim();
    if (!content) return;
    if (!state.dbReady) {
      setStatus("SQLite가 준비되지 않아 저장할 수 없습니다.");
      return;
    }
    try {
      await createTaskFromTrigger(input, content, periodType, timeBlock, targetDate);
      input.value = "";
      setStatus("저장 완료");
      await refreshAfterTaskSave({ loadAndRender, setStatus });
    } catch (error) {
      console.error(error);
      setStatus("저장 실패");
    }
  }

  async function addBlankTask(trigger, periodType, timeBlock = null, targetDate = targetFor(periodType)) {
    if (!state.dbReady) {
      setStatus("SQLite가 준비되지 않아 저장할 수 없습니다.");
      return;
    }
    try {
      const id = await createTaskFromTrigger(trigger, "", periodType, timeBlock, targetDate);
      state.selectedTaskId = null;
      state.pendingEditTaskId = id;
      setStatus("빈 블록 생성 완료");
      await refreshAfterTaskSave({ loadAndRender, setStatus });
    } catch (error) {
      console.error(error);
      setStatus("빈 블록 생성 실패");
    }
  }

  async function copySelectedTaskBlock() {
    const task = taskBlockFromItem(selectedTaskItem());
    if (!task) {
      setStatus("선택된 블록이 없습니다.");
      return;
    }
    state.copiedTaskBlock = { content: task.content, status: task.status };
    setStatus("블록 복사 완료");
  }

  async function pasteSelectedTaskBlock() {
    const target = taskBlockFromItem(selectedTaskItem());
    if (!target) return setStatus("대체할 블록을 선택하세요.");
    if (!state.copiedTaskBlock) return setStatus("복사된 블록이 없습니다.");
    if (!state.dbReady) return setStatus("SQLite가 준비되지 않아 저장할 수 없습니다.");
    try {
      await updateTaskBlock(target.id, state.copiedTaskBlock.content, state.copiedTaskBlock.status);
      setStatus("블록 대체 완료");
      await refreshAfterTaskSave({ loadAndRender, setStatus });
    } catch (error) {
      console.error(error);
      setStatus("블록 대체 실패");
    }
  }

  async function handleTaskBlockShortcuts(event) {
    if (!event.metaKey || event.altKey || event.shiftKey || event.ctrlKey) return;
    if (event.target.closest("input, textarea, [contenteditable='true']")) return;
    const key = event.key.toLowerCase();
    if (key !== "c" && key !== "v") return;
    event.preventDefault();
    if (key === "c") await copySelectedTaskBlock();
    else await pasteSelectedTaskBlock();
  }

  return { addBlankTask, addTaskFromInput, handleTaskBlockShortcuts, selectTaskBlock };
}
