import {
  targetFor as periodTargetFor,
  titleFor,
  shiftedPeriodDate as shiftPeriodDate,
  periodLabel,
  inputTypeFor,
  dateInputValue as periodInputValue,
  parseDateInput as parsePeriodInput,
} from "./period-utils.js";
import "./styles.css";
import { DEFAULT_TIMELINE_RANGE, tabs, themes, timelineHourOptions } from "./config.js";
import {
  futureYears,
  hourValue,
  hoursForRange,
  isCurrentDate,
  isCurrentHourBlock,
  monthWeeks,
  toDateKey,
  toWeekStartDate,
  weekDates,
} from "./date-utils.js";
import { state } from "./state.js";
import { createJournalRenderer } from "./renderers/journal-renderer.js";
import { createPanelRenderer } from "./renderers/panel-renderer.js";
import { createSettingsRenderer } from "./renderers/settings-renderer.js";
import { createShellRenderer } from "./renderers/shell-renderer.js";
import { createTaskDragController } from "./task-drag-controller.js";
import { createTaskRenderer } from "./renderers/task-renderer.js";
import { createTimelineRangeRenderer } from "./renderers/timeline-range-renderer.js";
import { createReviewService } from "./services/review-service.js";
import { createTaskDataService } from "./services/task-data-service.js";
import { createTaskCommandService } from "./services/task-command-service.js";
import { createThemeService } from "./services/theme-service.js";
import { geminiClient } from "./services/gemini-client.js";
import {
  addJournalEntry,
  addTask,
  deleteTask,
  deleteJournalEntry,
  getApiKey as getLegacyApiKey,
  getAllJournalEntries,
  getThemeId,
  getTasks,
  getTasksByTargetPrefix,
  getTasksByTargets,
  getTimelineRange,
  initDb,
  moveTask,
  deleteApiKey as deleteLegacyApiKey,
  saveThemeId,
  saveTimelineRange,
  saveTaskOrder,
  updateTaskBlock,
  updateTaskContent,
  updateTaskStatus,
  updateJournalEntry,
} from "./db.js";

const app = document.querySelector("#app");
let renderVersion = 0;
let renderJournalActions;
let renderJournalPanel;
let openJournalEditor;
let renderThemeOptions;
let closeDetailModal;
let createPanel;
let createTimelineRangeControls;
let renderDetailModal;
let createSplitTaskStack;
let createTaskStack;
let renderTaskList;
let loadTaskData;
let loadTasks;
let requestReview;
let bindShellEvents;
let renderPeriodNav;
let renderShell;
let renderTabs;
let renderViewActions;
let renderViewHeading;
let bindSortables;
let destroySortables;
let addBlankTask;
let addTaskFromInput;
let handleTaskBlockShortcuts;
let selectTaskBlock;

const { applyTheme } = createThemeService({ state, themes });

function normalizeTimelineRange(range) {
  const start = Number(range?.start);
  const end = Number(range?.end);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return DEFAULT_TIMELINE_RANGE;
  if (start < 0 || end > 24 || start >= end) return DEFAULT_TIMELINE_RANGE;
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
  if (!date) return;
  state.anchorDate = date;
  state.shouldAnimatePeriod = true;
}

function shiftDate(periodType, amount) {
  state.anchorDate = shiftedPeriodDate(periodType, amount);
  state.shouldAnimatePeriod = true;
}

function setStatus(message) {
  const status = document.querySelector("#db-status");
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
  await loadTasks();
  if (currentRender !== renderVersion) return;
  destroySortables();

  if (state.sideTab === state.activeTab || state.sideTab === "JOURNAL") {
    state.sideTab = null;
    state.sidePanelOpen = false;
  }

  document.body.classList.toggle("is-editing", state.isEditing);
  document.body.classList.toggle("is-locked", state.isLocked);
  renderTabs();
  renderViewActions({ closeSidePanel, openSidePanel });
  renderPeriodNav();
  state.shouldAnimatePeriod = false;

  renderViewHeading(titleFor(state.activeTab));

  const panels = [createPanel(state.activeTab)];
  if (state.sideTab) panels.push(createPanel(state.sideTab, true));

  const view = document.querySelector("#view");
  view.className = state.sideTab ? "split side-layout" : "single";
  view.classList.toggle("side-panel-open", state.sidePanelOpen);
  view.replaceChildren(...panels);

  await renderDetailModal(() => currentRender === renderVersion);
  if (currentRender !== renderVersion) return;
  bindSortables();
}

async function openSettings() {
  const modal = document.querySelector("#settings-modal");
  const input = document.querySelector("#api-key-input");
  const apiKeySetting = document.querySelector(".api-key-setting");
  try {
    const hasKey = state.dbReady && await geminiClient.hasApiKey();
    input.value = "";
    input.placeholder = hasKey ? "저장된 API Key를 변경하려면 새 키 입력" : "Gemini API Key";
  } catch (error) {
    console.error(error);
    input.value = "";
    setStatus("설정을 불러오지 못했습니다.");
  }
  apiKeySetting.open = false;
  renderThemeOptions();
  modal.showModal();
}

async function saveSettings() {
  const input = document.querySelector("#api-key-input");
  const apiKeySetting = document.querySelector(".api-key-setting");
  const apiKey = input.value.trim();
  if (apiKey && state.dbReady) {
    try {
      await geminiClient.saveApiKey(apiKey);
      input.value = "";
      input.placeholder = "저장된 API Key를 변경하려면 새 키 입력";
      apiKeySetting.open = false;
      setStatus("API Key 저장 완료");
    } catch (error) {
      console.error(error);
      setStatus("API Key 저장 실패");
    }
  }
}

({ openJournalEditor, renderJournalActions, renderJournalPanel } = createJournalRenderer({
  state,
  addJournalEntry,
  deleteJournalEntry,
  updateJournalEntry,
  toDateKey,
  setStatus,
  loadAndRender,
}));

({ renderThemeOptions } = createSettingsRenderer({
  state,
  themes,
  applyTheme,
  saveThemeId,
  setStatus,
}));

({ addBlankTask, addTaskFromInput, handleTaskBlockShortcuts, selectTaskBlock } =
  createTaskCommandService({
    state,
    addTask,
    updateTaskBlock,
    targetFor,
    setStatus,
    loadAndRender,
  }));

({ createSplitTaskStack, createTaskStack, renderTaskList } = createTaskRenderer({
  state,
  deleteTask,
  updateTaskContent,
  updateTaskStatus,
  selectTaskBlock,
  setStatus,
  loadAndRender,
  addTaskFromInput,
  addBlankTask,
  targetFor,
}));

({ bindSortables, destroySortables } = createTaskDragController({
  state,
  addTask,
  moveTask,
  saveTaskOrder,
  setStatus,
  loadAndRender,
}));

({ loadTaskData, loadTasks } = createTaskDataService({
  state,
  futureYears,
  getAllJournalEntries,
  getTasks,
  getTasksByTargetPrefix,
  getTasksByTargets,
  getTimelineRange,
  normalizeTimelineRange,
  targetFor,
  toDateKey,
  weekDates,
}));

({ requestReview } = createReviewService({
  state,
  hasApiKey: geminiClient.hasApiKey,
  generateReview: geminiClient.generateReview,
}));

({ createTimelineRangeControls } = createTimelineRangeRenderer({
  state,
  timelineHourOptions,
  targetFor,
  saveTimelineRange,
  setStatus,
  loadAndRender,
}));

({ closeDetailModal, createPanel, renderDetailModal } = createPanelRenderer({
  state,
  renderJournalPanel,
  openJournalEditor,
  createSplitTaskStack,
  createTaskStack,
  renderTaskList,
  titleFor,
  targetFor,
  timelineRangeFor,
  loadAndRender,
  loadTaskData,
  normalizeTimelineRange,
  futureYears,
  weekDates,
  monthWeeks,
  isCurrentDate,
  isCurrentHourBlock,
  hoursForRange,
  hourValue,
  toDateKey,
  toWeekStartDate,
}));

({
  bindShellEvents,
  renderPeriodNav,
  renderShell,
  renderTabs,
  renderViewActions,
  renderViewHeading,
} = createShellRenderer({
  app,
  state,
  tabs,
  createTimelineRangeControls,
  dateInputValue,
  inputTypeFor,
  jumpToday,
  loadAndRender,
  openSettings,
  parseDateInput,
  periodLabel,
  requestReview,
  renderJournalActions,
  shiftDate,
  shiftedPeriodDate,
  switchTab,
  timelineRangeFor,
  toDateKey,
}));

renderShell();
bindShellEvents({ closeDetailModal, handleTaskBlockShortcuts, saveSettings });

try {
  await initDb();
  state.dbReady = true;
  applyTheme(await getThemeId());
  setStatus("SQLite 준비 완료");
  try {
    const legacyApiKey = await getLegacyApiKey();
    if (legacyApiKey && !(await geminiClient.hasApiKey())) {
      await geminiClient.saveApiKey(legacyApiKey);
    }
    if (legacyApiKey) await deleteLegacyApiKey();
  } catch (error) {
    console.error(error);
    setStatus("SQLite 준비 완료 · API Key 보안 저장소 확인 필요");
  }
} catch (error) {
  applyTheme(state.themeId);
  setStatus("Tauri 환경에서 SQLite를 초기화할 수 있습니다.");
  console.error(error);
}

await loadAndRender();
