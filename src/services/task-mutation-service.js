// Persistence has already succeeded; a refresh failure must not invite a duplicate save.
export async function refreshAfterSave({
  loadAndRender,
  setStatus,
  refreshFailureMessage = "변경은 저장됐지만 화면을 갱신하지 못했습니다.",
}) {
  try {
    await loadAndRender();
    return true;
  } catch (error) {
    console.error(error);
    setStatus(refreshFailureMessage);
    return false;
  }
}

export const refreshAfterTaskSave = refreshAfterSave;
