import "./styles.css";
import { DEFAULT_TIMELINE_RANGE, tabs, themes, timelineHourOptions } from "./config.js";
import {
  decadeStartYear,
  futureYears,
  hourValue,
  hoursForRange,
  isCurrentDate,
  isCurrentHourBlock,
  monthWeeks,
  toDateKey,
  toMonthKey,
  toWeekStartDate,
  toYearKey,
  weekDates,
  weekdayLabel,
} from "./date-utils.js";
import { state } from "./state.js";
import { createJournalRenderer } from "./renderers/journal-renderer.js";
import { createPanelRenderer } from "./renderers/panel-renderer.js";
import { createSettingsRenderer } from "./renderers/settings-renderer.js";
import { createShellRenderer } from "./renderers/shell-renderer.js";
import { createTaskDragController } from "./task-drag-controller.js";
import { createTaskRenderer } from "./renderers/task-renderer.js";
import { createReviewService } from "./services/review-service.js";
import { createTaskDataService } from "./services/task-data-service.js";
import {
  addJournalEntry,
  addTask,
  deleteTask,
  deleteJournalEntry,
  getApiKey,
  getAllJournalEntries,
  getThemeId,
  getTasks,
  getTasksByTargetPrefix,
  getTimelineRange,
  initDb,
  moveTask,
  saveApiKey,
  saveThemeId,
  saveTimelineRange,
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

function themeById(themeId) {
  const legacyThemeIds = {
    productivity: "sage-graphite-light",
    "productivity-light": "sage-graphite-light",
    diary: "mist-blue-light",
    "diary-light": "mist-blue-light",
    study: "ink-lavender-light",
    "study-light": "ink-lavender-light",
    minimal: "sage-graphite-light",
    "minimal-light": "sage-graphite-light",
    "productivity-dark": "graphite-blue-dark",
    "diary-dark": "forest-ink-dark",
    "study-dark": "graphite-blue-dark",
    "minimal-dark": "graphite-blue-dark",
  };
  const normalizedThemeId = legacyThemeIds[themeId] ?? themeId;
  return themes.find((theme) => theme.id === normalizedThemeId) ?? themes[0];
}

function applyTheme(themeId) {
  const theme = themeById(themeId);
  state.themeId = theme.id;
  document.documentElement.dataset.theme = theme.id;
  Object.entries(theme.css).forEach(([name, value]) => {
    document.documentElement.style.setProperty(name, value);
  });
}

function normalizeTimelineRange(range) {
  const start = Number(range?.start);
  const end = Number(range?.end);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return DEFAULT_TIMELINE_RANGE;
  if (start < 0 || end > 24 || start >= end) return DEFAULT_TIMELINE_RANGE;
  return { start, end };
}

function targetFor(periodType, date = state.anchorDate) {
  if (periodType === "FUTURE") return String(decadeStartYear(date));
  if (periodType === "YEARLY") return toYearKey(date);
  if (periodType === "MONTHLY") return toMonthKey(date);
  if (periodType === "WEEKLY") return toDateKey(toWeekStartDate(date));
  if (periodType === "JOURNAL") return toDateKey(date);
  return toDateKey(date);
}

function timelineRangeFor(date, data = state) {
  const targetDate = targetFor("DAILY", date);
  return normalizeTimelineRange(data.timelineRange ?? state.timelineRanges[targetDate]);
}

function titleFor(periodType) {
  if (periodType === "FUTURE") return "Long-term Plan";
  if (periodType === "YEARLY") return "Yearly Log";
  if (periodType === "MONTHLY") return "Monthly Log";
  if (periodType === "WEEKLY") return "Weekly Log";
  if (periodType === "JOURNAL") return "Journal";
  return "Daily Log";
}

function shiftedPeriodDate(periodType, amount) {
  const next = new Date(state.anchorDate);
  if (periodType === "FUTURE") next.setFullYear(next.getFullYear() + amount * 10);
  if (periodType === "YEARLY") next.setFullYear(next.getFullYear() + amount);
  if (periodType === "MONTHLY") next.setMonth(next.getMonth() + amount);
  if (periodType === "WEEKLY") next.setDate(next.getDate() + amount * 7);
  if (periodType === "JOURNAL") next.setDate(next.getDate() + amount);
  if (periodType === "DAILY") next.setDate(next.getDate() + amount);
  return next;
}

function periodLabel(periodType, date) {
  if (periodType === "FUTURE") {
    const years = futureYears(date);
    return `${years[0]} - ${years.at(-1)}`;
  }
  if (periodType === "YEARLY") return `${date.getFullYear()}년`;
  if (periodType === "MONTHLY") {
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  }
  if (periodType === "WEEKLY") {
    const start = toWeekStartDate(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
  }
  if (periodType === "JOURNAL") return `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdayLabel(date)}`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdayLabel(date)}`;
}

function inputTypeFor(periodType) {
  if (periodType === "FUTURE") return "number";
  if (periodType === "YEARLY") return "number";
  if (periodType === "MONTHLY") return "month";
  return "date";
}

function dateInputValue(periodType) {
  if (periodType === "FUTURE") return targetFor("FUTURE");
  if (periodType === "YEARLY") return targetFor("YEARLY");
  if (periodType === "MONTHLY") return targetFor("MONTHLY");
  return toDateKey(state.anchorDate);
}

function parseDateInput(periodType, value) {
  if (!value) return;

  if (periodType === "YEARLY") {
    state.anchorDate = new Date(Number(value), 0, 1);
    state.shouldAnimatePeriod = true;
    return;
  }

  if (periodType === "FUTURE") {
    state.anchorDate = new Date(Number(value), 0, 1);
    state.shouldAnimatePeriod = true;
    return;
  }

  if (periodType === "MONTHLY") {
    const [year, month] = value.split("-").map(Number);
    state.anchorDate = new Date(year, month - 1, 1);
    state.shouldAnimatePeriod = true;
    return;
  }

  const [year, month, day] = value.split("-").map(Number);
  state.anchorDate = new Date(year, month - 1, day);
  state.shouldAnimatePeriod = true;
}

function shiftDate(periodType, amount) {
  const next = new Date(state.anchorDate);
  if (periodType === "FUTURE") next.setFullYear(next.getFullYear() + amount * 10);
  if (periodType === "YEARLY") next.setFullYear(next.getFullYear() + amount);
  if (periodType === "MONTHLY") next.setMonth(next.getMonth() + amount);
  if (periodType === "WEEKLY") next.setDate(next.getDate() + amount * 7);
  if (periodType === "JOURNAL") next.setDate(next.getDate() + amount);
  if (periodType === "DAILY") next.setDate(next.getDate() + amount);
  state.anchorDate = next;
  state.shouldAnimatePeriod = true;
}

function getNextPosition(items) {
  if (!items.length) return 1000;
  return Math.max(...items.map((item) => Number(item.position) || 0)) + 1000;
}

function taskBlockFromItem(item) {
  if (!item?.classList.contains("task-item")) return null;
  return {
    id: Number(item.dataset.id),
    content: item.dataset.content ?? "",
    status: item.dataset.status ?? "TODO",
  };
}

function selectTaskBlock(item) {
  const task = taskBlockFromItem(item);
  if (!task) return;
  state.selectedTaskId = task.id;
  document.querySelectorAll(".task-item.is-block-selected").forEach((element) => {
    element.classList.toggle("is-block-selected", Number(element.dataset.id) === task.id);
  });
  item.classList.add("is-block-selected");
  setStatus("블록 선택됨");
}

function selectedTaskItem() {
  if (!state.selectedTaskId) return null;
  return document.querySelector(`.task-item[data-id="${state.selectedTaskId}"]`);
}

function setStatus(message) {
  const status = document.querySelector("#db-status");
  if (status) status.textContent = message;
}

function tasksFor(periodType, timeBlock = null, targetDate = targetFor(periodType)) {
  const source =
    periodType === "MONTHLY"
      ? [...state.tasks.MONTHLY, ...state.yearlyMonthTasks]
      : periodType === "DAILY"
        ? [...state.tasks.DAILY, ...state.monthDailyTasks, ...state.weekDailyTasks]
        : periodType === "FUTURE"
          ? state.futureYearTasks
          : state.tasks[periodType];
  const seen = new Set();

  return source.filter((task) => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    const timeMatches = timeBlock ? task.time_block === timeBlock : !task.time_block;
    return task.target_date === targetDate && timeMatches;
  });
}

async function addTaskFromInput(
  input,
  periodType,
  timeBlock = null,
  targetDate = targetFor(periodType),
) {
  const content = input.value.trim();
  if (!content) return;

  if (!state.dbReady) {
    setStatus("SQLite가 준비되지 않아 저장할 수 없습니다.");
    return;
  }

  try {
    const sourceList = input.closest(".task-list");
    const splitLane = sourceList?.dataset.splitLane ?? null;
    await addTask(
      content,
      periodType,
      targetDate,
      sourceList
        ? calculateAppendPosition(sourceList)
        : getNextPosition(tasksFor(periodType, timeBlock, targetDate)),
      timeBlock,
      splitLane,
    );
    input.value = "";
    setStatus("저장 완료");
    await loadAndRender();
  } catch (error) {
    console.error(error);
    setStatus("저장 실패");
  }
}

async function addBlankTask(
  trigger,
  periodType,
  timeBlock = null,
  targetDate = targetFor(periodType),
) {
  if (!state.dbReady) {
    setStatus("SQLite가 준비되지 않아 저장할 수 없습니다.");
    return;
  }

  try {
    const sourceList = trigger.closest(".task-list");
    const splitLane = sourceList?.dataset.splitLane ?? null;
    const id = await addTask(
      "",
      periodType,
      targetDate,
      sourceList
        ? calculateAppendPosition(sourceList)
        : getNextPosition(tasksFor(periodType, timeBlock, targetDate)),
      timeBlock,
      splitLane,
    );
    state.selectedTaskId = null;
    state.pendingEditTaskId = id;
    setStatus("빈 블록 생성 완료");
    await loadAndRender();
  } catch (error) {
    console.error(error);
    setStatus("빈 블록 생성 실패");
  }
}

function calculateAppendPosition(list) {
  const positions = Array.from(list.children)
    .filter((child) => child.classList.contains("task-item"))
    .map((child) => Number(child.dataset.position) || 0);
  if (!positions.length) return 1000;
  return Math.max(...positions) + 1000;
}

async function copySelectedTaskBlock() {
  const item = selectedTaskItem();
  const task = taskBlockFromItem(item);
  if (!task) {
    setStatus("선택된 블록이 없습니다.");
    return;
  }

  state.copiedTaskBlock = {
    content: task.content,
    status: task.status,
  };
  setStatus("블록 복사 완료");
}

async function pasteSelectedTaskBlock() {
  const item = selectedTaskItem();
  const target = taskBlockFromItem(item);
  if (!target) {
    setStatus("대체할 블록을 선택하세요.");
    return;
  }
  if (!state.copiedTaskBlock) {
    setStatus("복사된 블록이 없습니다.");
    return;
  }
  if (!state.dbReady) {
    setStatus("SQLite가 준비되지 않아 저장할 수 없습니다.");
    return;
  }

  try {
    await updateTaskBlock(
      target.id,
      state.copiedTaskBlock.content,
      state.copiedTaskBlock.status,
    );
    setStatus("블록 대체 완료");
    await loadAndRender();
  } catch (error) {
    console.error(error);
    setStatus("블록 대체 실패");
  }
}

function isEditableTarget(target) {
  return Boolean(target.closest("input, textarea, [contenteditable='true']"));
}

async function handleTaskBlockShortcuts(event) {
  if (!event.metaKey || event.altKey || event.shiftKey || event.ctrlKey) return;
  if (isEditableTarget(event.target)) return;

  const key = event.key.toLowerCase();
  if (key === "c") {
    event.preventDefault();
    await copySelectedTaskBlock();
  }
  if (key === "v") {
    event.preventDefault();
    await pasteSelectedTaskBlock();
  }
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

  if (state.sideTab === state.activeTab || state.sideTab === "JOURNAL") {
    state.sideTab = null;
    state.sidePanelOpen = false;
  }

  document.body.classList.toggle("is-editing", state.isEditing);
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

  await renderDetailModal();
  bindSortables();
}

async function openSettings() {
  const modal = document.querySelector("#settings-modal");
  const input = document.querySelector("#api-key-input");
  const apiKeySetting = document.querySelector(".api-key-setting");
  input.value = state.dbReady ? await getApiKey() : "";
  apiKeySetting.open = false;
  renderThemeOptions();
  modal.showModal();
}

async function saveSettings() {
  const input = document.querySelector("#api-key-input");
  const apiKeySetting = document.querySelector(".api-key-setting");
  const apiKey = input.value.trim();
  if (apiKey && state.dbReady) {
    await saveApiKey(apiKey);
    apiKeySetting.open = false;
    setStatus("API Key 저장 완료");
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

({ bindSortables } = createTaskDragController({
  state,
  addTask,
  moveTask,
  setStatus,
  loadAndRender,
}));

({ loadTaskData, loadTasks } = createTaskDataService({
  state,
  futureYears,
  getAllJournalEntries,
  getTasks,
  getTasksByTargetPrefix,
  getTimelineRange,
  normalizeTimelineRange,
  targetFor,
  toDateKey,
  weekDates,
}));

({ requestReview } = createReviewService({
  state,
  getApiKey,
}));

({ closeDetailModal, createPanel, createTimelineRangeControls, renderDetailModal } = createPanelRenderer({
  state,
  timelineHourOptions,
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
  saveTimelineRange,
  setStatus,
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
} catch (error) {
  applyTheme(state.themeId);
  setStatus("Tauri 환경에서 SQLite를 초기화할 수 있습니다.");
  console.error(error);
}

await loadAndRender();
