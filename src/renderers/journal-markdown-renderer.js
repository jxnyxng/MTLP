function inlineMarkdownNodes(text) {
  const nodes = [];
  const pattern = /(\*\*([^*]+)\*\*|_([^_]+)_|`([^`]+)`)/g;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(document.createTextNode(text.slice(cursor, match.index)));
    const element = document.createElement(match[2] ? "strong" : match[3] ? "em" : "code");
    element.textContent = match[2] || match[3] || match[4] || "";
    nodes.push(element);
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) nodes.push(document.createTextNode(text.slice(cursor)));
  return nodes;
}

function appendInlineMarkdown(parent, text) {
  parent.append(...inlineMarkdownNodes(text));
}

export function appendJournalMarkdownBlocks(parent, body) {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let list = null;
  const closeList = () => {
    if (!list) return;
    parent.append(list);
    list = null;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      return;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      closeList();
      const level = String(Math.min(headingMatch[1].length + 1, 4));
      const node = document.createElement(`h${level}`);
      appendInlineMarkdown(node, headingMatch[2]);
      parent.append(node);
      return;
    }

    const quoteMatch = /^>\s?(.+)$/.exec(trimmed);
    if (quoteMatch) {
      closeList();
      const quote = document.createElement("blockquote");
      appendInlineMarkdown(quote, quoteMatch[1]);
      parent.append(quote);
      return;
    }

    const listMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (listMatch) {
      if (!list) list = document.createElement("ul");
      const item = document.createElement("li");
      appendInlineMarkdown(item, listMatch[1]);
      list.append(item);
      return;
    }

    closeList();
    const paragraph = document.createElement("p");
    appendInlineMarkdown(paragraph, line);
    parent.append(paragraph);
  });

  closeList();
}

function inlineMarkdownFromNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";

  const content = Array.from(node.childNodes).map(inlineMarkdownFromNode).join("");
  if (node.tagName === "STRONG" || node.tagName === "B") return `**${content}**`;
  if (node.tagName === "EM" || node.tagName === "I") return `_${content}_`;
  if (node.tagName === "CODE") return `\`${content}\``;
  return content;
}

function blockMarkdownFromNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent?.trim() ?? "";
  if (!(node instanceof HTMLElement)) return "";

  const text = Array.from(node.childNodes).map(inlineMarkdownFromNode).join("").trim();
  if (!text && node.tagName !== "BR") return "";
  if (node.tagName === "H2") return `## ${text}`;
  if (node.tagName === "H3") return `### ${text}`;
  if (node.tagName === "H4") return `#### ${text}`;
  if (node.tagName === "BLOCKQUOTE") return `> ${text}`;
  if (node.tagName === "UL") {
    return Array.from(node.children)
      .map((item) => `- ${Array.from(item.childNodes).map(inlineMarkdownFromNode).join("").trim()}`)
      .filter((line) => line !== "- ")
      .join("\n");
  }
  if (node.tagName === "DIV" || node.tagName === "P") return text;
  return text;
}

export function journalEditorBodyToMarkdown(editor) {
  return Array.from(editor.childNodes)
    .map(blockMarkdownFromNode)
    .filter(Boolean)
    .join("\n");
}

export function journalMarkdownToPlainText(markdown = "") {
  return markdown
    .replace(/^#{1,4}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

export function createJournalMarkdownView(title, body) {
  const article = document.createElement("article");
  article.className = "journal-rendered";

  const heading = document.createElement("h1");
  heading.textContent = title.trim() || "제목 없는 메모";
  article.append(heading);

  appendJournalMarkdownBlocks(article, body);

  if (!title.trim() && !body.trim()) {
    const empty = document.createElement("p");
    empty.className = "journal-rendered-empty";
    empty.textContent = "오늘의 생각을 적어보세요.";
    article.append(empty);
  }

  return article;
}
