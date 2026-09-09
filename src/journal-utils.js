export function splitJournalContent(content = "") {
  const normalized = content.replace(/\r\n/g, "\n");
  const [title = "", ...bodyLines] = normalized.split("\n");
  return {
    title,
    body: bodyLines.join("\n"),
  };
}

export function composeJournalContent(title, body) {
  const trimmedTitle = title.trim();
  const nextBody = body.replace(/\s+$/u, "");
  if (!trimmedTitle) return nextBody;
  if (!nextBody) return trimmedTitle;
  return `${trimmedTitle}\n${nextBody}`;
}

export function journalTitle(entry, fallback = "제목 없는 메모") {
  return splitJournalContent(entry?.content ?? "").title.trim() || fallback;
}
