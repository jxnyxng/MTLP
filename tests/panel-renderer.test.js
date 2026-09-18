import test from "node:test";
import assert from "node:assert/strict";
import { createPanelRenderer } from "../src/renderers/panel-renderer.js";

function fixture(t) {
  const originalDocument = globalThis.document;
  const elements = new Map();
  globalThis.document = { querySelector: (selector) => {
    if (!elements.has(selector)) elements.set(selector, {
      open: false, replacements: 0, replaceChildren() { this.replacements++; },
      close() { this.open = false; },
    });
    return elements.get(selector);
  } };
  t.after(() => { globalThis.document = originalDocument; });
  const state = { detailModal: { periodType: "MONTHLY", anchorDate: new Date(2026, 8, 1) } };
  let release;
  const renderer = createPanelRenderer({ state,
    loadTaskData: () => new Promise((resolve) => { release = resolve; }),
  });
  return { state, renderer, elements, release: () => release({}) };
}

test("closing a detail modal prevents a pending load from recreating its contents", async (t) => {
  const { state, renderer, elements, release } = fixture(t);
  const loading = renderer.renderDetailModal();
  renderer.closeDetailModal();
  assert.equal(state.detailModal, null);
  release();
  await loading;
  assert.equal(elements.get("#detail-view").replacements, 1);
  assert.equal(elements.has("#detail-title"), false);
});

test("replacing the requested detail prevents an older detail from rendering", async (t) => {
  const { state, renderer, elements, release } = fixture(t);
  const loading = renderer.renderDetailModal();
  state.detailModal = { periodType: "DAILY", anchorDate: new Date(2026, 8, 18) };
  release();
  await loading;
  assert.equal(elements.get("#detail-view").replacements, 0);
  assert.equal(elements.has("#detail-title"), false);
});

test("a superseded main render cannot update the detail modal", async (t) => {
  const { renderer, elements, release } = fixture(t);
  let current = true;
  const loading = renderer.renderDetailModal(() => current);
  current = false;
  release();
  await loading;
  assert.equal(elements.get("#detail-view").replacements, 0);
  assert.equal(elements.has("#detail-title"), false);
});

test("future and yearly cards retain every target, task group and detail link", async (t) => {
  const { installFakeDom, find } = await import("./helpers/fake-dom.js");
  const { futureYears, weekDates, toDateKey } = await import("../src/date-utils.js");
  const { targetFor, titleFor } = await import("../src/period-utils.js");
  const { body } = installFakeDom(t);
  const create = document.createElement;
  document.createElement = (tag) => {
    const element = create(tag);
    element.classList.toggle = (name, on) => { if (on) element.classList.add(name); };
    return element;
  };
  const modal = create("dialog");
  modal.id = "detail-modal";
  body.append(modal);
  const now = new Date();
  const year = now.getFullYear();
  const tasks = Array.from({ length: 12 }, (_, month) => ({ id: month + 1, target_date: `${year}-${String(month + 1).padStart(2, "0")}` }));
  const years = futureYears(now);
  const yearTasks = years.map((y, index) => ({ id: 100 + index, target_date: String(y) }));
  const state = { activeTab: "DAILY", anchorDate: now, collapsedSections: new Set(),
    tasks: { FUTURE: [], YEARLY: [] }, yearlyMonthTasks: tasks, futureYearTasks: yearTasks, journalEntries: [] };
  const lists = [];
  const renderer = createPanelRenderer({ state, targetFor, titleFor, futureYears, weekDates, toDateKey,
    createSplitTaskStack: () => create("div"),
    createTaskStack: (list) => { const stack = create("div"); stack.append(list); return stack; },
    renderTaskList: (list, period, tasks, placeholder) => lists.push({ list, period, tasks, placeholder }),
    loadAndRender: async () => {},
  });
  for (const [period, gridClass, targets, expectedTasks, detailPeriod] of [
    ["FUTURE", ".year-grid", years.map(String), yearTasks, "YEARLY"],
    ["YEARLY", ".month-grid", tasks.map((task) => task.target_date), tasks, "MONTHLY"],
  ]) {
    lists.length = 0;
    const panel = renderer.createPanel(period);
    const grid = find(panel, gridClass);
    assert.equal(grid.children.length, targets.length);
    assert.deepEqual(lists.map(({ list }) => list.dataset.targetDate), targets);
    assert.deepEqual(lists.map(({ tasks }) => tasks), expectedTasks.map((task) => [task]));
    assert.ok(lists.every(({ period }) => period === detailPeriod));
    const currentIndex = period === "FUTURE" ? years.indexOf(year) : now.getMonth();
    assert.ok(grid.children[currentIndex].className.includes("current-period-card"));
    for (let index = 0; index < targets.length; index++) {
      await find(grid.children[index], ".heading-link").emit("click");
      assert.equal(state.detailModal.periodType, detailPeriod);
      assert.equal(targetFor(detailPeriod, state.detailModal.anchorDate), targets[index]);
      assert.equal(modal.open, true);
    }
  }
});
