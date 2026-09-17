import test from "node:test";
import assert from "node:assert/strict";
import { calculateAppendPosition, getNextPosition, splitTasksIntoLanes } from "../src/task-layout.js";

test("legacy null and undefined lanes alternate, while saved numeric and string lanes are preserved", () => {
  const tasks = [
    { id: 1, split_lane: null }, { id: 2, split_lane: 1 },
    { id: 3 }, { id: 4, split_lane: "0" }, { id: 5, split_lane: null },
  ];
  const snapshot = structuredClone(tasks);
  assert.deepEqual(splitTasksIntoLanes(tasks).map((lane) => lane.map((task) => task.id)), [[1, 4, 5], [2, 3]]);
  assert.deepEqual(tasks, snapshot);
});

test("every task appears exactly once and retains order within its lane", () => {
  const tasks = Array.from({ length: 20 }, (_, id) => ({ id, split_lane: id < 10 ? null : id % 2 }));
  const lanes = splitTasksIntoLanes(tasks);
  assert.equal(new Set(lanes.flat().map((task) => task.id)).size, tasks.length);
  for (const lane of lanes) assert.deepEqual(lane.map((task) => task.id), lane.map((task) => task.id).sort((a, b) => a - b));
  assert.deepEqual(splitTasksIntoLanes([]), [[], []]);
});

test("append positions preserve existing values and ignore non-task rows", () => {
  assert.equal(getNextPosition([]), 1000);
  assert.equal(getNextPosition([{ position: "2500" }, { position: 1000 }]), 3500);
  assert.equal(getNextPosition([{ position: -1500 }]), -500);
  const child = (isTask, position) => ({
    classList: { contains: (name) => name === "task-item" && isTask }, dataset: { position },
  });
  assert.equal(calculateAppendPosition({ children: [child(true, "2000"), child(false, "9000")] }), 3000);
  assert.equal(calculateAppendPosition({ children: [child(false, "9000")] }), 1000);
});
