import test from "node:test";
import assert from "node:assert/strict";
import { createTimelineRangeRenderer } from "../src/renderers/timeline-range-renderer.js";
import { installFakeDom } from "./helpers/fake-dom.js";

function fixture(t, saveTimelineRange, loadAndRender = async () => {}) {
  installFakeDom(t);
  const state = { dbReady: true, timelineRanges: { "2026-09-19": { start: 5, end: 24 } } };
  const statuses = [];
  let renders = 0;
  const renderer = createTimelineRangeRenderer({
    state,
    timelineHourOptions: Array.from({ length: 25 }, (_, hour) => `${hour}:00`),
    targetFor: () => "2026-09-19",
    saveTimelineRange,
    setStatus: (message) => statuses.push(message),
    loadAndRender: async () => { renders += 1; await loadAndRender(); },
  });
  const controls = renderer.createTimelineRangeControls(new Date(2026, 8, 19), { start: 5, end: 24 });
  const [start, , end] = controls.children;
  return { state, statuses, get renders() { return renders; }, start, end };
}

test("timeline range commits state only after persistence succeeds", async (t) => {
  let saved;
  const data = fixture(t, async (target, range) => { saved = { target, range }; });
  data.start.value = "8";
  await data.start.emit("change");
  assert.deepEqual(saved, { target: "2026-09-19", range: { start: 8, end: 24 } });
  assert.deepEqual(data.state.timelineRanges["2026-09-19"], { start: 8, end: 24 });
  assert.equal(data.statuses.at(-1), "시간 범위 저장 완료");
  assert.equal(data.renders, 1);
});

test("timeline range restores controls and state when persistence fails", async (t) => {
  const originalError = console.error;
  console.error = () => {};
  t.after(() => { console.error = originalError; });
  const data = fixture(t, async () => { throw new Error("write failed"); });
  data.start.value = "8";
  await data.start.emit("change");
  assert.deepEqual(data.state.timelineRanges["2026-09-19"], { start: 5, end: 24 });
  assert.equal(data.start.value, "5");
  assert.equal(data.end.value, "24");
  assert.equal(data.statuses.at(-1), "시간 범위 저장 실패");
  assert.equal(data.renders, 0);
});

test("timeline range remains saved when only the view refresh fails", async (t) => {
  const originalError = console.error;
  console.error = () => {};
  t.after(() => { console.error = originalError; });
  const data = fixture(t, async () => {}, async () => { throw new Error("render failed"); });
  data.start.value = "8";
  await data.start.emit("change");
  assert.deepEqual(data.state.timelineRanges["2026-09-19"], { start: 8, end: 24 });
  assert.equal(data.start.value, "8");
  assert.equal(data.statuses.at(-1), "저장 완료 (화면 새로고침 실패)");
  assert.equal(data.renders, 1);
});
