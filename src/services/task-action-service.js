import { refreshAfterTaskSave } from "./task-mutation-service.js";

export function createTaskActionService({
  state,
  deleteTask,
  updateTaskContent,
  updateTaskStatus,
  setStatus,
  loadAndRender,
}) {
  async function persist(action, successMessage, failureMessage) {
    try {
      await action();
      setStatus(successMessage);
      await refreshAfterTaskSave({ loadAndRender, setStatus });
      return true;
    } catch (error) {
      console.error(error);
      setStatus(failureMessage);
      return false;
    }
  }

  async function removeTask(task) {
    if (!state.dbReady) return false;
    return persist(
      async () => {
        await deleteTask(task.id);
        if (state.selectedTaskId === Number(task.id)) state.selectedTaskId = null;
      },
      "삭제 완료",
      "삭제 실패",
    );
  }

  async function toggleTaskStatus(task) {
    if (!state.dbReady) return false;
    return persist(
      () => updateTaskStatus(task.id, task.status === "DONE" ? "TODO" : "DONE"),
      "상태 저장 완료",
      "상태 저장 실패",
    );
  }

  async function saveTaskContent(task, content) {
    if (!state.dbReady) {
      setStatus("SQLite가 준비되지 않아 저장할 수 없습니다.");
      return false;
    }
    return persist(
      () => updateTaskContent(task.id, content),
      "수정 완료",
      "수정 실패",
    );
  }

  return { removeTask, saveTaskContent, toggleTaskStatus };
}
