import test from "node:test";
import assert from "node:assert/strict";
import { createAppController } from "../src/services/app-controller.js";

function fixture(overrides = {}) {
  const bodyClasses = new Map();
  const viewClasses = new Map();
  const view = {
    className: "",
    classList: { toggle: (name, value) => viewClasses.set(name, value) },
    replaceChildren(...children) { this.children = children; },
  };
  const status = { textContent: "" };
  const state = {
    activeTab: "DAILY",
    sideTab: null,
    sidePanelOpen: false,
    isEditing: true,
    isLocked: false,
    anchorDate: new Date(2026, 8, 17),
    timelineRanges: {},
    shouldAnimatePeriod: false,
  };
  const calls = [];
  const ui = {
    loadTasks: async () => calls.push("load"),
    destroySortables: () => calls.push("destroy"),
    renderTabs: () => calls.push("tabs"),
    renderViewActions: () => calls.push("actions"),
    renderPeriodNav: () => calls.push("nav"),
    renderViewHeading: (title) => calls.push(`heading:${title}`),
    createPanel: (periodType, companion = false) => ({ periodType, companion }),
    renderDetailModal: async () => calls.push("detail"),
    bindSortables: () => calls.push("bind"),
    ...overrides.ui,
  };
  const controller = createAppController({
    state,
    ui,
    defaultTimelineRange: { start: 5, end: 24 },
    periodTargetFor: (type, date) => `${type}:${date.getDate()}`,
    shiftPeriodDate: (_type, amount, date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount),
    periodInputValue: (_type, date) => String(date.getDate()),
    parsePeriodInput: (_type, value) => value === "invalid" ? null : new Date(2026, 8, Number(value)),
    titleFor: (type) => `title:${type}`,
    documentRef: {
      body: { classList: { toggle: (name, value) => bodyClasses.set(name, value) } },
      querySelector: (selector) => selector === "#view" ? view : status,
    },
  });
  return { bodyClasses, calls, controller, state, status, ui, view, viewClasses };
}

test("app controller owns navigation state and the render lifecycle", async () => {
  const f = fixture();
  f.state.sideTab = "WEEKLY";
  f.state.sidePanelOpen = true;
  await f.controller.loadAndRender();

  assert.deepEqual(f.calls, [
    "load", "destroy", "tabs", "actions", "nav", "heading:title:DAILY", "detail", "bind",
  ]);
  assert.equal(f.view.className, "split side-layout");
  assert.deepEqual(f.view.children, [
    { periodType: "DAILY", companion: false },
    { periodType: "WEEKLY", companion: true },
  ]);
  assert.equal(f.bodyClasses.get("is-editing"), true);
  assert.equal(f.viewClasses.get("side-panel-open"), true);

  await f.controller.switchTab("JOURNAL");
  assert.equal(f.state.activeTab, "JOURNAL");
  assert.equal(f.state.sideTab, null);
  assert.equal(f.state.sidePanelOpen, false);
});

test("app controller rejects invalid inputs and normalizes timeline ranges", () => {
  const f = fixture();
  assert.equal(f.controller.parseDateInput("DAILY", "invalid"), false);
  assert.equal(f.state.anchorDate.getDate(), 17);
  assert.equal(f.controller.parseDateInput("DAILY", "19"), true);
  assert.equal(f.state.anchorDate.getDate(), 19);
  assert.equal(f.state.shouldAnimatePeriod, true);
  assert.deepEqual(f.controller.normalizeTimelineRange({ start: "8", end: "20" }), { start: 8, end: 20 });
  assert.deepEqual(f.controller.normalizeTimelineRange({ start: 20, end: 8 }), { start: 5, end: 24 });
  f.controller.setStatus("ready");
  assert.equal(f.status.textContent, "ready");
});

test("a superseded app load cannot replace the newer view", async () => {
  let releaseFirst;
  let loadCount = 0;
  const firstLoad = new Promise((resolve) => { releaseFirst = resolve; });
  const f = fixture({
    ui: {
      loadTasks: async () => {
        loadCount += 1;
        if (loadCount === 1) await firstLoad;
      },
    },
  });

  const oldRender = f.controller.loadAndRender();
  await f.controller.loadAndRender();
  releaseFirst();
  await oldRender;

  assert.equal(f.calls.filter((call) => call === "bind").length, 1);
  assert.equal(f.calls.filter((call) => call === "destroy").length, 1);
});
