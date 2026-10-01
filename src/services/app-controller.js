export function createAppController({
  state,
  ui,
  defaultTimelineRange,
  periodTargetFor,
  shiftPeriodDate,
  periodInputValue,
  parsePeriodInput,
  titleFor,
  documentRef = document,
}) {
  let renderVersion = 0;

  function normalizeTimelineRange(range) {
    const start = Number(range?.start);
    const end = Number(range?.end);
    if (!Number.isInteger(start) || !Number.isInteger(end)) return defaultTimelineRange;
    if (start < 0 || end > 24 || start >= end) return defaultTimelineRange;
    return { start, end };
  }

  function targetFor(periodType, date = state.anchorDate) {
    return periodTargetFor(periodType, date);
  }

  function timelineRangeFor(date, data = state) {
    const targetDate = targetFor("DAILY", date);
    return normalizeTimelineRange(data.timelineRange ?? state.timelineRanges[targetDate]);
  }

  function shiftedPeriodDate(periodType, amount) {
    return shiftPeriodDate(periodType, amount, state.anchorDate);
  }

  function dateInputValue(periodType) {
    return periodInputValue(periodType, state.anchorDate);
  }

  function parseDateInput(periodType, value) {
    const date = parsePeriodInput(periodType, value);
    if (!date) return false;
    state.anchorDate = date;
    state.shouldAnimatePeriod = true;
    return true;
  }

  function shiftDate(periodType, amount) {
    state.anchorDate = shiftedPeriodDate(periodType, amount);
    state.shouldAnimatePeriod = true;
  }

  function setStatus(message) {
    const status = documentRef.querySelector("#db-status");
    if (status) status.textContent = message;
  }

  async function switchTab(tabId) {
    state.activeTab = tabId;
    if (state.sideTab === tabId || tabId === "JOURNAL") {
      state.sideTab = null;
      state.sidePanelOpen = false;
    }
    await loadAndRender();
  }

  async function openSidePanel(tabId) {
    state.sideTab = tabId;
    state.sidePanelOpen = true;
    await loadAndRender();
  }

  async function closeSidePanel() {
    state.sidePanelOpen = false;
    state.sideTab = null;
    await loadAndRender();
  }

  async function jumpToday() {
    state.anchorDate = new Date();
    state.shouldAnimatePeriod = true;
    await loadAndRender();
  }

  async function loadAndRender() {
    const currentRender = ++renderVersion;
    await ui.loadTasks();
    if (currentRender !== renderVersion) return;
    ui.destroySortables();

    if (state.sideTab === state.activeTab || state.sideTab === "JOURNAL") {
      state.sideTab = null;
      state.sidePanelOpen = false;
    }

    documentRef.body.classList.toggle("is-editing", state.isEditing);
    documentRef.body.classList.toggle("is-locked", state.isLocked);
    ui.renderTabs();
    ui.renderViewActions({ closeSidePanel, openSidePanel });
    ui.renderPeriodNav();
    state.shouldAnimatePeriod = false;
    ui.renderViewHeading(titleFor(state.activeTab));

    const panels = [ui.createPanel(state.activeTab)];
    if (state.sideTab) panels.push(ui.createPanel(state.sideTab, true));

    const view = documentRef.querySelector("#view");
    view.className = state.sideTab ? "split side-layout" : "single";
    view.classList.toggle("side-panel-open", state.sidePanelOpen);
    view.replaceChildren(...panels);

    await ui.renderDetailModal(() => currentRender === renderVersion);
    if (currentRender !== renderVersion) return;
    ui.bindSortables();
  }

  return {
    closeSidePanel,
    dateInputValue,
    jumpToday,
    loadAndRender,
    normalizeTimelineRange,
    openSidePanel,
    parseDateInput,
    setStatus,
    shiftDate,
    shiftedPeriodDate,
    switchTab,
    targetFor,
    timelineRangeFor,
  };
}
