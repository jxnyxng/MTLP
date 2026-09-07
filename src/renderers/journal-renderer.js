export function createJournalRenderer({
  state,
  addJournalEntry,
  deleteJournalEntry,
  updateJournalEntry,
  toDateKey,
  setStatus,
  loadAndRender,
}) {
  function journalNextPosition(entries) {
    if (!entries.length) return 1000;
    return Math.max(...entries.map((entry) => Number(entry.position) || 0)) + 1000;
  }

  function createJournalPage(entry) {
    const page = document.createElement("article");
    page.className = "journal-page";

    const mark = document.createElement("span");
    mark.className = "journal-date-mark";
    mark.textContent = entry.target_date;

    const textarea = document.createElement("textarea");
    textarea.className = "journal-textarea";
    textarea.value = entry.content ?? "";
    textarea.placeholder = "오늘의 생각을 적어보세요.";
    textarea.addEventListener("input", () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
    textarea.addEventListener("blur", async () => {
      if (!state.dbReady) return;
      try {
        await updateJournalEntry(entry.id, textarea.value);
        setStatus("일기 저장 완료");
      } catch (error) {
        console.error(error);
        setStatus("일기 저장 실패");
      }
    });

    const deleteButton = document.createElement("button");
    deleteButton.className = "journal-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", "일기 삭제");
    deleteButton.addEventListener("click", async () => {
      if (!state.dbReady) return;
      try {
        await deleteJournalEntry(entry.id);
        setStatus("일기 삭제 완료");
        await loadAndRender();
      } catch (error) {
        console.error(error);
        setStatus("일기 삭제 실패");
      }
    });

    page.append(mark, deleteButton, textarea);
    requestAnimationFrame(() => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
    return page;
  }

  async function addJournalPage() {
    if (!state.dbReady) {
      setStatus("SQLite가 준비되지 않아 저장할 수 없습니다.");
      return;
    }

    try {
      await addJournalEntry(toDateKey(new Date()), journalNextPosition(state.journalEntries));
      setStatus("일기장 추가 완료");
      await loadAndRender();
    } catch (error) {
      console.error(error);
      setStatus("일기장 추가 실패");
    }
  }

  function renderJournalPanel(panel, data = state) {
    const board = document.createElement("div");
    board.className = "journal-board";

    const addButton = document.createElement("button");
    addButton.className = "journal-add-page";
    addButton.type = "button";
    addButton.textContent = "+";
    addButton.setAttribute("aria-label", "일기장 추가");
    addButton.addEventListener("click", async () => {
      await addJournalPage();
    });

    const pages = document.createElement("section");
    pages.className = "journal-pages";
    const entries = data.journalEntries ?? [];
    pages.append(addButton, ...entries.map(createJournalPage));

    board.append(pages);
    panel.append(board);
  }

  return {
    renderJournalPanel,
  };
}
