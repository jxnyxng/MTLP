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
import { createAppController } from "./services/app-controller.js";
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
const ui = {};

const { applyTheme } = createThemeService({ state, themes });
const {
  dateInputValue, jumpToday, loadAndRender, normalizeTimelineRange, parseDateInput,
  setStatus, shiftDate, shiftedPeriodDate, switchTab, targetFor, timelineRangeFor,
} = createAppController({
  state,
  ui,
  defaultTimelineRange: DEFAULT_TIMELINE_RANGE,
  periodTargetFor,
  shiftPeriodDate,
  periodInputValue,
  parsePeriodInput,
  titleFor,
});

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
  ui.renderThemeOptions();
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

Object.assign(ui, createJournalRenderer({
  state,
  addJournalEntry,
  deleteJournalEntry,
  updateJournalEntry,
  toDateKey,
  setStatus,
  loadAndRender,
}));

Object.assign(ui, createSettingsRenderer({
  state,
  themes,
  applyTheme,
  saveThemeId,
  setStatus,
}));

Object.assign(ui, createTaskCommandService({
  state,
  addTask,
  updateTaskBlock,
  targetFor,
  setStatus,
  loadAndRender,
}));

Object.assign(ui, createTaskRenderer({
  state,
  deleteTask,
  updateTaskContent,
  updateTaskStatus,
  selectTaskBlock: ui.selectTaskBlock,
  setStatus,
  loadAndRender,
  addTaskFromInput: ui.addTaskFromInput,
  addBlankTask: ui.addBlankTask,
  targetFor,
}));

Object.assign(ui, createTaskDragController({
  state,
  addTask,
  moveTask,
  saveTaskOrder,
  setStatus,
  loadAndRender,
}));

Object.assign(ui, createTaskDataService({
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

Object.assign(ui, createReviewService({
  state,
  hasApiKey: geminiClient.hasApiKey,
  generateReview: geminiClient.generateReview,
}));

Object.assign(ui, createTimelineRangeRenderer({
  state,
  timelineHourOptions,
  targetFor,
  saveTimelineRange,
  setStatus,
  loadAndRender,
}));

Object.assign(ui, createPanelRenderer({
  state,
  renderJournalPanel: ui.renderJournalPanel,
  openJournalEditor: ui.openJournalEditor,
  createSplitTaskStack: ui.createSplitTaskStack,
  createTaskStack: ui.createTaskStack,
  renderTaskList: ui.renderTaskList,
  titleFor,
  targetFor,
  timelineRangeFor,
  loadAndRender,
  loadTaskData: ui.loadTaskData,
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

Object.assign(ui, createShellRenderer({
  app,
  state,
  tabs,
  createTimelineRangeControls: ui.createTimelineRangeControls,
  dateInputValue,
  inputTypeFor,
  jumpToday,
  loadAndRender,
  openSettings,
  parseDateInput,
  periodLabel,
  requestReview: ui.requestReview,
  renderJournalActions: ui.renderJournalActions,
  shiftDate,
  shiftedPeriodDate,
  switchTab,
  timelineRangeFor,
  toDateKey,
}));

ui.renderShell();
ui.bindShellEvents({
  closeDetailModal: ui.closeDetailModal,
  handleTaskBlockShortcuts: ui.handleTaskBlockShortcuts,
  saveSettings,
});

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
