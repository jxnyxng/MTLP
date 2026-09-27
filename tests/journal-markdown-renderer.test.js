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

test("browser-inserted wrappers do not flatten formatted journal blocks", (t) => {
  installFakeDom(t);
  const editor = document.createElement("div");
  const wrapper = document.createElement("div");
  const heading = document.createElement("h2");
  heading.append("소제목");
  const quote = document.createElement("blockquote");
  const bold = document.createElement("b");
  bold.append("중요한 인용");
  quote.append(bold);
  const list = document.createElement("ul");
  const item = document.createElement("li");
  const italic = document.createElement("i");
  italic.append("목록 항목");
  item.append(italic);
  list.append(item);
  wrapper.append(heading, quote, list);
  editor.append(wrapper);

  const markdown = journalEditorBodyToMarkdown(editor);
  assert.equal(markdown, "## 소제목\n> **중요한 인용**\n- _목록 항목_");

  const reader = document.createElement("article");
  appendJournalMarkdownBlocks(reader, markdown);
  assert.deepEqual(reader.children.map((node) => node.tagName), ["H2", "BLOCKQUOTE", "UL"]);
});

test("ordered lists render and survive editor serialization", (t) => {
  installFakeDom(t);
  const markdown = "1. 첫째\n2. 둘째";
  const editor = document.createElement("div");
  appendJournalMarkdownBlocks(editor, markdown);
  assert.equal(editor.children[0].tagName, "OL");
  assert.equal(journalEditorBodyToMarkdown(editor), markdown);
});
