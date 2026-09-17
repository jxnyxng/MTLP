import test from "node:test";
import assert from "node:assert/strict";
import { createJournalEditor } from "../src/renderers/journal-editor-renderer.js";
import { find, installFakeDom } from "./helpers/fake-dom.js";

function fixture(t, overrides = {}, entry = { id: null, target_date: "2026-09-17", position: 1000, content: "" }) {
  const { body, confirmations } = installFakeDom(t);
  const calls = { inserts: [], updates: [], status: [], renders: 0 };
  const editor = createJournalEditor({
    state: { dbReady: true },
    addJournalEntry: async (...args) => { calls.inserts.push(args); return 42; },
    updateJournalEntry: async (...args) => { calls.updates.push(args); },
    setStatus: (message) => calls.status.push(message),
    loadAndRender: async () => { calls.renders++; },
    ...overrides,
  });
  editor.openJournalEditor(entry, entry.id === null ? "edit" : "read");
  return { entry, calls, element: (selector) => find(body, selector), confirmations,
    saveButton: find(body, (node) => node.className === "journal-editor-save") };
}

test("draft editor saves title and formatted body once and blocks editing or closing while saving", async (t) => {
  let release;
  const inserts = [];
  const { entry, element, calls, saveButton } = fixture(t, {
    addJournalEntry: (...args) => {
      inserts.push(args);
      return new Promise((resolve) => { release = resolve; });
    },
  });
  const title = element(".journal-title-input");
  const body = element(".journal-body-editor");
  title.value = "오늘";
  const paragraph = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = "성과";
  paragraph.append(strong);
  body.append(paragraph);
  const saving = saveButton.emit("click");
  assert.equal(title.disabled, true);
  assert.equal(body.contentEditable, "false");
  assert.equal(element(".journal-editor-cancel").disabled, true);
  assert.equal((await element("#journal-editor-modal").emit("cancel")).defaultPrevented, true);
  await saveButton.emit("click");
  assert.equal(inserts.length, 1);
  release(42);
  await saving;
  assert.deepEqual(inserts, [["2026-09-17", 1000, "오늘\n**성과**"]]);
  assert.equal(entry.id, 42);
  assert.equal(element(".journal-editor-sheet").dataset.mode, "read");
  assert.equal(title.disabled, false);
  assert.equal(body.contentEditable, "true");
  assert.equal(calls.renders, 1);
  assert.deepEqual(calls.updates, []);
});

test("failed draft saves retain editor content and restore controls for retry", async (t) => {
  let attempts = 0;
  const originalError = console.error;
  console.error = () => {};
  t.after(() => { console.error = originalError; });
  const { entry, element, calls, saveButton } = fixture(t, {
    addJournalEntry: async () => {
      if (++attempts === 1) throw new Error("disk full");
      return 42;
    },
  });
  element(".journal-title-input").value = "잃으면 안 되는 제목";
  await saveButton.emit("click");
  assert.equal(entry.id, null);
  assert.equal(element(".journal-title-input").value, "잃으면 안 되는 제목");
  assert.equal(element(".journal-title-input").disabled, false);
  assert.equal(element(".journal-body-editor").contentEditable, "true");
  assert.equal(element(".journal-editor-sheet").dataset.mode, "edit");
  assert.equal(calls.status.at(-1), "일기 저장 실패");
  await saveButton.emit("click");
  assert.equal(entry.id, 42);
  assert.equal(attempts, 2);
});

test("existing journals retain read, edit, cancel and update behavior", async (t) => {
  const entry = { id: 7, target_date: "2026-09-17", content: "기존 제목\n본문" };
  const { element, confirmations, calls, saveButton } = fixture(t, {}, entry);
  assert.equal(element(".journal-editor-sheet").dataset.mode, "read");
  await element(".journal-editor-edit").emit("click");
  element(".journal-title-input").value = "취소할 제목";
  await element(".journal-editor-cancel").emit("click");
  assert.equal(element(".journal-title-input").value, "기존 제목");
  assert.equal(element(".journal-editor-sheet").dataset.mode, "read");
  assert.equal(confirmations.length, 1);
  assert.deepEqual(calls.updates, []);
  await element(".journal-editor-edit").emit("click");
  element(".journal-title-input").value = "수정 제목";
  await saveButton.emit("click");
  assert.deepEqual(calls.updates, [[7, "수정 제목\n본문"]]);
  assert.deepEqual(calls.inserts, []);
});

test("empty drafts cannot be saved and cancelling a draft does not insert a row", async (t) => {
  const { element, calls, saveButton } = fixture(t);
  await saveButton.emit("click");
  assert.equal(calls.status.at(-1), "제목이나 내용이 있어야 저장할 수 있습니다.");
  element(".journal-title-input").value = "미저장 제목";
  await element(".journal-editor-cancel").emit("click");
  assert.equal(element("#journal-editor-modal").open, false);
  assert.deepEqual(calls.inserts, []);
});

test("changing only a journal title does not modify body heading levels", async (t) => {
  const entry = { id: 7, target_date: "2026-09-17", content: "기존 제목\n## 소제목\n### 하위 제목\n#### 작은 제목" };
  const { element, calls, saveButton } = fixture(t, {}, entry);
  await element(".journal-editor-edit").emit("click");
  element(".journal-title-input").value = "수정 제목";
  await saveButton.emit("click");
  assert.deepEqual(calls.updates, [[7, "수정 제목\n## 소제목\n### 하위 제목\n#### 작은 제목"]]);
});

test("saving an unchanged formatted journal does not write it again", async (t) => {
  const entry = { id: 7, target_date: "2026-09-17", content: "제목\n## 소제목\n**본문**" };
  const { element, calls, saveButton } = fixture(t, {}, entry);
  await element(".journal-editor-edit").emit("click");
  await saveButton.emit("click");
  assert.deepEqual(calls.updates, []);
});

test("a view refresh failure after persistence is not reported as a journal save failure", async (t) => {
  const originalError = console.error;
  console.error = () => {};
  t.after(() => { console.error = originalError; });
  const { element, entry, calls, saveButton } = fixture(t, {
    loadAndRender: async () => { throw new Error("read failed after save"); },
  });
  element(".journal-title-input").value = "저장할 제목";
  await saveButton.emit("click");
  assert.equal(entry.id, 42);
  assert.equal(entry.content, "저장할 제목");
  assert.equal(calls.status.at(-1), "일기는 저장됐지만 목록을 갱신하지 못했습니다.");
  assert.equal(element(".journal-editor-settings").textContent.includes("저장됨 · 목록 갱신 실패"), true);
  assert.equal(element(".journal-editor-sheet").dataset.mode, "read");
  assert.equal(saveButton.disabled, false);
  await saveButton.emit("click");
  assert.equal(calls.inserts.length, 1);
  assert.deepEqual(calls.updates, []);
});
