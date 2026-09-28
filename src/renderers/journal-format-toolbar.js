const FORMAT_BUTTONS = [
  ["heading", "H2", "소제목"],
  ["bold", "B", "굵게"],
  ["italic", "I", "기울임"],
  ["quote", ">", "인용"],
  ["list", "•", "목록"],
];

function blockFormatValue() {
  return String(document.queryCommandValue("formatBlock") || "").toLowerCase();
}

function applyTextFormat(editor, type) {
  editor.focus();
  const blockFormat = blockFormatValue();
  if (type === "heading") {
    document.execCommand("formatBlock", false, blockFormat === "h2" ? "p" : "h2");
  }
  if (type === "bold") document.execCommand("bold");
  if (type === "italic") document.execCommand("italic");
  if (type === "quote") {
    document.execCommand("formatBlock", false, blockFormat === "blockquote" ? "p" : "blockquote");
  }
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

export function createJournalFormatToolbar(editor) {
  const toolbar = document.createElement("div");
  toolbar.className = "journal-editor-toolbar";
  const buttons = [];

  const updateButtonStates = () => {
    buttons.forEach(([type, button]) => {
      button.setAttribute("aria-pressed", String(isEditorCommandActive(type)));
    });
  };

  FORMAT_BUTTONS.forEach(([type, label, title]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      applyTextFormat(editor, type);
      updateButtonStates();
    });
    buttons.push([type, button]);
    toolbar.append(button);
  });

  return { toolbar, buttons, updateButtonStates };
}
