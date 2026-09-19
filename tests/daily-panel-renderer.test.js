import test from "node:test";
import assert from "node:assert/strict";
import { createDailyPanelRenderer } from "../src/renderers/daily-panel-renderer.js";
import { installFakeDom } from "./helpers/fake-dom.js";

test("daily panel retains unscheduled tasks, visible hours and populated outside hours", (t) => {
  installFakeDom(t);
  const tasks = [
    { id: 1, time_block: null },
    { id: 2, time_block: "09:00" },
    { id: 3, time_block: "23:00" },
  ];
  const renderedLists = [];
  let summaryTasks;
  const renderer = createDailyPanelRenderer({
    state: {},
    targetFor: () => "2026-09-19",
    timelineRangeFor: () => ({ start: 8, end: 10 }),
    normalizeTimelineRange: (range) => range,
    isCurrentDate: () => false,
    isCurrentHourBlock: () => false,
    hoursForRange: () => ["08:00", "09:00"],
    hourValue: (hour) => Number(hour.slice(0, 2)),
    createTodoSummary: (_period, items) => { summaryTasks = items; return {}; },
    createPeriodOverview: () => document.createElement("section"),
    createTaskStack: (list) => list,
    renderTaskList: (list, _period, items) => renderedLists.push({ hour: list.dataset.timeBlock, items }),
  });
  const panel = document.createElement("section");
  renderer.renderDailyPanel(panel, { tasks: { DAILY: tasks } }, new Date(2026, 8, 19));
  assert.deepEqual(summaryTasks, [tasks[0]]);
  assert.deepEqual(renderedLists.map(({ hour }) => hour), ["08:00", "09:00", "23:00"]);
  assert.deepEqual(renderedLists.map(({ items }) => items), [[], [tasks[1]], [tasks[2]]]);
});
