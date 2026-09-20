import test from "node:test";
import assert from "node:assert/strict";
import { createTaskDataService } from "../src/services/task-data-service.js";
import { decadeStartYear, futureYears, toDateKey, toMonthKey, toWeekStartDate, weekDates } from "../src/date-utils.js";

function targetFor(type, date) {
  if (type === "FUTURE") return String(decadeStartYear(date));
  if (type === "YEARLY") return String(date.getFullYear());
  if (type === "MONTHLY") return toMonthKey(date);
  if (type === "WEEKLY") return toDateKey(toWeekStartDate(date));
  return toDateKey(date);
}

function fixture(overrides = {}) {
  const state = { dbReady: true, anchorDate: new Date(2026, 8, 17), tasks: {}, timelineRanges: {} };
  const service = createTaskDataService({
    state, futureYears, targetFor, toDateKey, weekDates,
    getAllJournalEntries: async () => [{ id: 99, content: "저널" }],
    getTasks: async (type, date) => [{ id: `${type}:${date}`, target_date: date }],
    getTasksByTargetPrefix: async (type, prefix) => [{ id: `${type}:${prefix}`, target_date: prefix }],
    getTasksByTargets: async (type, dates) => dates.map((date) => ({ id: `${type}:${date}`, target_date: date })),
    getTimelineRange: async () => ({ start: 5, end: 24 }),
    normalizeTimelineRange: (range) => range,
    ...overrides,
  });
  return { state, service };
}

test("a slower previous load cannot overwrite newer tasks or timeline settings", async () => {
  const pending = new Map();
  const { state, service } = fixture({
    getTimelineRange: (date) => new Promise((resolve) => pending.set(date, resolve)),
  });
  const older = service.loadTasks();
  state.anchorDate = new Date(2026, 8, 18);
  const newer = service.loadTasks();
  pending.get("2026-09-18")({ start: 8, end: 20 });
  await newer;
  pending.get("2026-09-17")({ start: 5, end: 24 });
  await older;
  assert.equal(state.tasks.DAILY[0].target_date, "2026-09-18");
  assert.deepEqual(state.timelineRanges, { "2026-09-18": { start: 8, end: 20 } });
});

test("same-date overlapping loads also preserve the newest result", async () => {
  const pending = [];
  const { state, service } = fixture({
    getTimelineRange: () => new Promise((resolve) => pending.push(resolve)),
  });
  const older = service.loadTasks();
  const newer = service.loadTasks();
  pending[1]({ start: 8, end: 20 });
  await newer;
  pending[0]({ start: 5, end: 24 });
  await older;
  assert.deepEqual(state.timelineRanges["2026-09-17"], { start: 8, end: 20 });
});

test("mutating the anchor while loading does not commit data for another date", async () => {
  let release;
  const { state, service } = fixture({
    getTimelineRange: () => new Promise((resolve) => { release = resolve; }),
  });
  const loading = service.loadTasks();
  state.anchorDate.setDate(18);
  release({ start: 5, end: 24 });
  await loading;
  assert.deepEqual(state.tasks, {});
  assert.deepEqual(state.timelineRanges, {});
});

test("all planner periods, overview groups, journals and legacy weekly tasks remain available", async () => {
  const { service, state } = fixture({
    getTasksByTargets: async (type, dates) => type === "WEEKLY"
      ? dates.flatMap((date) => [{ id: 1, target_date: date }, { id: date, target_date: date }])
      : dates.map((date) => ({ id: `${type}:${date}`, target_date: date })),
  });
  await service.loadTasks();
  assert.deepEqual(Object.keys(state.tasks).sort(), ["DAILY", "FUTURE", "MONTHLY", "WEEKLY", "YEARLY"]);
  assert.deepEqual(state.tasks.WEEKLY.map((task) => task.id), [1, "2026-09-13", "2026-09-14"]);
  assert.equal(state.futureYearTasks.length, 10);
  assert.equal(state.yearlyMonthTasks.length, 1);
  assert.equal(state.monthDailyTasks.length, 1);
  assert.equal(state.weekDailyTasks.length, 7);
  assert.equal(state.journalEntries[0].content, "저널");
  const detail = await service.loadTaskData(new Date(2027, 0, 1));
  assert.equal(detail.tasks.DAILY[0].target_date, "2027-01-01");
  assert.equal(state.tasks.DAILY[0].target_date, "2026-09-17");
});

test("failed loads leave the previous state intact and can be retried", async () => {
  let fail = true;
  const { service, state } = fixture({
    getAllJournalEntries: async () => {
      if (fail) throw new Error("read failed");
      return [];
    },
  });
  await assert.rejects(service.loadTasks(), /read failed/);
  assert.deepEqual(state.tasks, {});
  fail = false;
  await service.loadTasks();
  assert.equal(state.tasks.DAILY[0].target_date, "2026-09-17");
});

test("loading without SQLite leaves the state intact", async () => {
  const { state, service } = fixture({ getTasks: () => { throw new Error("unexpected query"); } });
  state.dbReady = false;
  await service.loadTasks();
  assert.deepEqual(state.tasks, {});
});
