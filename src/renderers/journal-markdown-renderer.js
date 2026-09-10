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

export function createJournalMarkdownView(title, body) {
  const article = document.createElement("article");
  article.className = "journal-rendered";

  const heading = document.createElement("h1");
  heading.textContent = title.trim() || "제목 없는 메모";
  article.append(heading);

  const lines = body.replace(/\r\n/g, "\n").split("\n");
  let list = null;
  const closeList = () => {
    if (!list) return;
    article.append(list);
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
      article.append(node);
      return;
    }

    const quoteMatch = /^>\s?(.+)$/.exec(trimmed);
    if (quoteMatch) {
      closeList();
      const quote = document.createElement("blockquote");
      appendInlineMarkdown(quote, quoteMatch[1]);
      article.append(quote);
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
    article.append(paragraph);
  });

  closeList();

  if (!title.trim() && !body.trim()) {
    const empty = document.createElement("p");
    empty.className = "journal-rendered-empty";
    empty.textContent = "오늘의 생각을 적어보세요.";
    article.append(empty);
  }

  return article;
}
