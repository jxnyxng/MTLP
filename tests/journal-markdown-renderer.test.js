import test from "node:test";
import assert from "node:assert/strict";
import { appendJournalMarkdownBlocks, journalEditorBodyToMarkdown } from "../src/renderers/journal-markdown-renderer.js";
import { installFakeDom } from "./helpers/fake-dom.js";

test("journal headings retain their original levels across repeated editing and saving", (t) => {
  installFakeDom(t);
  let markdown = "# 기존 제목\n## 소제목\n### 하위 제목\n#### 작은 제목";
  const original = markdown;
  for (let cycle = 0; cycle < 3; cycle++) {
    const editor = document.createElement("div");
    appendJournalMarkdownBlocks(editor, markdown);
    markdown = journalEditorBodyToMarkdown(editor);
    assert.equal(markdown, original);
  }
});

test("bold, italic, code, quotes and lists survive editing serialization", (t) => {
  installFakeDom(t);
  const markdown = "일반 **강조** _기울임_ `코드`\n> 인용\n- 첫째\n- **둘째**";
  const editor = document.createElement("div");
  appendJournalMarkdownBlocks(editor, markdown);
  assert.equal(journalEditorBodyToMarkdown(editor), markdown);
});
