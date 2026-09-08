export function createTaskRenderer({
  state,
  deleteTask,
  updateTaskContent,
  updateTaskStatus,
  selectTaskBlock,
  setStatus,
  loadAndRender,
  addTaskFromInput,
  addBlankTask,
  targetFor,
}) {
  function createTaskItem(task) {
    const item = document.createElement("li");
    item.className = `task-item status-${task.status.toLowerCase()}`;
    if (!task.content) item.classList.add("is-empty-block");
    item.dataset.id = task.id;
    item.dataset.position = task.position;
    item.dataset.content = task.content;
    item.dataset.status = task.status;
    item.dataset.periodType = task.period_type;
    if (Number(task.id) === state.selectedTaskId) item.classList.add("is-block-selected");
  
    const handle = document.createElement("button");
    handle.className = "drag-handle";
    handle.type = "button";
    handle.setAttribute("aria-label", "블록 선택 또는 드래그해서 이동");
    handle.title = "블록 선택 / 드래그해서 이동";
    handle.addEventListener("click", (event) => {
      event.stopPropagation();
      selectTaskBlock(item);
    });
  
    const bullet = document.createElement("span");
    bullet.className = "bullet";
    bullet.textContent = task.status === "DONE" ? "×" : task.status === "CANCELLED" ? "－" : "•";
  
    const content = document.createElement("span");
    content.className = "task-content";
    content.textContent = task.content || "빈 블록";
    content.title = "클릭해서 수정";
  
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.title = "삭제";
  
    if (!state.isLocked) {
      deleteButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        if (!state.dbReady) return;
  
        try {
          await deleteTask(task.id);
          if (state.selectedTaskId === Number(task.id)) state.selectedTaskId = null;
          setStatus("삭제 완료");
          await loadAndRender();
        } catch (error) {
          console.error(error);
          setStatus("삭제 실패");
        }
      });
  
      item.addEventListener("contextmenu", async (event) => {
        event.preventDefault();
        if (!state.dbReady) return;
  
        try {
          await updateTaskStatus(task.id, task.status === "DONE" ? "TODO" : "DONE");
          setStatus("상태 저장 완료");
          await loadAndRender();
        } catch (error) {
          console.error(error);
          setStatus("상태 저장 실패");
        }
      });
  
      content.addEventListener("click", (event) => {
        event.stopPropagation();
        beginTaskEdit(item, task);
      });
    }
  
    item.append(handle, bullet, content, deleteButton);
    if (!state.isLocked && Number(task.id) === state.pendingEditTaskId) {
      state.pendingEditTaskId = null;
      requestAnimationFrame(() => beginTaskEdit(item, task));
    }
    return item;
  }
  
  function beginTaskEdit(item, task) {
    if (item.classList.contains("is-editing-task")) return;
  
    const content = item.querySelector(".task-content");
    const deleteButton = item.querySelector(".delete-button");
    if (!content) return;
  
    const input = document.createElement("textarea");
    input.className = "task-edit-input";
    input.rows = 1;
    input.value = task.content;
  
    let finished = false;
    const cancel = () => {
      if (finished) return;
      finished = true;
      input.replaceWith(content);
      item.classList.remove("is-editing-task");
      deleteButton?.removeAttribute("disabled");
    };
  
    const save = async () => {
      if (finished) return;
      const nextContent = input.value.trim();
  
      finished = true;
      if (nextContent === task.content) {
        input.replaceWith(content);
        item.classList.remove("is-editing-task");
        deleteButton?.removeAttribute("disabled");
        return;
      }
  
      if (!state.dbReady) {
        setStatus("SQLite가 준비되지 않아 저장할 수 없습니다.");
        finished = false;
        cancel();
        return;
      }
  
      try {
        await updateTaskContent(task.id, nextContent);
        setStatus("수정 완료");
        await loadAndRender();
      } catch (error) {
        console.error(error);
        setStatus("수정 실패");
        finished = false;
      }
    };
  
    input.addEventListener("input", () => resizeEntryInput(input));
    input.addEventListener("blur", save);
    input.addEventListener("keydown", async (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
        return;
      }
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      await save();
    });
  
    item.classList.add("is-editing-task");
    deleteButton?.setAttribute("disabled", "");
    content.replaceWith(input);
    requestAnimationFrame(() => {
      resizeEntryInput(input);
      input.focus();
      input.select();
    });
  }
  
  function resizeEntryInput(input) {
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }
  
  function createEntryRow(
    periodType,
    timeBlock = null,
    targetDate = targetFor(periodType),
  ) {
    const row = document.createElement("li");
    row.className = "entry-row";
  
    const input = document.createElement("textarea");
    input.rows = 1;
    input.addEventListener("input", () => resizeEntryInput(input));
    input.addEventListener("blur", () => {
      requestAnimationFrame(() => {
        if (input.value.trim()) return;
        row.replaceWith(createEntryInput(periodType, null, timeBlock, targetDate));
      });
    });
    input.addEventListener("keydown", async (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        row.replaceWith(createEntryInput(periodType, null, timeBlock, targetDate));
        return;
      }
      if (event.key !== "Enter") return;
      if (event.shiftKey) return;
      event.preventDefault();
      await addTaskFromInput(input, periodType, timeBlock, targetDate);
      resizeEntryInput(input);
    });
  
    row.append(input);
    requestAnimationFrame(() => resizeEntryInput(input));
    return row;
  }
  
  function createEntryInput(
    periodType,
    _placeholder,
    timeBlock = null,
    targetDate = targetFor(periodType),
  ) {
    const row = document.createElement("li");
    row.className = "add-task-row";
  
    const button = document.createElement("button");
    button.className = "add-task-button";
    button.type = "button";
    button.textContent = "+";
    button.setAttribute("aria-label", "빈 블록 추가");
    button.addEventListener("click", async () => {
      await addBlankTask(button, periodType, timeBlock, targetDate);
    });
    row.append(button);
    return row;
  }
  
  function createEmptyReadItem() {
    const row = document.createElement("li");
    row.className = "empty-read-row";
    row.setAttribute("aria-hidden", "true");
    return row;
  }
  
  function renderTaskList(list, periodType, tasks, placeholder) {
    const taskItems = tasks.map(createTaskItem);
    if (state.isLocked) {
      list.replaceChildren(...taskItems, createEmptyReadItem());
      return;
    }
  
    list.replaceChildren(
      ...taskItems,
      createEntryInput(periodType, placeholder, list.dataset.timeBlock ?? null, list.dataset.targetDate),
    );
  }
  
  function createTaskStack(list) {
    const stack = document.createElement("div");
    stack.className = "task-stack";
    stack.append(list);
    return stack;
  }
  
  function createSplitTaskStack(periodType, tasks, placeholder, targetDate) {
    const stack = document.createElement("div");
    stack.className = "split-task-stack";
  
    const lists = [0, 1].map((lane) => {
      const list = document.createElement("ul");
      list.className = "task-list split-task-list";
      list.dataset.periodType = periodType;
      list.dataset.targetDate = targetDate;
      renderTaskList(
        list,
        periodType,
        tasks.filter((_, index) => index % 2 === lane),
        placeholder,
      );
      return list;
    });
  
    stack.append(...lists);
    return stack;
  }

  return {
    createSplitTaskStack,
    createTaskStack,
    renderTaskList,
  };
}
