import test from "node:test";
import assert from "node:assert/strict";
import { createJournalRenderer } from "../src/renderers/journal-renderer.js";
import { find, installFakeDom } from "./helpers/fake-dom.js";

test("journal listing retains search, date filtering, sort, reset, deletion and editor entry points", async (t) => {
  const { body } = installFakeDom(t);
  const state = { dbReady: true, journalEntries: [
    { id: 1, target_date: "2026-09-16", content: "첫째\n산책" },
    { id: 2, target_date: "2026-09-17", content: "둘째\n**운동**" },
  ] };
  const deleted = [];
  const renderer = createJournalRenderer({ state,
    deleteJournalEntry: async (id) => { deleted.push(id); },
    setStatus() {}, loadAndRender: async () => {},
  });
  const actions = document.createElement("section");
  const panel = document.createElement("section");
  panel.className = "journal-panel";
  body.append(actions, panel);
  renderer.renderJournalActions(actions);
  renderer.renderJournalPanel(panel);
  const pages = find(panel, ".journal-pages");
  const titles = () => pages.children.map((page) => find(page, ".journal-preview-title")?.textContent);
  assert.deepEqual(titles(), ["둘째", "첫째"]);
  const search = find(actions, ".journal-search-input");
  search.value = "운동";
  await search.emit("input");
  assert.deepEqual(titles(), ["둘째"]);
  await find(actions, ".journal-clear-button").emit("click");
  const date = find(actions, ".journal-date-input");
  date.value = "2026-09-16";
  await date.emit("change");
  assert.deepEqual(titles(), ["첫째"]);
  await find(actions, ".journal-clear-button").emit("click");
  const sort = find(actions, ".journal-sort-select");
  sort.value = "oldest";
  await sort.emit("change");
  assert.deepEqual(titles(), ["첫째", "둘째"]);
  await find(pages.children[0], ".journal-delete").emit("click");
  assert.deepEqual(deleted, [1]);
  await pages.children[1].emit("click");
  assert.equal(find(body, ".journal-title-input").value, "둘째");
  assert.equal(find(body, ".journal-editor-sheet").dataset.mode, "read");
});
