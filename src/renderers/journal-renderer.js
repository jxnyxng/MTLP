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
    page.tabIndex = 0;
    page.setAttribute("role", "button");
    page.setAttribute("aria-label", `${entry.target_date} 일기 열기`);

    const mark = document.createElement("span");
    mark.className = "journal-date-mark";
    mark.textContent = entry.target_date;

    const preview = document.createElement("p");
    preview.className = "journal-preview";
    const previewContent = entry.content?.trim();
    if (!previewContent) preview.classList.add("is-empty");
    preview.textContent = previewContent || "오늘의 생각을 적어보세요.";

    const deleteButton = document.createElement("button");
    deleteButton.className = "journal-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", "일기 삭제");
    deleteButton.addEventListener("click", async (event) => {
      event.stopPropagation();
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

    page.addEventListener("click", () => openJournalEditor(entry));
    page.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openJournalEditor(entry);
    });
    page.append(mark, deleteButton, preview);
    return page;
  }

  function getJournalDialog() {
    let dialog = document.querySelector("#journal-editor-modal");
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = "journal-editor-modal";
    dialog.className = "journal-editor-modal";
    document.body.append(dialog);
    return dialog;
  }

  function resizeJournalInput(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  function openJournalEditor(entry) {
    const dialog = getJournalDialog();
    const sheet = document.createElement("section");
    sheet.className = "journal-editor-sheet";

    const mark = document.createElement("span");
    mark.className = "journal-date-mark";
    mark.textContent = entry.target_date;

    const closeButton = document.createElement("button");
    closeButton.className = "journal-delete";
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "일기 닫기");

    const textarea = document.createElement("textarea");
    textarea.className = "journal-textarea";
    textarea.value = entry.content ?? "";
    textarea.placeholder = "오늘의 생각을 적어보세요.";

    let savedContent = textarea.value;
    const save = async () => {
      if (!state.dbReady || textarea.value === savedContent) return;
      try {
        await updateJournalEntry(entry.id, textarea.value);
        savedContent = textarea.value;
        setStatus("일기 저장 완료");
        await loadAndRender();
      } catch (error) {
        console.error(error);
        setStatus("일기 저장 실패");
      }
    };

    textarea.addEventListener("input", () => resizeJournalInput(textarea));
    textarea.addEventListener("blur", save);
    const saveOnCancel = () => {
      void save();
    };

    closeButton.addEventListener("click", async () => {
      await save();
      dialog.removeEventListener("cancel", saveOnCancel);
      dialog.close();
    });
    dialog.addEventListener("cancel", saveOnCancel, { once: true });

    sheet.append(mark, closeButton, textarea);
    dialog.replaceChildren(sheet);
    dialog.showModal();
    requestAnimationFrame(() => {
      resizeJournalInput(textarea);
      textarea.focus();
    });
  }

  async function addJournalPage() {
    if (!state.dbReady) {
      setStatus("SQLite가 준비되지 않아 저장할 수 없습니다.");
      return;
    }

    try {
      const id = await addJournalEntry(toDateKey(new Date()), journalNextPosition(state.journalEntries));
      setStatus("일기장 추가 완료");
      await loadAndRender();
      const entry = state.journalEntries.find((journalEntry) => Number(journalEntry.id) === Number(id));
      if (entry) openJournalEditor(entry);
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
