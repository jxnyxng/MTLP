import test from "node:test";
import assert from "node:assert/strict";
import { createJournalEntrySaver } from "../src/services/journal-entry-service.js";

test("a draft saves its full content once even with concurrent save requests, then updates the same entry", async () => {
  const entry = { id: null, target_date: "2026-09-17", position: 2000, content: "" };
  const inserts = [];
  const updates = [];
  let release;
  const saver = createJournalEntrySaver({
    entry,
    addJournalEntry: (...args) => {
      inserts.push(args);
      return new Promise((resolve) => { release = resolve; });
    },
    updateJournalEntry: async (...args) => { updates.push(args); },
  });
  const first = saver.save("제목\n**본문**");
  const second = saver.save("제목\n**본문**");
  assert.equal(first, second);
  assert.deepEqual(inserts, [["2026-09-17", 2000, "제목\n**본문**"]]);
  assert.equal(entry.id, null);
  release(42);
  await Promise.all([first, second]);
  assert.equal(entry.id, 42);
  assert.equal(entry.content, "제목\n**본문**");
  assert.deepEqual(updates, []);
  await saver.save("수정 내용");
  assert.deepEqual(updates, [[42, "수정 내용"]]);
  assert.equal(inserts.length, 1);
});

test("failed draft inserts do not mark the draft as saved and can be retried", async () => {
  const entry = { id: null, target_date: "2026-09-17", content: "" };
  let attempts = 0;
  const saver = createJournalEntrySaver({
    entry,
    addJournalEntry: async () => {
      if (++attempts === 1) throw new Error("disk full");
      return 7;
    },
    updateJournalEntry: async () => { assert.fail("draft must not be updated"); },
  });
  await assert.rejects(saver.save("본문"), /disk full/);
  assert.equal(entry.id, null);
  assert.equal(entry.content, "");
  await saver.save("본문");
  assert.equal(entry.id, 7);
  assert.equal(entry.content, "본문");
});

test("failed existing entry updates preserve the last saved content and allow retry", async () => {
  const entry = { id: 7, content: "기존 본문" };
  let attempts = 0;
  const saver = createJournalEntrySaver({
    entry,
    addJournalEntry: async () => { assert.fail("existing entry must not be inserted"); },
    updateJournalEntry: async () => { if (++attempts === 1) throw new Error("write failed"); },
  });
  await assert.rejects(saver.save("수정"), /write failed/);
  assert.equal(entry.content, "기존 본문");
  await saver.save("수정");
  assert.equal(entry.content, "수정");
});
