import { composeJournalContent, splitJournalContent } from "../journal-utils.js";

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

    const { title, body } = splitJournalContent(entry.content ?? "");

    const previewTitle = document.createElement("h3");
    previewTitle.className = "journal-preview-title";
    const previewContent = `${title}\n${body}`.trim();
    if (!title.trim()) previewTitle.classList.add("is-empty");
    previewTitle.textContent = title.trim() || "제목";

    const preview = document.createElement("p");
    preview.className = "journal-preview";
    if (!previewContent) preview.classList.add("is-empty");
    preview.textContent = body.trim() || (previewContent ? "" : "오늘의 생각을 적어보세요.");

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
    page.append(mark, deleteButton, previewTitle, preview);
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

  function applyTextFormat(textarea, type) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const selected = value.slice(start, end);
    const formats = {
      heading: [`## ${selected || "소제목"}`, 3, 0],
      bold: [`**${selected || "굵은 글씨"}**`, 2, 2],
      italic: [`_${selected || "기울임"}_`, 1, 1],
      quote: [`> ${selected || "인용문"}`, 2, 0],
      list: [`- ${selected || "목록"}`, 2, 0],
    };
    const format = formats[type];
    if (!format) return;

    const [replacement, selectionOffset, selectionInset] = format;
    textarea.value = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    const nextStart = start + selectionOffset;
    const nextEnd = start + replacement.length - selectionInset;
    textarea.focus();
    textarea.setSelectionRange(nextStart, nextEnd);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function openJournalEditor(entry) {
    const dialog = getJournalDialog();
    const sheet = document.createElement("section");
    sheet.className = "journal-editor-sheet";

    const editorHeader = document.createElement("header");
    editorHeader.className = "journal-editor-header";

    const editorMeta = document.createElement("div");
    editorMeta.className = "journal-editor-meta";

    const mark = document.createElement("span");
    mark.className = "journal-editor-date";
    mark.textContent = entry.target_date;

    const editorTitle = document.createElement("strong");
    editorTitle.textContent = "Journal";
    editorMeta.append(editorTitle, mark);

    const closeButton = document.createElement("button");
    closeButton.className = "journal-editor-close";
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "일기 닫기");

    editorHeader.append(editorMeta, closeButton);

    const toolbar = document.createElement("div");
    toolbar.className = "journal-editor-toolbar";

    const fields = document.createElement("div");
    fields.className = "journal-editor-fields";

    const { title, body } = splitJournalContent(entry.content ?? "");

    const titleInput = document.createElement("input");
    titleInput.className = "journal-title-input";
    titleInput.type = "text";
    titleInput.value = title;
    titleInput.placeholder = "제목";
    titleInput.setAttribute("aria-label", "메모 제목");

    const textarea = document.createElement("textarea");
    textarea.className = "journal-body-textarea";
    textarea.value = body;
    textarea.placeholder = "본문";
    textarea.setAttribute("aria-label", "메모 본문");

    [
      ["heading", "H2", "소제목"],
      ["bold", "B", "굵게"],
      ["italic", "I", "기울임"],
      ["quote", "“”", "인용"],
      ["list", "•", "목록"],
    ].forEach(([type, label, title]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.title = title;
      button.setAttribute("aria-label", title);
      button.addEventListener("click", () => applyTextFormat(textarea, type));
      toolbar.append(button);
    });

    fields.append(titleInput, textarea);

    const settings = document.createElement("aside");
    settings.className = "journal-editor-settings";

    const dateGroup = document.createElement("section");
    dateGroup.className = "journal-setting-group";
    dateGroup.innerHTML = `<span>날짜</span><strong>${entry.target_date}</strong>`;

    const countGroup = document.createElement("section");
    countGroup.className = "journal-setting-group";
    const countValue = document.createElement("strong");
    const updateCount = () => {
      countValue.textContent = `${titleInput.value.length + textarea.value.length}자`;
    };
    countGroup.append(Object.assign(document.createElement("span"), { textContent: "글자 수" }), countValue);

    const saveStateGroup = document.createElement("section");
    saveStateGroup.className = "journal-setting-group";
    const saveState = document.createElement("strong");
    saveState.textContent = "저장됨";
    saveStateGroup.append(Object.assign(document.createElement("span"), { textContent: "상태" }), saveState);

    const closeSideButton = document.createElement("button");
    closeSideButton.className = "journal-editor-save";
    closeSideButton.type = "button";
    closeSideButton.textContent = "닫기";

    settings.append(dateGroup, countGroup, saveStateGroup, closeSideButton);

    let savedContent = entry.content ?? "";
    const save = async () => {
      const nextContent = composeJournalContent(titleInput.value, textarea.value);
      if (!state.dbReady || nextContent === savedContent) return;
      try {
        saveState.textContent = "저장 중";
        await updateJournalEntry(entry.id, nextContent);
        savedContent = nextContent;
        saveState.textContent = "저장됨";
        setStatus("일기 저장 완료");
        await loadAndRender();
      } catch (error) {
        console.error(error);
        saveState.textContent = "실패";
        setStatus("일기 저장 실패");
      }
    };

    const handleInput = () => {
      resizeJournalInput(textarea);
      updateCount();
      saveState.textContent = "편집 중";
    };
    textarea.addEventListener("input", handleInput);
    titleInput.addEventListener("input", handleInput);
    titleInput.addEventListener("blur", save);
    titleInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      textarea.focus();
      textarea.setSelectionRange(0, 0);
    });
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

    closeSideButton.addEventListener("click", async () => {
      await save();
      dialog.removeEventListener("cancel", saveOnCancel);
      dialog.close();
    });

    sheet.append(editorHeader, toolbar, fields, settings);
    dialog.replaceChildren(sheet);
    dialog.showModal();
    requestAnimationFrame(() => {
      resizeJournalInput(textarea);
      updateCount();
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
    addButton.className = "journal-add-button";
    addButton.type = "button";
    addButton.textContent = "작성하기";
    addButton.setAttribute("aria-label", "메모 작성하기");
    addButton.addEventListener("click", async () => {
      await addJournalPage();
    });

    const pages = document.createElement("section");
    pages.className = "journal-pages";
    const entries = data.journalEntries ?? [];
    pages.append(...entries.map(createJournalPage));

    board.append(addButton, pages);
    panel.append(board);
  }

  return {
    openJournalEditor,
    renderJournalPanel,
  };
}
