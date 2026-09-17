import test from "node:test";
import assert from "node:assert/strict";
import Sortable from "sortablejs";
import { createTaskDragController } from "../src/task-drag-controller.js";

function classList(initial = []) {
  const classes = new Set(initial);
  return {
    contains: (name) => classes.has(name),
    add: (...names) => names.forEach((name) => classes.add(name)),
    remove: (...names) => names.forEach((name) => classes.delete(name)),
  };
}

function item(id, position, extra = {}) {
  return {
    dataset: { id: String(id), position: String(position), content: "태스크", status: "DONE",
      periodType: "DAILY", targetDate: "2026-09-17", ...extra },
    classList: classList(["task-item"]),
    style: { setProperty() {}, removeProperty() {} },
    getBoundingClientRect: () => ({ width: 100, height: 30 }),
  };
}

function list(periodType, targetDate, children = [], extra = {}) {
  const element = { dataset: { periodType, targetDate, ...extra }, children,
    classList: classList(["task-list"]) };
  element.closest = (selector) => selector === ".task-list" ? element : null;
  return element;
}

function fixture(t, lists, overrides = {}) {
  const originalDocument = globalThis.document;
  const originalCreate = Sortable.create;
  const instances = new Map();
  const listeners = new Map();
  const calls = { add: [], move: [], order: [], status: [], renders: 0, destroyed: 0 };
  const state = { dbReady: true, isLocked: false };
  globalThis.document = {
    querySelectorAll: (selector) => selector === ".task-list" ? lists : [],
    body: { classList: classList() },
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name) => listeners.delete(name),
    elementFromPoint: () => lists.at(-1),
  };
  Sortable.create = (element, options) => {
    const instance = { options, destroy: () => { calls.destroyed++; } };
    instances.set(element, instance);
    return instance;
  };
  t.after(() => { globalThis.document = originalDocument; Sortable.create = originalCreate; });
  const controller = createTaskDragController({
    state,
    addTask: async (...args) => { calls.add.push(args); },
    moveTask: async (...args) => { calls.move.push(args); },
    saveTaskOrder: async (...args) => { calls.order.push(args); },
    setStatus: (message) => calls.status.push(message),
    loadAndRender: async () => { calls.renders++; },
    ...overrides,
  });
  controller.bindSortables();
  return { controller, state, calls, instances, listeners };
}

test("reorders save only changed rows in one batch, preserving lane and hour destinations", async (t) => {
  const first = item(1, 2000, { timeBlock: "09:00", splitLane: "1" });
  const second = item(2, 1000, { timeBlock: "09:00", splitLane: "1" });
  const third = item(3, 3000, { timeBlock: "09:00", splitLane: "1" });
  const target = list("DAILY", "2026-09-17", [first, second, third], { timeBlock: "09:00", splitLane: "1" });
  const { instances, calls } = fixture(t, [target]);
  await instances.get(target).options.onEnd({ from: target, to: target, item: first, oldDraggableIndex: 1, newDraggableIndex: 0 });
  assert.deepEqual(calls.order, [[
    { periodType: "DAILY", targetDate: "2026-09-17", timeBlock: "09:00", splitLane: "1" },
    [{ id: 1, position: 1000 }, { id: 2, position: 2000 }],
  ]]);
  assert.equal(calls.renders, 1);
  assert.deepEqual(calls.add, []);
  assert.deepEqual(calls.move, []);
});

test("cross-period movement batches the moved task with destination ordering", async (t) => {
  const moved = item(1, 1000, { periodType: "MONTHLY", targetDate: "2026-09" });
  const source = list("MONTHLY", "2026-09");
  const destination = list("YEARLY", "2027", [moved]);
  const { instances, calls } = fixture(t, [source, destination]);
  await instances.get(source).options.onEnd({ from: source, to: destination, item: moved });
  assert.deepEqual(calls.order, [[
    { periodType: "YEARLY", targetDate: "2027", timeBlock: null, splitLane: null },
    [{ id: 1, position: 1000 }],
  ]]);
  assert.deepEqual(calls.add, []);
});

test("Weekly to Daily still clones instead of moving the original task", async (t) => {
  const original = item(1, 1000, { periodType: "WEEKLY", targetDate: "2026-09-13" });
  const source = list("WEEKLY", "2026-09-13", [original]);
  const destination = list("DAILY", "2026-09-17", [item(2, 3000)], { timeBlock: "10:00", splitLane: "0" });
  const { instances, calls } = fixture(t, [source, destination]);
  const options = instances.get(source).options;
  assert.equal(options.group.pull({ el: destination }, { el: source }), "clone");
  await options.onEnd({ from: source, to: destination, item: original, pullMode: "clone" });
  assert.deepEqual(calls.add, [["태스크", "DAILY", "2026-09-17", 4000, "10:00", "0"]]);
  assert.deepEqual(calls.order, []);
  assert.deepEqual(calls.move, []);
  assert.equal(source.children[0], original);
  assert.equal(calls.renders, 1);
});

test("pointer fallback drops still append to the correct target and release pointer listeners", async (t) => {
  const moved = item(1, 1000);
  const source = list("DAILY", "2026-09-17", [moved]);
  const destination = list("MONTHLY", "2026-10", [item(2, 3000)]);
  const { instances, calls, listeners } = fixture(t, [source, destination]);
  const options = instances.get(source).options;
  options.onStart({ from: source, item: moved });
  listeners.get("pointermove")({ clientX: 10, clientY: 10 });
  await options.onEnd({ from: source, to: source, item: moved, oldDraggableIndex: 0, newDraggableIndex: 0 });
  assert.deepEqual(calls.move, [[1, "MONTHLY", "2026-10", 4000, null, null]]);
  assert.equal(listeners.size, 0);
  assert.equal(document.body.classList.contains("is-dragging-task"), false);
});

test("dropping in the original place does not save or reload", async (t) => {
  const moved = item(1, 1000);
  const source = list("DAILY", "2026-09-17", [moved]);
  const { instances, calls } = fixture(t, [source]);
  await instances.get(source).options.onEnd({ from: source, to: source, item: moved, oldDraggableIndex: 0, newDraggableIndex: 0 });
  assert.deepEqual(calls.order, []);
  assert.equal(calls.renders, 0);
});

test("sortable instances are not duplicated and are destroyed before replacing views", (t) => {
  const source = list("DAILY", "2026-09-17", [item(1, 1000)]);
  const { controller, instances, calls, listeners, state } = fixture(t, [source]);
  const original = instances.get(source);
  controller.bindSortables();
  assert.equal(instances.get(source), original);
  original.options.onStart({ from: source, item: source.children[0] });
  controller.destroySortables();
  assert.equal(calls.destroyed, 1);
  assert.equal(listeners.size, 0);
  controller.destroySortables();
  assert.equal(calls.destroyed, 1);
  state.isLocked = true;
  controller.bindSortables();
  assert.equal(instances.get(source), original);
  state.isLocked = false;
  controller.bindSortables();
  assert.notEqual(instances.get(source), original);
});

test("failed drops show failure and reload the persisted view", async (t) => {
  const moved = item(1, 2000);
  const source = list("DAILY", "2026-09-17", [moved]);
  const originalError = console.error;
  console.error = () => {};
  t.after(() => { console.error = originalError; });
  const { instances, calls } = fixture(t, [source], {
    saveTaskOrder: async () => { throw new Error("write rejected"); },
  });
  await instances.get(source).options.onEnd({ from: source, to: source, item: moved, oldDraggableIndex: 1, newDraggableIndex: 0 });
  assert.equal(calls.status.at(-1), "드래그 저장 실패");
  assert.equal(calls.renders, 1);
});
