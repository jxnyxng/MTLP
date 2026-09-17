import { composeJournalContent, splitJournalContent } from "../journal-utils.js";
import { createJournalEntrySaver } from "../services/journal-entry-service.js";
import {
  appendJournalMarkdownBlocks,
  createJournalMarkdownView,
  journalEditorBodyToMarkdown,
} from "./journal-markdown-renderer.js";

export function createJournalEditor({ state, addJournalEntry, updateJournalEntry, setStatus, loadAndRender }) {
  function getJournalDialog() {
    let dialog = document.querySelector("#journal-editor-modal");
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = "journal-editor-modal";
    dialog.className = "journal-editor-modal";
    dialog.addEventListener("close", () => {
      requestAnimationFrame(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
    });
    document.body.append(dialog);
    return dialog;
  }

  function focusEditorEnd(editor) {
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function blockFormatValue() {
    return String(document.queryCommandValue("formatBlock") || "").toLowerCase();
  }

  function applyTextFormat(editor, type) {
    editor.focus();
    const blockFormat = blockFormatValue();
    if (type === "heading") document.execCommand("formatBlock", false, blockFormat === "h2" ? "p" : "h2");
    if (type === "bold") document.execCommand("bold");
    if (type === "italic") document.execCommand("italic");
    if (type === "quote") document.execCommand("formatBlock", false, blockFormat === "blockquote" ? "p" : "blockquote");
    if (type === "list") document.execCommand("insertUnorderedList");
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function isEditorCommandActive(type) {
    if (type === "bold") return document.queryCommandState("bold");
    if (type === "italic") return document.queryCommandState("italic");
    if (type === "list") return document.queryCommandState("insertUnorderedList");
    if (type === "heading") return blockFormatValue() === "h2";
    if (type === "quote") return blockFormatValue() === "blockquote";
    return false;
  }

  function createBodyEditor(body) {
    const editor = document.createElement("div");
    editor.className = "journal-body-editor";
    editor.contentEditable = "true";
    editor.dataset.placeholder = "본문";
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-label", "메모 본문");
    editor.setAttribute("aria-multiline", "true");
    appendJournalMarkdownBlocks(editor, body);
    return editor;
  }

  function openJournalEditor(entry, mode = "read") {
    const dialog = getJournalDialog();
    const sheet = document.createElement("section");
    sheet.className = "journal-editor-sheet";
    sheet.dataset.mode = mode;

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

    const isDraft = entry.id === null || entry.id === undefined;
    const { title, body } = splitJournalContent(entry.content ?? "");

    const titleInput = document.createElement("input");
    titleInput.className = "journal-title-input";
    titleInput.type = "text";
    titleInput.value = title;
    titleInput.placeholder = "제목";
    titleInput.setAttribute("aria-label", "메모 제목");

    const bodyEditor = createBodyEditor(body);

    const reader = document.createElement("div");
    reader.className = "journal-reader";

    const formatButtons = [];
    [
      ["heading", "H2", "소제목"],
      ["bold", "B", "굵게"],
      ["italic", "I", "기울임"],
      ["quote", ">", "인용"],
      ["list", "•", "목록"],
    ].forEach(([type, label, title]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.title = title;
      button.setAttribute("aria-label", title);
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      button.addEventListener("click", () => {
        applyTextFormat(bodyEditor, type);
        updateFormatButtonStates();
      });
      formatButtons.push([type, button]);
      toolbar.append(button);
    });

    const updateFormatButtonStates = () => {
      formatButtons.forEach(([type, button]) => {
        button.setAttribute("aria-pressed", String(isEditorCommandActive(type)));
      });
    };

    fields.append(titleInput, bodyEditor);
    const renderReader = () => {
      const { title: savedTitle, body: savedBody } = splitJournalContent(savedContent);
      reader.replaceChildren(createJournalMarkdownView(savedTitle, savedBody));
    };

    const settings = document.createElement("aside");
    settings.className = "journal-editor-settings";

    const dateGroup = document.createElement("section");
    dateGroup.className = "journal-setting-group";
    dateGroup.innerHTML = `<span>날짜</span><strong>${entry.target_date}</strong>`;

    const countGroup = document.createElement("section");
    countGroup.className = "journal-setting-group";
    const countValue = document.createElement("strong");
    const updateCount = () => {
      countValue.textContent = `${titleInput.value.length + (bodyEditor.textContent ?? "").length}자`;
    };
    countGroup.append(Object.assign(document.createElement("span"), { textContent: "글자 수" }), countValue);

    const saveStateGroup = document.createElement("section");
    saveStateGroup.className = "journal-setting-group";
    const saveState = document.createElement("strong");
    saveState.textContent = "저장됨";
    saveStateGroup.append(Object.assign(document.createElement("span"), { textContent: "상태" }), saveState);

    const saveButton = document.createElement("button");
    saveButton.className = "journal-editor-save";
    saveButton.type = "button";
    saveButton.textContent = "저장";

    const cancelButton = document.createElement("button");
    cancelButton.className = "journal-editor-save journal-editor-cancel";
    cancelButton.type = "button";
    cancelButton.textContent = "취소";

    const editButton = document.createElement("button");
    editButton.className = "journal-editor-save journal-editor-edit";
    editButton.type = "button";
    editButton.textContent = "수정";

    let savedContent = entry.content ?? "";
    let isSaved = false;
    let isSaving = false;
    const entrySaver = createJournalEntrySaver({ entry, addJournalEntry, updateJournalEntry });
    renderReader();
    settings.append(dateGroup, countGroup, saveStateGroup, editButton, saveButton, cancelButton);

    const setEditorMode = (nextMode) => {
      sheet.dataset.mode = nextMode;
      saveState.textContent = nextMode === "edit" ? "편집 중" : "저장됨";
      cancelButton.textContent = nextMode === "edit" ? "취소" : "닫기";
      if (nextMode === "edit") {
        requestAnimationFrame(() => {
          titleInput.focus();
          updateFormatButtonStates();
        });
      }
    };

    const resetEditorToSavedContent = () => {
      const { title: savedTitle, body: savedBody } = splitJournalContent(savedContent);
      titleInput.value = savedTitle;
      bodyEditor.replaceChildren();
      appendJournalMarkdownBlocks(bodyEditor, savedBody);
      updateCount();
      updateFormatButtonStates();
    };

    const currentContent = () =>
      composeJournalContent(titleInput.value, journalEditorBodyToMarkdown(bodyEditor));
    const setSaving = (saving) => {
      isSaving = saving;
      [saveButton, cancelButton, closeButton, editButton, titleInput,
        ...formatButtons.map(([, button]) => button)].forEach((element) => {
        element.disabled = saving;
      });
      bodyEditor.contentEditable = String(!saving);
    };
    const save = async () => {
      if (isSaving) return false;
      const nextContent = currentContent();
      const needsJournalRow = isDraft && !isSaved;
      if (!nextContent.trim()) {
        saveState.textContent = "내용 필요";
        setStatus("제목이나 내용이 있어야 저장할 수 있습니다.");
        return false;
      }
      if (!state.dbReady) return false;
      if (nextContent === savedContent && !needsJournalRow) {
        renderReader();
        setEditorMode("read");
        return true;
      }
      setSaving(true);
      try {
        saveState.textContent = "저장 중";
        await entrySaver.save(nextContent);
        isSaved = true;
        savedContent = nextContent;
        entry.content = nextContent;
        saveState.textContent = "저장됨";
        setStatus("일기 저장 완료");
        renderReader();
        setEditorMode("read");
        try {
          await loadAndRender();
        } catch (error) {
          console.error(error);
          saveState.textContent = "저장됨 · 목록 갱신 실패";
          setStatus("일기는 저장됐지만 목록을 갱신하지 못했습니다.");
        }
        return true;
      } catch (error) {
        console.error(error);
        saveState.textContent = "실패";
        setStatus("일기 저장 실패");
        return false;
      } finally {
        setSaving(false);
      }
    };

    const handleInput = () => {
      updateCount();
      saveState.textContent = "편집 중";
      updateFormatButtonStates();
    };
    bodyEditor.addEventListener("input", handleInput);
    bodyEditor.addEventListener("keyup", updateFormatButtonStates);
    bodyEditor.addEventListener("mouseup", updateFormatButtonStates);
    bodyEditor.addEventListener("focus", updateFormatButtonStates);
    titleInput.addEventListener("input", handleInput);
    titleInput.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      focusEditorEnd(bodyEditor);
    });
    const hasUnsavedChanges = () => {
      const nextContent = currentContent();
      if (isDraft && !isSaved) return Boolean(nextContent.trim());
      return nextContent !== savedContent;
    };
    const closeEditor = () => {
      if (isSaving) return;
      if (hasUnsavedChanges() && !window.confirm("작성 중인 내용을 취소할까요?")) return;
      dialog.close();
    };

    closeButton.addEventListener("click", () => {
      closeEditor();
    });
    const handleCancel = (event) => {
      if (isSaving) {
        event.preventDefault();
        return;
      }
      if (!hasUnsavedChanges()) return;
      event.preventDefault();
      closeEditor();
    };
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("close", () => {
      dialog.removeEventListener("cancel", handleCancel);
    }, { once: true });

    saveButton.addEventListener("click", async () => {
      await save();
    });

    cancelButton.addEventListener("click", () => {
      if (isSaving) return;
      if (sheet.dataset.mode === "read") {
        dialog.close();
        return;
      }
      if (hasUnsavedChanges() && !window.confirm("편집 내용을 되돌릴까요?")) return;
      if (isDraft && !isSaved) {
        dialog.close();
        return;
      }
      resetEditorToSavedContent();
      renderReader();
      setEditorMode("read");
    });

    editButton.addEventListener("click", () => {
      setEditorMode("edit");
    });

    sheet.append(editorHeader, toolbar, reader, fields, settings);
    dialog.replaceChildren(sheet);
    dialog.showModal();
    setEditorMode(mode);
    requestAnimationFrame(() => {
      updateCount();
      updateFormatButtonStates();
    });
  }

  return { openJournalEditor };
}
