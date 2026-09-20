import test from "node:test";
import assert from "node:assert/strict";
import { createDayTaskCardRenderer } from "../src/renderers/day-task-card-renderer.js";
import { installFakeDom, find } from "./helpers/fake-dom.js";
import { isCurrentDate, toDateKey } from "../src/date-utils.js";

function fixture(t) {
  installFakeDom(t);
  const rendered = [];
  const opened = [];
  const renderer = createDayTaskCardRenderer({
    createTaskStack(list) {
      const stack = document.createElement("div");
      stack.append(list);
      return stack;
    },
    isCurrentDate,
    openDetailModal: async (...args) => opened.push(args),
    renderTaskList: (...args) => rendered.push(args),
    toDateKey,
  });
  return { ...renderer, opened, rendered };
}

test("enabled day cards keep task metadata and open the daily detail", async (t) => {
  const { createDayTaskCard, opened, rendered } = fixture(t);
  const date = new Date(2026, 8, 17);
  const tasks = [{ id: 1 }];
  const card = createDayTaskCard({
    cardClass: "week-day-card",
    date,
    headingPrimary: "Thu",
    headingSecondary: "9/17",
    listClass: "week-task-list",
    now: date,
    placeholder: "Daily plan",
    tasks,
  });

  const list = find(card, ".task-list");
  assert.equal(list.dataset.periodType, "DAILY");
  assert.equal(list.dataset.targetDate, "2026-09-17");
  assert.deepEqual(rendered[0].slice(1), ["DAILY", tasks, "Daily plan"]);
  assert.match(card.className, /current-day-card/);
  await find(card, ".day-heading-link").emit("click");
  assert.deepEqual(opened, [["DAILY", date]]);
});

test("disabled month overflow cards have no task list or detail action", async (t) => {
  const { createDayTaskCard, opened, rendered } = fixture(t);
  const card = createDayTaskCard({
    cardClass: "day-card",
    date: new Date(2026, 7, 30),
    enabled: false,
    headingPrimary: "30",
    headingSecondary: "Sun",
    listClass: "day-task-list",
    now: new Date(2026, 7, 30),
    placeholder: "Plan this day",
    tasks: [],
  });

  const button = find(card, ".day-heading-link");
  assert.equal(button.disabled, true);
  assert.match(card.className, /muted-day-card/);
  assert.equal(find(card, ".task-list"), null);
  assert.ok(find(card, ".muted-day-placeholder"));
  await button.emit("click");
  assert.deepEqual(opened, []);
  assert.deepEqual(rendered, []);
});
