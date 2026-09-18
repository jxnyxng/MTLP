import test from "node:test";
import assert from "node:assert/strict";
import { createTaskRenderer } from "../src/renderers/task-renderer.js";
import { installFakeDom, find } from "./helpers/fake-dom.js";

function fixture(t, { failSave = false, failRefresh = false, locked = false } = {}) {
  installFakeDom(t);
  const create = document.createElement;
  document.createElement = (tag) => {
    const element = create(tag);
    element.querySelector = (selector) => find(element, selector);
    element.classList.contains = (name) => (element.className ?? "").split(" ").includes(name);
    element.classList.remove = (name) => { element.className = (element.className ?? "").split(" ").filter((n) => n !== name).join(" "); };
    element.classList.toggle = (name, on) => on ? element.classList.add(name) : element.classList.remove(name);
    element.removeAttribute = (name) => element.attributes.delete(name);
    const append = element.append.bind(element);
    element.append = (...nodes) => { append(...nodes); for (const node of nodes) node.parent = element; };
    element.replaceWith = (node) => {
      const parent = element.parent;
      parent.childNodes[parent.childNodes.indexOf(element)] = node;
      node.parent = parent;
    };
    return element;
  };
  const task = { id: 7, content: "original", status: "TODO", period_type: "DAILY", target_date: "2026-09-18", position: 1000 };
  const writes = [], statuses = [];
  let refreshes = 0;
  const state = { dbReady: true, isLocked: locked };
  const renderer = createTaskRenderer({ state,
    updateTaskContent: async (...args) => { writes.push(args); if (failSave && writes.length === 1) throw new Error("write failed"); },
    deleteTask: async (id) => writes.push(["delete", id]),
    updateTaskStatus: async (...args) => writes.push(["status", ...args]),
    selectTaskBlock() {}, setStatus: (message) => statuses.push(message),
    loadAndRender: async () => { refreshes++; if (failRefresh) throw new Error("refresh failed"); },
    addBlankTask() {}, targetFor: () => task.target_date,
  });
  const list = document.createElement("ul");
  renderer.renderTaskList(list, "DAILY", [task], "");
  const originalError = console.error;
  console.error = () => {};
  t.after(() => { console.error = originalError; });
  return { task, writes, statuses, item: list.children[0], refreshes: () => refreshes };
}

test("saved task edits remain saved after refresh failure and cannot repeat on blur", async (t) => {
  const f = fixture(t, { failRefresh: true });
  await find(f.item, ".task-content").emit("click");
  const input = find(f.item, ".task-edit-input");
  input.value = "edited";
  await input.emit("keydown", { key: "Enter" });
  await input.emit("blur");
  assert.deepEqual(f.writes, [[7, "edited"]]);
  assert.equal(f.task.content, "edited");
  assert.equal(f.item.dataset.content, "edited");
  assert.equal(find(f.item, ".task-content").textContent, "edited");
  assert.equal(f.item.classList.contains("is-editing-task"), false);
  assert.equal(find(f.item, ".delete-button").attributes.has("disabled"), false);
  assert.equal(f.statuses.at(-1), "변경은 저장됐지만 화면을 갱신하지 못했습니다.");
});

test("failed task writes preserve editor content and can be retried", async (t) => {
  const f = fixture(t, { failSave: true });
  await find(f.item, ".task-content").emit("click");
  const input = find(f.item, ".task-edit-input");
  input.value = "retry";
  await input.emit("keydown", { key: "Enter" });
  assert.equal(f.task.content, "original");
  assert.equal(input.value, "retry");
  assert.equal(f.refreshes(), 0);
  assert.equal(f.statuses.at(-1), "수정 실패");
  await input.emit("keydown", { key: "Enter" });
  assert.equal(f.task.content, "retry");
  assert.equal(f.writes.length, 2);
});

test("task deletion and status toggles report persistence success when refresh fails", async (t) => {
  const f = fixture(t, { failRefresh: true });
  await f.item.emit("contextmenu");
  await find(f.item, ".delete-button").emit("click");
  assert.deepEqual(f.writes, [["status", 7, "DONE"], ["delete", 7]]);
  assert.equal(f.statuses.includes("상태 저장 실패"), false);
  assert.equal(f.statuses.includes("삭제 실패"), false);
});

test("locked task lists retain content and do not register mutation handlers", async (t) => {
  const f = fixture(t, { locked: true });
  await f.item.emit("contextmenu");
  await find(f.item, ".delete-button").emit("click");
  await find(f.item, ".task-content").emit("click");
  assert.deepEqual(f.writes, []);
  assert.equal(find(f.item, ".task-content").textContent, "original");
  assert.equal(find(f.item, ".task-edit-input"), null);
});
