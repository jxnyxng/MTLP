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
  let listTag = null;
  const closeList = () => {
    if (!list) return;
    parent.append(list);
    list = null;
    listTag = null;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      return;
    }

    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      closeList();
      const level = String(Math.max(headingMatch[1].length, 2));
      const node = document.createElement(`h${level}`);
      // Legacy single-# headings keep their existing H2 appearance and syntax.
      if (headingMatch[1] === "#") node.dataset.legacyHeading = "true";
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

    const listMatch = /^([-*]|\d+\.)\s+(.+)$/.exec(trimmed);
    if (listMatch) {
      const nextListTag = /\d+\./.test(listMatch[1]) ? "ol" : "ul";
      if (list && listTag !== nextListTag) closeList();
      if (!list) {
        list = document.createElement(nextListTag);
        listTag = nextListTag;
      }
      const item = document.createElement("li");
      appendInlineMarkdown(item, listMatch[2]);
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
  if (node.tagName === "BR") return "\n";
  return content;
}

const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "H1", "H2", "H3", "H4", "H5", "H6",
  "LI", "MAIN", "OL", "P", "SECTION", "UL",
]);

function containsBlockChildren(node) {
  return Array.from(node.children).some((child) => BLOCK_TAGS.has(child.tagName));
}

function listMarkdownFromNode(node, ordered) {
  return Array.from(node.children)
    .filter((item) => item.tagName === "LI")
    .flatMap((item, index) => {
      const prefix = ordered ? `${index + 1}.` : "-";
      const inline = Array.from(item.childNodes)
        .filter((child) => !(child instanceof HTMLElement) || !["UL", "OL"].includes(child.tagName))
        .map(inlineMarkdownFromNode)
        .join("")
        .trim();
      const nested = Array.from(item.children)
        .filter((child) => child.tagName === "UL" || child.tagName === "OL")
        .flatMap((child) => blockMarkdownFromNode(child))
        .map((line) => `  ${line}`);
      return inline ? [`${prefix} ${inline}`, ...nested] : nested;
    });
}

function blockMarkdownFromNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    return text.trim() ? [text.trim()] : [];
  }
  if (!(node instanceof HTMLElement)) return [];

  const text = Array.from(node.childNodes).map(inlineMarkdownFromNode).join("").trim();
  if (node.tagName === "BR") return [];
  if (node.tagName === "H1" || node.tagName === "H2") {
    return [`${node.dataset.legacyHeading === "true" ? "#" : "##"} ${text}`];
  }
  if (node.tagName === "H3") return [`### ${text}`];
  if (["H4", "H5", "H6"].includes(node.tagName)) return [`#### ${text}`];
  if (node.tagName === "BLOCKQUOTE") {
    const lines = containsBlockChildren(node)
      ? Array.from(node.childNodes).flatMap(blockMarkdownFromNode)
      : [text];
    return lines.filter(Boolean).map((line) => `> ${line}`);
  }
  if (node.tagName === "UL") return listMarkdownFromNode(node, false);
  if (node.tagName === "OL") return listMarkdownFromNode(node, true);
  if (containsBlockChildren(node)) {
    return Array.from(node.childNodes).flatMap(blockMarkdownFromNode);
  }
  return text ? [text] : [];
}

export function journalEditorBodyToMarkdown(editor) {
  return Array.from(editor.childNodes)
    .flatMap(blockMarkdownFromNode)
    .join("\n");
}

export function journalMarkdownToPlainText(markdown = "") {
  return markdown
    .replace(/^#{1,4}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^(?:[-*]|\d+\.)\s+/gm, "")
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
