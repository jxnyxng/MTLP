// Persistence has already succeeded; a refresh failure must not invite a duplicate save.
export async function refreshAfterTaskSave({ loadAndRender, setStatus }) {
  try {
    await loadAndRender();
  } catch (error) {
    console.error(error);
    setStatus("변경은 저장됐지만 화면을 갱신하지 못했습니다.");
  }
}
