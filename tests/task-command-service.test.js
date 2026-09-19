import test from "node:test";
import assert from "node:assert/strict";
import { createTaskCommandService } from "../src/services/task-command-service.js";

function taskItem(id, content, status = "TODO") {
  return {
    dataset: { id: String(id), content, status },
    classList: { contains: (name) => name === "task-item", add() {}, toggle() {} },
  };
}

function fixture(t) {
  const originalDocument = globalThis.document;
  const item = taskItem(7, "원본", "DONE");
  globalThis.document = {
    querySelector: () => item,
    querySelectorAll: () => [],
  };
  t.after(() => { globalThis.document = originalDocument; });
  const state = {
    dbReady: true, selectedTaskId: 7, copiedTaskBlock: null, pendingEditTaskId: null,
    tasks: { DAILY: [] }, monthDailyTasks: [], weekDailyTasks: [], yearlyMonthTasks: [], futureYearTasks: [],
  };
  const statuses = [];
  const updates = [];
  let renders = 0;
  const service = createTaskCommandService({
    state,
    addTask: async () => 9,
    updateTaskBlock: async (...args) => updates.push(args),
    targetFor: () => "2026-09-19",
    setStatus: (message) => statuses.push(message),
    loadAndRender: async () => { renders += 1; },
  });
  return { state, statuses, updates, service, get renders() { return renders; } };
}

test("task commands copy and paste the selected block through persistence", async (t) => {
  const data = fixture(t);
  await data.service.handleTaskBlockShortcuts({
    metaKey: true, altKey: false, shiftKey: false, ctrlKey: false, key: "c",
    target: { closest: () => null }, preventDefault() {},
  });
  assert.deepEqual(data.state.copiedTaskBlock, { content: "원본", status: "DONE" });
  await data.service.handleTaskBlockShortcuts({
    metaKey: true, altKey: false, shiftKey: false, ctrlKey: false, key: "v",
    target: { closest: () => null }, preventDefault() {},
  });
  assert.deepEqual(data.updates, [[7, "원본", "DONE"]]);
  assert.equal(data.statuses.at(-1), "블록 대체 완료");
  assert.equal(data.renders, 1);
});

test("task commands do not intercept shortcuts inside editable controls", async (t) => {
  const data = fixture(t);
  let prevented = false;
  await data.service.handleTaskBlockShortcuts({
    metaKey: true, altKey: false, shiftKey: false, ctrlKey: false, key: "c",
    target: { closest: () => ({}) }, preventDefault: () => { prevented = true; },
  });
  assert.equal(prevented, false);
  assert.equal(data.state.copiedTaskBlock, null);
});
