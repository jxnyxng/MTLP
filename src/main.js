import Sortable from "sortablejs";
import "./styles.css";
import {
  addTask,
  deleteTask,
  getApiKey,
  getThemeId,
  getTasks,
  getTasksByTargetPrefix,
  getTimelineRange,
  initDb,
  moveTask,
  saveApiKey,
  saveThemeId,
  saveTimelineRange,
  updateTaskStatus,
} from "./db.js";

const tabs = [
  { id: "FUTURE", label: "Long-term", shortLabel: "L" },
  { id: "YEARLY", label: "Yearly", shortLabel: "Y" },
  { id: "MONTHLY", label: "Monthly", shortLabel: "M" },
  { id: "WEEKLY", label: "Weekly", shortLabel: "W" },
  { id: "DAILY", label: "Daily", shortLabel: "D" },
];

const DEFAULT_TIMELINE_RANGE = { start: 5, end: 24 };
const timelineHourOptions = Array.from({ length: 25 }, (_, index) => {
  return `${String(index).padStart(2, "0")}:00`;
});

const themes = [
  {
    id: "productivity-light",
    mode: "light",
    name: "Focus Navy Light",
    description: "Classic Navy / Sage Green",
    primary: "#1E293B",
    secondary: "#86EFAC",
    background: "#F8FAFC",
    css: {
      "--color-bg": "#F8FAFC",
      "--color-bg-rgb": "248 250 252",
      "--color-surface": "#FFFFFF",
      "--color-surface-muted": "#F1F5F9",
      "--color-panel": "#FFFFFF",
      "--color-sidebar": "#F1F5F9",
      "--color-sidebar-text": "#334155",
      "--color-text": "#111827",
      "--color-muted": "#64748B",
      "--color-subtle": "#94A3B8",
      "--color-border": "#D7DEE8",
      "--color-border-strong": "#B8C3D1",
      "--color-primary": "#334155",
      "--color-primary-text": "#FFFFFF",
      "--color-primary-soft": "#E8EDF3",
      "--color-secondary": "#A7D7B6",
      "--color-secondary-soft": "#EEF8F1",
      "--color-input": "#FFFFFF",
      "--color-danger": "#DC2626",
      "--color-danger-soft": "#FEE2E2",
      "--shadow-panel": "0 1px 2px rgb(15 23 42 / 4%)",
    },
  },
  {
    id: "diary-light",
    mode: "light",
    name: "Teatime Mild Light",
    description: "Terracotta / Butter Yellow",
    primary: "#C2410C",
    secondary: "#FEF08A",
    background: "#FAF8F5",
    css: {
      "--color-bg": "#FAF8F5",
      "--color-bg-rgb": "250 248 245",
      "--color-surface": "#FFFDF8",
      "--color-surface-muted": "#F6F0E9",
      "--color-panel": "#FFFDF8",
      "--color-sidebar": "#F3E9DF",
      "--color-sidebar-text": "#6F4A3A",
      "--color-text": "#292524",
      "--color-muted": "#78716C",
      "--color-subtle": "#A8A29E",
      "--color-border": "#E7DCCF",
      "--color-border-strong": "#D6C5B4",
      "--color-primary": "#9A5A3D",
      "--color-primary-text": "#FFFDF8",
      "--color-primary-soft": "#F1E2D7",
      "--color-secondary": "#E9D981",
      "--color-secondary-soft": "#FBF4CF",
      "--color-input": "#FFFFFF",
      "--color-danger": "#BE123C",
      "--color-danger-soft": "#FFE4E6",
      "--shadow-panel": "0 1px 2px rgb(124 45 18 / 5%)",
    },
  },
  {
    id: "study-light",
    mode: "light",
    name: "Calm Study Light",
    description: "Muted Lavender / Soft Mint",
    primary: "#6366F1",
    secondary: "#99F6E4",
    background: "#FFFFFF",
    css: {
      "--color-bg": "#FFFFFF",
      "--color-bg-rgb": "255 255 255",
      "--color-surface": "#FFFFFF",
      "--color-surface-muted": "#F8FAFC",
      "--color-panel": "#FFFFFF",
      "--color-sidebar": "#F1F2FB",
      "--color-sidebar-text": "#41466F",
      "--color-text": "#1F2937",
      "--color-muted": "#64748B",
      "--color-subtle": "#94A3B8",
      "--color-border": "#DDE2F1",
      "--color-border-strong": "#BFC7E6",
      "--color-primary": "#6B6FA8",
      "--color-primary-text": "#FFFFFF",
      "--color-primary-soft": "#E9EBF8",
      "--color-secondary": "#A9DDD4",
      "--color-secondary-soft": "#EAF8F5",
      "--color-input": "#FFFFFF",
      "--color-danger": "#E11D48",
      "--color-danger-soft": "#FFE4E6",
      "--shadow-panel": "0 1px 2px rgb(49 46 129 / 5%)",
    },
  },
  {
    id: "minimal-light",
    mode: "light",
    name: "Mono Charcoal Light",
    description: "Charcoal / Slate Gray",
    primary: "#111827",
    secondary: "#9CA3AF",
    background: "#F9FAFB",
    css: {
      "--color-bg": "#F9FAFB",
      "--color-bg-rgb": "249 250 251",
      "--color-surface": "#FFFFFF",
      "--color-surface-muted": "#F3F4F6",
      "--color-panel": "#FFFFFF",
      "--color-sidebar": "#F3F4F6",
      "--color-sidebar-text": "#374151",
      "--color-text": "#111827",
      "--color-muted": "#6B7280",
      "--color-subtle": "#9CA3AF",
      "--color-border": "#DADDE2",
      "--color-border-strong": "#B8BEC8",
      "--color-primary": "#374151",
      "--color-primary-text": "#FFFFFF",
      "--color-primary-soft": "#E8EAEE",
      "--color-secondary": "#B7BCC5",
      "--color-secondary-soft": "#F4F5F7",
      "--color-input": "#FFFFFF",
      "--color-danger": "#B91C1C",
      "--color-danger-soft": "#FEE2E2",
      "--shadow-panel": "0 1px 2px rgb(17 24 39 / 4%)",
    },
  },
  {
    id: "productivity-dark",
    mode: "dark",
    name: "Focus Navy Dark",
    description: "Classic Navy / Sage Green",
    primary: "#1E293B",
    secondary: "#86EFAC",
    background: "#111827",
    css: {
      "--color-bg": "#111827",
      "--color-bg-rgb": "17 24 39",
      "--color-surface": "#1F2937",
      "--color-surface-muted": "#263244",
      "--color-panel": "#182131",
      "--color-sidebar": "#0F172A",
      "--color-sidebar-text": "#CBD5E1",
      "--color-text": "#E5E7EB",
      "--color-muted": "#A0AEC0",
      "--color-subtle": "#718096",
      "--color-border": "#344258",
      "--color-border-strong": "#475569",
      "--color-primary": "#CBD5E1",
      "--color-primary-text": "#111827",
      "--color-primary-soft": "#263244",
      "--color-secondary": "#8FCFA3",
      "--color-secondary-soft": "#1D3B2C",
      "--color-input": "#111827",
      "--color-danger": "#FCA5A5",
      "--color-danger-soft": "#3B1F26",
      "--shadow-panel": "0 1px 2px rgb(0 0 0 / 18%)",
    },
  },
  {
    id: "diary-dark",
    mode: "dark",
    name: "Teatime Mild Dark",
    description: "Terracotta / Butter Yellow",
    primary: "#C2410C",
    secondary: "#FEF08A",
    background: "#1C1917",
    css: {
      "--color-bg": "#1C1917",
      "--color-bg-rgb": "28 25 23",
      "--color-surface": "#292524",
      "--color-surface-muted": "#332C27",
      "--color-panel": "#241F1C",
      "--color-sidebar": "#2A211D",
      "--color-sidebar-text": "#E7D3C4",
      "--color-text": "#F5EFE7",
      "--color-muted": "#C9B8AA",
      "--color-subtle": "#99887D",
      "--color-border": "#473B34",
      "--color-border-strong": "#5C4B41",
      "--color-primary": "#D6A28B",
      "--color-primary-text": "#241F1C",
      "--color-primary-soft": "#3A2B25",
      "--color-secondary": "#D9CB82",
      "--color-secondary-soft": "#3A3420",
      "--color-input": "#1C1917",
      "--color-danger": "#FDA4AF",
      "--color-danger-soft": "#3D2028",
      "--shadow-panel": "0 1px 2px rgb(0 0 0 / 18%)",
    },
  },
  {
    id: "study-dark",
    mode: "dark",
    name: "Calm Study Dark",
    description: "Muted Lavender / Soft Mint",
    primary: "#6366F1",
    secondary: "#99F6E4",
    background: "#1E1B4B",
    css: {
      "--color-bg": "#1E1B4B",
      "--color-bg-rgb": "30 27 75",
      "--color-surface": "#272456",
      "--color-surface-muted": "#302D63",
      "--color-panel": "#242151",
      "--color-sidebar": "#1A1842",
      "--color-sidebar-text": "#DADDF7",
      "--color-text": "#EEF2FF",
      "--color-muted": "#B8C0E0",
      "--color-subtle": "#8D96BF",
      "--color-border": "#41406D",
      "--color-border-strong": "#56558A",
      "--color-primary": "#B8BBE8",
      "--color-primary-text": "#1E1B4B",
      "--color-primary-soft": "#343164",
      "--color-secondary": "#9AD9CF",
      "--color-secondary-soft": "#1F4546",
      "--color-input": "#1E1B4B",
      "--color-danger": "#FDA4AF",
      "--color-danger-soft": "#432130",
      "--shadow-panel": "0 1px 2px rgb(0 0 0 / 18%)",
    },
  },
  {
    id: "minimal-dark",
    mode: "dark",
    name: "Mono Charcoal Dark",
    description: "Charcoal / Slate Gray",
    primary: "#111827",
    secondary: "#9CA3AF",
    background: "#030712",
    css: {
      "--color-bg": "#030712",
      "--color-bg-rgb": "3 7 18",
      "--color-surface": "#111827",
      "--color-surface-muted": "#1F2937",
      "--color-panel": "#0B1120",
      "--color-sidebar": "#080D19",
      "--color-sidebar-text": "#D1D5DB",
      "--color-text": "#E5E7EB",
      "--color-muted": "#A6ADB8",
      "--color-subtle": "#7A828F",
      "--color-border": "#293241",
      "--color-border-strong": "#3B4556",
      "--color-primary": "#D1D5DB",
      "--color-primary-text": "#030712",
      "--color-primary-soft": "#1F2937",
      "--color-secondary": "#A6ADB8",
      "--color-secondary-soft": "#1A2230",
      "--color-input": "#030712",
      "--color-danger": "#FCA5A5",
      "--color-danger-soft": "#341B22",
      "--shadow-panel": "0 1px 2px rgb(0 0 0 / 20%)",
    },
  },
];

const state = {
  activeTab: "DAILY",
  sideTab: null,
  isEditing: false,
  dbReady: false,
  themeId: "productivity-light",
  anchorDate: new Date(),
  tasks: {
    FUTURE: [],
    YEARLY: [],
    MONTHLY: [],
    WEEKLY: [],
    DAILY: [],
  },
  futureYearTasks: [],
  yearlyMonthTasks: [],
  monthDailyTasks: [],
  weekDailyTasks: [],
  timelineRanges: {},
  shouldAnimatePeriod: false,
  detailModal: null,
};

const app = document.querySelector("#app");
let dragSourceList = null;
let pendingDropList = null;

function themeById(themeId) {
  const legacyThemeIds = {
    productivity: "productivity-light",
    diary: "diary-light",
    study: "study-light",
    minimal: "minimal-light",
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

function hourLabel(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function hourValue(timeBlock) {
  return Number(timeBlock?.split(":")[0]);
}

function hoursForRange(range) {
  const normalized = normalizeTimelineRange(range);
  return Array.from(
    { length: normalized.end - normalized.start + 1 },
    (_, index) => hourLabel(normalized.start + index),
  );
}

function timelineRangeFor(date, data = state) {
  const targetDate = targetFor("DAILY", date);
  return normalizeTimelineRange(data.timelineRange ?? state.timelineRanges[targetDate]);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function toYearKey(date) {
  return String(date.getFullYear());
}

function decadeStartYear(date = state.anchorDate) {
  return Math.floor(date.getFullYear() / 10) * 10;
}

function futureYears(date = state.anchorDate) {
  const start = decadeStartYear(date);
  return Array.from({ length: 10 }, (_, index) => start + index);
}

function toWeekStartDate(date) {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function targetFor(periodType, date = state.anchorDate) {
  if (periodType === "FUTURE") return String(decadeStartYear(date));
  if (periodType === "YEARLY") return toYearKey(date);
  if (periodType === "MONTHLY") return toMonthKey(date);
  if (periodType === "WEEKLY") return toDateKey(toWeekStartDate(date));
  return toDateKey(date);
}

function dateFromKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function daysInMonth(date = state.anchorDate) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function weekDates(date = state.anchorDate) {
  const start = toWeekStartDate(date);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function monthWeeks(date = state.anchorDate) {
  const weeks = [];
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const cursor = toWeekStartDate(firstDay);
  const lastWeekStart = toWeekStartDate(lastDay);

  while (cursor <= lastWeekStart) {
    weeks.push({
      targetDate: toDateKey(cursor),
      anchorDate: new Date(cursor),
      days: weekDates(cursor),
    });
    cursor.setDate(cursor.getDate() + 7);
  }

  return weeks;
}

function titleFor(periodType) {
  if (periodType === "FUTURE") return "Long-term Plan";
  if (periodType === "YEARLY") return "Yearly Log";
  if (periodType === "MONTHLY") return "Monthly Log";
  if (periodType === "WEEKLY") return "Weekly Log";
  return "Daily Log";
}

function rangeLabelFor(periodType) {
  if (periodType === "FUTURE") {
    const years = futureYears(state.anchorDate);
    return `${years[0]} - ${years.at(-1)}`;
  }
  if (periodType === "YEARLY") return targetFor("YEARLY");
  if (periodType === "MONTHLY") return targetFor("MONTHLY");
  if (periodType === "WEEKLY") {
    const start = toWeekStartDate(state.anchorDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${toDateKey(start)} - ${toDateKey(end)}`;
  }
  return targetFor("DAILY");
}

function shiftedPeriodDate(periodType, amount) {
  const next = new Date(state.anchorDate);
  if (periodType === "FUTURE") next.setFullYear(next.getFullYear() + amount * 10);
  if (periodType === "YEARLY") next.setFullYear(next.getFullYear() + amount);
  if (periodType === "MONTHLY") next.setMonth(next.getMonth() + amount);
  if (periodType === "WEEKLY") next.setDate(next.getDate() + amount * 7);
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
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
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
  if (periodType === "DAILY") next.setDate(next.getDate() + amount);
  state.anchorDate = next;
  state.shouldAnimatePeriod = true;
}

function getNextPosition(items) {
  if (!items.length) return 1000;
  return Math.max(...items.map((item) => Number(item.position) || 0)) + 1000;
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
    await addTask(
      content,
      periodType,
      targetDate,
      sourceList
        ? calculateAppendPosition(sourceList)
        : getNextPosition(tasksFor(periodType, timeBlock, targetDate)),
      timeBlock,
    );
    input.value = "";
    setStatus("저장 완료");
    await loadAndRender();
  } catch (error) {
    console.error(error);
    setStatus("저장 실패");
  }
}

function calculateDropPosition(list, item) {
  const taskItems = Array.from(list.children).filter((child) =>
    child.classList.contains("task-item"),
  );
  const index = taskItems.indexOf(item);
  const previous = index > 0 ? taskItems[index - 1] : null;
  const next = index >= 0 ? taskItems[index + 1] : null;

  const previousPosition = previous?.classList.contains("task-item")
    ? Number(previous.dataset.position)
    : null;
  const nextPosition = next?.classList.contains("task-item")
    ? Number(next.dataset.position)
    : null;

  if (previousPosition !== null && nextPosition !== null) {
    return Math.floor((previousPosition + nextPosition) / 2);
  }

  if (previousPosition !== null) return previousPosition + 1000;
  if (nextPosition !== null) return Math.max(1, Math.floor(nextPosition / 2));
  return 1000;
}

function calculateAppendPosition(list) {
  const positions = Array.from(list.children)
    .filter((child) => child.classList.contains("task-item"))
    .map((child) => Number(child.dataset.position) || 0);
  if (!positions.length) return 1000;
  return Math.max(...positions) + 1000;
}

function dropTargetFor(list) {
  return {
    periodType: list.dataset.periodType,
    targetDate: list.dataset.targetDate,
    timeBlock: list.dataset.timeBlock ?? null,
  };
}

function clearDropTargets({ resetDrag = false } = {}) {
  document.querySelectorAll(".drop-target, .drop-list-target, .reorder-list-target").forEach((element) => {
    element.classList.remove("drop-target", "drop-list-target", "reorder-list-target");
  });
  if (resetDrag) {
    document.body.classList.remove("is-dragging-task");
    dragSourceList = null;
    pendingDropList = null;
  }
}

function markDropTarget(list) {
  clearDropTargets();
  if (list?.classList.contains("task-list")) {
    list.classList.add(list === dragSourceList ? "reorder-list-target" : "drop-list-target");
  }
  const target =
    list?.closest(
      ".hour-row, .year-card, .month-card, .day-card, .week-day-card, .period-staging-card",
    ) ?? list;
  if (target) target.classList.add("drop-target");
}

function insertionDirection(event) {
  if (event.related?.classList.contains("add-task-row")) return -1;
  if (!event.related?.classList.contains("task-item")) return true;

  const pointerY = event.originalEvent?.clientY;
  if (typeof pointerY !== "number") return true;

  const rect = event.related.getBoundingClientRect();
  return pointerY < rect.top + rect.height / 2 ? -1 : 1;
}

async function saveDroppedTask(event) {
  if (!state.dbReady) return;

  const fromType = event.from.dataset.periodType;
  const target = dropTargetFor(event.to);
  const position = event.position ?? calculateDropPosition(event.to, event.item);

  try {
    if (event.pullMode === "clone" || (fromType === "WEEKLY" && target.periodType === "DAILY")) {
      await addTask(
        event.item.dataset.content,
        "DAILY",
        target.targetDate,
        position,
        target.timeBlock,
      );
      setStatus("Daily로 복사 완료");
    } else {
      await moveTask(
        Number(event.item.dataset.id),
        target.periodType,
        target.targetDate,
        position,
        target.timeBlock,
      );
      setStatus("이동 저장 완료");
    }
    await loadAndRender();
  } catch (error) {
    console.error(error);
    setStatus("드래그 저장 실패");
    await loadAndRender();
  }
}

function renderShell() {
  app.innerHTML = `
    <main class="shell" data-sidebar-collapsed="false">
      <aside class="sidebar">
        <div class="sidebar-head">
          <button class="icon-button" id="sidebar-toggle" type="button" aria-label="사이드바 접기">☰</button>
          <div class="brand">
            <strong>MTLP</strong>
            <span>My Tiny Local Planner</span>
          </div>
        </div>
        <nav class="tabs" aria-label="Planner views"></nav>
        <div class="sidebar-actions">
          <button id="review-button" type="button">AI 회고 요약</button>
          <button id="settings-button" type="button">설정</button>
        </div>
      </aside>
      <section class="workspace">
        <header class="topbar">
          <div class="topbar-title">
            <h1 id="view-title"></h1>
            <p id="view-meta"></p>
          </div>
          <section id="period-nav" class="period-nav"></section>
          <p id="db-status">SQLite 초기화 중...</p>
        </header>
        <section id="view-actions" class="view-actions"></section>
        <section id="view"></section>
        <section id="ai-summary" class="summary" hidden></section>
      </section>
    </main>
    <dialog id="settings-modal">
      <form method="dialog" class="modal">
        <h2>설정</h2>
        <fieldset class="theme-settings">
          <legend>테마</legend>
          <div id="theme-options" class="theme-options"></div>
        </fieldset>
        <label>
          Gemini API Key
          <input id="api-key-input" type="password" autocomplete="off" />
        </label>
        <div class="modal-actions">
          <button value="cancel" type="submit">닫기</button>
          <button id="save-api-key" value="default" type="button">저장</button>
        </div>
      </form>
    </dialog>
    <dialog id="detail-modal">
      <section class="detail-modal">
        <header class="detail-modal-head">
          <div>
            <h2 id="detail-title"></h2>
            <p id="detail-meta"></p>
          </div>
          <button id="detail-close" class="icon-button" type="button" aria-label="닫기">×</button>
        </header>
        <section id="detail-view"></section>
      </section>
    </dialog>
  `;
}

function renderTabs() {
  const nav = document.querySelector(".tabs");
  nav.replaceChildren(
    ...tabs.map((tab) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = tab.label;
      button.className = tab.id === state.activeTab ? "active" : "";
      button.addEventListener("click", async () => {
        state.activeTab = tab.id;
        if (state.sideTab === tab.id) state.sideTab = null;
        await loadAndRender();
      });
      return button;
    }),
  );
}

function renderThemeOptions() {
  const options = document.querySelector("#theme-options");
  if (!options) return;

  options.replaceChildren(
    createThemeGroup("라이트 테마", themes.filter((theme) => theme.mode === "light")),
    createThemeGroup("다크 테마", themes.filter((theme) => theme.mode === "dark")),
  );
}

function createThemeGroup(title, themeList) {
  const group = document.createElement("section");
  group.className = "theme-group";

  const heading = document.createElement("h3");
  heading.textContent = title;

  const grid = document.createElement("div");
  grid.className = "theme-grid";
  grid.append(...themeList.map(createThemeOption));

  group.append(heading, grid);
  return group;
}

function createThemeOption(theme) {
  const label = document.createElement("label");
  label.className = "theme-option";
  label.style.setProperty("--theme-primary", theme.primary);
  label.style.setProperty("--theme-secondary", theme.secondary);
  label.style.setProperty("--theme-bg", theme.background);

  const input = document.createElement("input");
  input.type = "radio";
  input.name = "theme";
  input.value = theme.id;
  input.checked = theme.id === state.themeId;

  const sample = document.createElement("span");
  sample.className = "theme-swatch";
  sample.setAttribute("aria-hidden", "true");
  sample.innerHTML = "<i></i><i></i><i></i>";

  const text = document.createElement("span");
  text.className = "theme-option-text";
  const name = document.createElement("strong");
  name.textContent = theme.name;
  const description = document.createElement("small");
  description.textContent = theme.description;

  text.append(name, description);

  input.addEventListener("change", async () => {
    applyTheme(theme.id);
    renderThemeOptions();
    if (state.dbReady) {
      await saveThemeId(theme.id);
      setStatus("테마 저장 완료");
    }
  });

  label.append(input, sample, text);
  return label;
}

function renderViewActions() {
  const actions = document.querySelector("#view-actions");
  const editModeButton = document.createElement("button");
  editModeButton.type = "button";
  editModeButton.className = "edit-mode-button";
  editModeButton.textContent = state.isEditing ? "완료" : "수정";
  editModeButton.title = state.isEditing ? "수정 완료" : "수정 모드로 전환";
  editModeButton.setAttribute(
    "aria-label",
    state.isEditing ? "수정 완료" : "수정 모드로 전환",
  );
  editModeButton.setAttribute("aria-pressed", String(state.isEditing));
  editModeButton.addEventListener("click", async () => {
    state.isEditing = !state.isEditing;
    await loadAndRender();
  });

  const companionButtons = tabs
    .filter((tab) => tab.id !== state.activeTab && tab.id !== state.sideTab)
    .map((tab) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = tab.shortLabel;
      button.title = `${tab.label} 함께 보기`;
      button.setAttribute("aria-label", `${tab.label} 함께 보기`);
      button.addEventListener("click", async () => {
        state.sideTab = tab.id;
        await loadAndRender();
      });
      return button;
    });

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = ">";
  closeButton.title = "우측 닫기";
  closeButton.setAttribute("aria-label", "우측 닫기");
  closeButton.hidden = !state.sideTab;
  closeButton.addEventListener("click", async () => {
    state.sideTab = null;
    await loadAndRender();
  });

  actions.replaceChildren(editModeButton, ...companionButtons, closeButton);
}

function renderPeriodNav() {
  const nav = document.querySelector("#period-nav");
  nav.replaceChildren();
  renderDateControls(nav, state.activeTab);
}

function renderDateControls(container, periodType) {
  const controls = document.createElement("div");
  controls.className = "date-carousel";
  if (state.shouldAnimatePeriod) controls.classList.add("animate-period");

  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "period-card side-card";
  previous.textContent = "‹";
  previous.setAttribute("aria-label", `${periodLabel(periodType, shiftedPeriodDate(periodType, -1))}로 이동`);
  previous.title = "이전";
  previous.addEventListener("click", async () => {
    shiftDate(periodType, -1);
    await loadAndRender();
  });

  const currentWrap = document.createElement("div");
  currentWrap.className = "current-period";

  const current = document.createElement("button");
  current.type = "button";
  current.className = "period-card current-card";
  current.textContent = periodLabel(periodType, state.anchorDate);
  current.title = "직접 입력";

  const picker = document.createElement("input");
  picker.className = "period-input";
  picker.type = inputTypeFor(periodType);
  picker.value = dateInputValue(periodType);
  picker.hidden = true;
  if (periodType === "FUTURE" || periodType === "YEARLY") {
    picker.min = "1900";
    picker.max = "2100";
  }

  current.addEventListener("click", () => {
    current.hidden = true;
    picker.hidden = false;
    picker.focus();
    picker.select();
  });
  picker.addEventListener("change", async () => {
    parseDateInput(periodType, picker.value);
    await loadAndRender();
  });
  picker.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    parseDateInput(periodType, picker.value);
    await loadAndRender();
  });
  picker.addEventListener("blur", () => {
    picker.hidden = true;
    current.hidden = false;
  });

  const next = document.createElement("button");
  next.type = "button";
  next.className = "period-card side-card";
  next.textContent = "›";
  next.setAttribute("aria-label", `${periodLabel(periodType, shiftedPeriodDate(periodType, 1))}로 이동`);
  next.title = "다음";
  next.addEventListener("click", async () => {
    shiftDate(periodType, 1);
    await loadAndRender();
  });

  const todayButton = document.createElement("button");
  todayButton.type = "button";
  todayButton.textContent = "Today";
  todayButton.className = "today-button";
  todayButton.addEventListener("click", async () => {
    state.anchorDate = new Date();
    state.shouldAnimatePeriod = true;
    await loadAndRender();
  });

  currentWrap.append(current, picker, todayButton);
  controls.append(previous, currentWrap, next);
  container.append(controls);
}

function createTaskItem(task) {
  const item = document.createElement("li");
  item.className = `task-item status-${task.status.toLowerCase()}`;
  item.dataset.id = task.id;
  item.dataset.position = task.position;
  item.dataset.content = task.content;
  item.dataset.periodType = task.period_type;

  const handle = document.createElement("button");
  handle.className = "drag-handle";
  handle.type = "button";
  handle.setAttribute("aria-label", "드래그해서 이동");
  handle.title = "드래그해서 이동";

  const bullet = document.createElement("span");
  bullet.className = "bullet";
  bullet.textContent = task.status === "DONE" ? "×" : task.status === "CANCELLED" ? "－" : "•";

  const content = document.createElement("span");
  content.className = "task-content";
  content.textContent = task.content;

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.type = "button";
  deleteButton.textContent = "×";
  deleteButton.title = "삭제";

  if (state.isEditing) {
    deleteButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (!state.dbReady) return;

      try {
        await deleteTask(task.id);
        setStatus("삭제 완료");
        await loadAndRender();
      } catch (error) {
        console.error(error);
        setStatus("삭제 실패");
      }
    });

    item.addEventListener("contextmenu", async (event) => {
      event.preventDefault();
      if (!state.dbReady) return;

      try {
        await updateTaskStatus(task.id, task.status === "DONE" ? "TODO" : "DONE");
        setStatus("상태 저장 완료");
        await loadAndRender();
      } catch (error) {
        console.error(error);
        setStatus("상태 저장 실패");
      }
    });
  }

  item.append(handle, bullet, content, deleteButton);
  return item;
}

function resizeEntryInput(input) {
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
}

function createEntryRow(
  periodType,
  timeBlock = null,
  targetDate = targetFor(periodType),
) {
  const row = document.createElement("li");
  row.className = "entry-row";

  const input = document.createElement("textarea");
  input.rows = 1;
  input.addEventListener("input", () => resizeEntryInput(input));
  input.addEventListener("blur", () => {
    requestAnimationFrame(() => {
      if (input.value.trim()) return;
      row.replaceWith(createEntryInput(periodType, null, timeBlock, targetDate));
    });
  });
  input.addEventListener("keydown", async (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      row.replaceWith(createEntryInput(periodType, null, timeBlock, targetDate));
      return;
    }
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    event.preventDefault();
    await addTaskFromInput(input, periodType, timeBlock, targetDate);
    resizeEntryInput(input);
  });

  row.append(input);
  requestAnimationFrame(() => resizeEntryInput(input));
  return row;
}

function createEntryInput(
  periodType,
  _placeholder,
  timeBlock = null,
  targetDate = targetFor(periodType),
) {
  const row = document.createElement("li");
  row.className = "add-task-row";

  const button = document.createElement("button");
  button.className = "add-task-button";
  button.type = "button";
  button.textContent = "+";
  button.setAttribute("aria-label", "할 일 추가");
  button.addEventListener("click", () => {
    const row = createEntryRow(periodType, timeBlock, targetDate);
    button.closest(".add-task-row").replaceWith(row);
    row.querySelector("textarea").focus();
  });
  row.append(button);
  return row;
}

function createEmptyReadItem() {
  const row = document.createElement("li");
  row.className = "empty-read-row";
  row.setAttribute("aria-hidden", "true");
  return row;
}

function renderTaskList(list, periodType, tasks, placeholder) {
  const taskItems = tasks.map(createTaskItem);
  if (!state.isEditing) {
    list.replaceChildren(...(taskItems.length ? taskItems : [createEmptyReadItem()]));
    return;
  }

  list.replaceChildren(
    ...taskItems,
    createEntryInput(periodType, placeholder, list.dataset.timeBlock ?? null, list.dataset.targetDate),
  );
}

function createTaskStack(list) {
  const stack = document.createElement("div");
  stack.className = "task-stack";
  stack.append(list);
  return stack;
}

function createPanel(
  periodType,
  isCompanion = false,
  data = state,
  anchorDate = state.anchorDate,
  isDetail = false,
) {
  const panel = document.createElement("section");
  panel.className = `panel ${periodType.toLowerCase()}-panel`;
  if (isCompanion) panel.classList.add("companion-panel");
  if (isDetail) panel.classList.add("detail-panel");
  panel.setAttribute("aria-label", titleFor(periodType));

  if (periodType === "FUTURE") {
    renderFuturePanel(panel, data, anchorDate);
  } else if (periodType === "YEARLY") {
    renderYearlyPanel(panel, data, anchorDate, isDetail);
  } else if (periodType === "MONTHLY") {
    renderMonthlyPanel(panel, data, anchorDate, isDetail);
  } else if (periodType === "WEEKLY") {
    renderWeeklyPanel(panel, data, anchorDate, isDetail);
  } else if (periodType === "DAILY") {
    renderDailyPanel(panel, data, anchorDate);
  } else {
    renderPeriodPanel(panel, periodType, data, anchorDate);
  }

  return panel;
}

function monthTarget(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function renderFuturePanel(panel, data = state, anchorDate = state.anchorDate) {
  const grid = document.createElement("div");
  grid.className = "year-grid";

  for (const year of futureYears(anchorDate)) {
    const card = document.createElement("section");
    card.className = "year-card";

    const heading = document.createElement("h3");
    const headingButton = document.createElement("button");
    headingButton.className = "heading-link";
    headingButton.type = "button";
    headingButton.textContent = `${year} Goals`;
    headingButton.addEventListener("click", async () => {
      await openDetailModal("YEARLY", new Date(year, 0, 1));
    });
    heading.append(headingButton);

    const list = document.createElement("ul");
    list.className = "task-list year-task-list";
    list.dataset.periodType = "YEARLY";
    list.dataset.targetDate = String(year);

    renderTaskList(
      list,
      "YEARLY",
      data.futureYearTasks.filter((task) => task.target_date === list.dataset.targetDate),
      `${year} 목표`,
    );

    card.append(heading, createTaskStack(list));
    grid.append(card);
  }

  panel.append(grid);
}

function renderYearlyPanel(panel, data = state, anchorDate = state.anchorDate) {
  const grid = document.createElement("div");
  grid.className = "month-grid";
  const year = anchorDate.getFullYear();

  for (let index = 0; index < 12; index += 1) {
    const card = document.createElement("section");
    card.className = "month-card";

    const heading = document.createElement("h3");
    const headingButton = document.createElement("button");
    headingButton.className = "heading-link";
    headingButton.type = "button";
    headingButton.textContent = `${index + 1}월`;
    headingButton.addEventListener("click", async () => {
      await openDetailModal("MONTHLY", new Date(year, index, 1));
    });
    heading.append(headingButton);

    const list = document.createElement("ul");
    list.className = "task-list month-task-list";
    list.dataset.periodType = "MONTHLY";
    list.dataset.targetDate = monthTarget(year, index);

    renderTaskList(
      list,
      "MONTHLY",
      data.yearlyMonthTasks.filter((task) => task.target_date === list.dataset.targetDate),
      `${index + 1}월 할 일 입력 후 Enter`,
    );

    card.append(heading, createTaskStack(list));
    grid.append(card);
  }

  panel.append(grid);
}

function renderMonthlyPanel(panel, data = state, anchorDate = state.anchorDate) {
  const board = document.createElement("div");
  board.className = "monthly-board";

  const monthGoals = document.createElement("section");
  monthGoals.className = "period-staging-card monthly-goals";
  const monthGoalsTitle = document.createElement("h3");
  monthGoalsTitle.textContent = "This Month";
  const monthGoalsList = document.createElement("ul");
  monthGoalsList.className = "task-list";
  monthGoalsList.dataset.periodType = "MONTHLY";
  monthGoalsList.dataset.targetDate = targetFor("MONTHLY", anchorDate);
  renderTaskList(monthGoalsList, "MONTHLY", data.tasks.MONTHLY, "Monthly task");
  monthGoals.append(monthGoalsTitle, createTaskStack(monthGoalsList));

  const weekList = document.createElement("div");
  weekList.className = "month-week-list";

  monthWeeks(anchorDate).forEach((week, index) => {
    const section = document.createElement("section");
    section.className = "month-week-section";

    const title = document.createElement("h3");
    const weekButton = document.createElement("button");
    weekButton.className = "heading-link week-heading-link";
    weekButton.type = "button";
    weekButton.innerHTML = `<span>${index + 1}주차</span><small>${week.days[0].getMonth() + 1}/${week.days[0].getDate()} - ${week.days.at(-1).getMonth() + 1}/${week.days.at(-1).getDate()}</small>`;
    weekButton.addEventListener("click", async () => {
      await openDetailModal("WEEKLY", week.anchorDate);
    });
    title.append(weekButton);

    const grid = document.createElement("div");
    grid.className = "day-grid month-week-days";

    for (const date of week.days) {
      const day = date.getDate();
      const targetDate = toDateKey(date);
      const isCurrentMonth =
        date.getFullYear() === anchorDate.getFullYear() &&
        date.getMonth() === anchorDate.getMonth();
      const card = document.createElement("section");
      card.className = "day-card";
      if (!isCurrentMonth) card.classList.add("muted-day-card");

      const heading = document.createElement("h3");
      const headingButton = document.createElement("button");
      headingButton.className = "heading-link day-heading-link";
      headingButton.type = "button";
      headingButton.innerHTML = `<span>${day}</span><small>${date.toLocaleDateString("en-US", { weekday: "short" })}</small>`;
      if (isCurrentMonth) {
        headingButton.addEventListener("click", async () => {
          await openDetailModal("DAILY", date);
        });
      } else {
        headingButton.disabled = true;
        headingButton.setAttribute("aria-label", "이번 달이 아닌 날짜");
      }
      heading.append(headingButton);

      if (isCurrentMonth) {
        const list = document.createElement("ul");
        list.className = "task-list day-task-list";
        list.dataset.periodType = "DAILY";
        list.dataset.targetDate = targetDate;

        renderTaskList(
          list,
          "DAILY",
          data.monthDailyTasks.filter((task) => task.target_date === targetDate && !task.time_block),
          "Plan this day",
        );

        card.append(heading, createTaskStack(list));
      } else {
        const placeholder = document.createElement("div");
        placeholder.className = "muted-day-placeholder";
        card.append(heading, placeholder);
      }
      grid.append(card);
    }

    section.append(title, grid);
    weekList.append(section);
  });

  board.append(monthGoals, weekList);
  panel.append(board);
}

function renderWeeklyPanel(panel, data = state, anchorDate = state.anchorDate) {
  const wrap = document.createElement("div");
  wrap.className = "weekly-board";

  const goals = document.createElement("section");
  goals.className = "period-staging-card weekly-goals";
  const goalsTitle = document.createElement("h3");
  goalsTitle.textContent = "This Week";
  const goalsList = document.createElement("ul");
  goalsList.className = "task-list";
  goalsList.dataset.periodType = "WEEKLY";
  goalsList.dataset.targetDate = targetFor("WEEKLY", anchorDate);
  renderTaskList(goalsList, "WEEKLY", data.tasks.WEEKLY, "Weekly task");
  goals.append(goalsTitle, createTaskStack(goalsList));

  const days = document.createElement("div");
  days.className = "week-day-strip";

  for (const date of weekDates(anchorDate)) {
    const targetDate = toDateKey(date);
    const card = document.createElement("section");
    card.className = "week-day-card";

    const heading = document.createElement("h3");
    const headingButton = document.createElement("button");
    headingButton.className = "heading-link day-heading-link";
    headingButton.type = "button";
    headingButton.innerHTML = `<span>${date.toLocaleDateString("en-US", { weekday: "short" })}</span><small>${date.getMonth() + 1}/${date.getDate()}</small>`;
    headingButton.addEventListener("click", async () => {
      await openDetailModal("DAILY", date);
    });
    heading.append(headingButton);

    const list = document.createElement("ul");
    list.className = "task-list week-task-list";
    list.dataset.periodType = "DAILY";
    list.dataset.targetDate = targetDate;

    renderTaskList(
      list,
      "DAILY",
      data.weekDailyTasks.filter((task) => task.target_date === targetDate && !task.time_block),
      "Daily plan",
    );

    card.append(heading, createTaskStack(list));
    days.append(card);
  }

  wrap.append(goals, days);
  panel.append(wrap);
}

function renderPeriodPanel(panel, periodType, data = state, anchorDate = state.anchorDate) {
  const list = document.createElement("ul");
  list.className = "task-list";
  list.dataset.periodType = periodType;
  list.dataset.targetDate = targetFor(periodType, anchorDate);
  renderTaskList(list, periodType, data.tasks[periodType], "새 불렛 입력 후 Enter");
  panel.append(createTaskStack(list));
}

function createTimelineRangeControls(anchorDate, range) {
  const controls = document.createElement("div");
  controls.className = "timeline-range-controls";

  const startSelect = document.createElement("select");
  startSelect.setAttribute("aria-label", "시작 시간");

  const endSelect = document.createElement("select");
  endSelect.setAttribute("aria-label", "끝 시간");

  timelineHourOptions.forEach((label, hour) => {
    if (hour < 24) {
      const startOption = document.createElement("option");
      startOption.value = String(hour);
      startOption.textContent = label;
      startSelect.append(startOption);
    }

    if (hour > 0) {
      const endOption = document.createElement("option");
      endOption.value = String(hour);
      endOption.textContent = label;
      endSelect.append(endOption);
    }
  });

  startSelect.value = String(range.start);
  endSelect.value = String(range.end);

  const saveRange = async () => {
    let start = Number(startSelect.value);
    let end = Number(endSelect.value);
    if (start >= end) {
      if (document.activeElement === startSelect) {
        end = Math.min(24, start + 1);
        endSelect.value = String(end);
      } else {
        start = Math.max(0, end - 1);
        startSelect.value = String(start);
      }
    }

    const targetDate = targetFor("DAILY", anchorDate);
    const nextRange = { start, end };
    state.timelineRanges[targetDate] = nextRange;
    if (state.dbReady) await saveTimelineRange(targetDate, nextRange);
    setStatus("시간 범위 저장 완료");
    await loadAndRender();
  };

  startSelect.addEventListener("change", saveRange);
  endSelect.addEventListener("change", saveRange);

  const separator = document.createElement("span");
  separator.textContent = "-";

  controls.append(startSelect, separator, endSelect);
  return controls;
}

function renderDailyPanel(panel, data = state, anchorDate = state.anchorDate) {
  const board = document.createElement("div");
  board.className = "daily-board";
  const range = timelineRangeFor(anchorDate, data);

  const today = document.createElement("section");
  today.className = "period-staging-card today-goals";
  const todayTitle = document.createElement("h3");
  const todayTitleText = document.createElement("span");
  todayTitleText.textContent = "This Day";
  todayTitle.append(todayTitleText, createTimelineRangeControls(anchorDate, range));
  const todayList = document.createElement("ul");
  todayList.className = "task-list";
  todayList.dataset.periodType = "DAILY";
  todayList.dataset.targetDate = targetFor("DAILY", anchorDate);
  renderTaskList(
    todayList,
    "DAILY",
    data.tasks.DAILY.filter((task) => !task.time_block),
    "Daily task",
  );
  today.append(todayTitle, createTaskStack(todayList));

  const timeline = document.createElement("div");
  timeline.className = "timeline";

  const hourColumns = document.createElement("div");
  hourColumns.className = "timeline-columns";

  const leftColumn = document.createElement("div");
  leftColumn.className = "timeline-column";

  const rightColumn = document.createElement("div");
  rightColumn.className = "timeline-column";

  const visibleHours = hoursForRange(range);
  const selectedHours = new Set(visibleHours);
  const outsideTaskHours = [
    ...new Set(
      data.tasks.DAILY
        .map((task) => task.time_block)
        .filter((timeBlock) => timeBlock && !selectedHours.has(timeBlock)),
    ),
  ].sort((left, right) => hourValue(left) - hourValue(right));
  const timelineHours = [...visibleHours, ...outsideTaskHours];

  timelineHours.forEach((hour, index) => {
    const row = document.createElement("section");
    row.className = "hour-row";

    const label = document.createElement("strong");
    label.textContent = hour;

    const list = document.createElement("ul");
    list.className = "task-list compact";
    list.dataset.periodType = "DAILY";
    list.dataset.targetDate = targetFor("DAILY", anchorDate);
    list.dataset.timeBlock = hour;
    renderTaskList(
      list,
      "DAILY",
      data.tasks.DAILY.filter((task) => task.time_block === hour),
      "이 칸에 입력 후 Enter",
    );

    row.append(label, createTaskStack(list));
    (index < timelineHours.length / 2 ? leftColumn : rightColumn).append(row);
  });

  hourColumns.append(leftColumn, rightColumn);
  timeline.append(hourColumns);

  board.append(today, timeline);
  panel.append(board);
}

async function openDetailModal(periodType, anchorDate) {
  if (periodType === state.activeTab && periodType === "DAILY") return;
  state.detailModal = { periodType, anchorDate: new Date(anchorDate) };
  await loadAndRender();
  document.querySelector("#detail-modal").showModal();
}

function closeDetailModal() {
  state.detailModal = null;
  const modal = document.querySelector("#detail-modal");
  if (modal.open) modal.close();
  document.querySelector("#detail-view").replaceChildren();
}

async function renderDetailModal() {
  const modal = document.querySelector("#detail-modal");
  const detailView = document.querySelector("#detail-view");

  if (!state.detailModal) {
    if (modal.open) modal.close();
    detailView.replaceChildren();
    return;
  }

  const { periodType, anchorDate } = state.detailModal;
  const data = await loadTaskData(anchorDate);
  document.querySelector(".detail-modal").className =
    `detail-modal detail-modal-${periodType.toLowerCase()}`;
  document.querySelector("#detail-title").textContent = titleFor(periodType);
  document.querySelector("#detail-meta").textContent =
    periodType === "WEEKLY"
      ? `${toDateKey(toWeekStartDate(anchorDate))} - ${toDateKey(weekDates(anchorDate).at(-1))}`
      : targetFor(periodType, anchorDate);
  detailView.replaceChildren(createPanel(periodType, false, data, anchorDate, true));
}

function bindSortables() {
  if (!state.isEditing) return;

  document.querySelectorAll(".task-list").forEach((list) => {
    Sortable.create(list, {
      group: {
        name: "shared-tasks",
        pull(to, from) {
          const fromType = from.el.dataset.periodType;
          const toType = to.el.dataset.periodType;
          return fromType === "WEEKLY" && toType === "DAILY" ? "clone" : true;
        },
        put: true,
      },
      animation: 120,
      forceFallback: true,
      fallbackOnBody: true,
      fallbackClass: "task-dragging",
      emptyInsertThreshold: 32,
      fallbackTolerance: 3,
      ghostClass: "task-ghost",
      chosenClass: "task-chosen",
      filter: ".entry-row, .entry-row *, .delete-button, .add-task-button",
      draggable: ".task-item",
      handle: ".drag-handle",
      onStart(event) {
        dragSourceList = event.from;
        document.body.classList.add("is-dragging-task");
        setStatus("드롭할 칸을 선택하세요");
      },
      onMove(event) {
        markDropTarget(event.to);
        if (event.to !== dragSourceList) {
          pendingDropList = event.to;
          return false;
        }
        pendingDropList = null;
        return insertionDirection(event);
      },
      async onEnd(event) {
        const targetList = pendingDropList;
        clearDropTargets({ resetDrag: true });
        if (targetList && targetList !== event.from) {
          await saveDroppedTask({
            item: event.item,
            from: event.from,
            to: targetList,
            pullMode: event.pullMode,
            position: calculateAppendPosition(targetList),
          });
          return;
        }

        const reordered = event.oldDraggableIndex !== event.newDraggableIndex;
        if (reordered) {
          await saveDroppedTask(event);
        }
      },
    });
  });
}

async function loadTasks() {
  if (!state.dbReady) return;

  const data = await loadTaskData(state.anchorDate);

  state.tasks.YEARLY = data.tasks.YEARLY;
  state.tasks.MONTHLY = data.tasks.MONTHLY;
  state.tasks.WEEKLY = data.tasks.WEEKLY;
  state.tasks.DAILY = data.tasks.DAILY;
  state.tasks.FUTURE = data.tasks.FUTURE;
  state.futureYearTasks = data.futureYearTasks;
  state.yearlyMonthTasks = data.yearlyMonthTasks;
  state.monthDailyTasks = data.monthDailyTasks;
  state.weekDailyTasks = data.weekDailyTasks;
  state.timelineRanges[targetFor("DAILY", state.anchorDate)] = data.timelineRange;
}

async function loadTaskData(anchorDate) {
  const weekTargets = weekDates(anchorDate).map(toDateKey);
  const yearTargets = futureYears(anchorDate).map(String);
  const dailyTargetDate = targetFor("DAILY", anchorDate);
  const [
    futureYearGroups,
    yearly,
    monthly,
    weekly,
    daily,
    yearlyMonthTasks,
    monthDailyTasks,
    weekDailyGroups,
    timelineRange,
  ] = await Promise.all([
      Promise.all(yearTargets.map((targetDate) => getTasks("YEARLY", targetDate))),
      getTasks("YEARLY", targetFor("YEARLY", anchorDate)),
      getTasks("MONTHLY", targetFor("MONTHLY", anchorDate)),
      getTasks("WEEKLY", targetFor("WEEKLY", anchorDate)),
      getTasks("DAILY", dailyTargetDate),
      getTasksByTargetPrefix("MONTHLY", `${targetFor("YEARLY", anchorDate)}-`),
      getTasksByTargetPrefix("DAILY", `${targetFor("MONTHLY", anchorDate)}-`),
      Promise.all(weekTargets.map((targetDate) => getTasks("DAILY", targetDate))),
      getTimelineRange(dailyTargetDate),
    ]);
  const futureYearTasks = futureYearGroups.flat();

  return {
    tasks: {
      FUTURE: futureYearTasks,
      YEARLY: yearly,
      MONTHLY: monthly,
      WEEKLY: weekly,
      DAILY: daily,
    },
    futureYearTasks,
    yearlyMonthTasks,
    monthDailyTasks,
    weekDailyTasks: weekDailyGroups.flat(),
    timelineRange: normalizeTimelineRange(timelineRange),
  };
}

async function loadAndRender() {
  await loadTasks();
  document.body.classList.toggle("is-editing", state.isEditing);
  renderTabs();
  renderViewActions();
  renderPeriodNav();
  state.shouldAnimatePeriod = false;

  document.querySelector("#view-title").textContent = titleFor(state.activeTab);
  document.querySelector("#view-meta").textContent = rangeLabelFor(state.activeTab);

  const panels = [createPanel(state.activeTab)];
  if (state.sideTab) panels.push(createPanel(state.sideTab, true));

  const view = document.querySelector("#view");
  view.className = state.sideTab ? "split" : "single";
  view.replaceChildren(...panels);

  await renderDetailModal();
  bindSortables();
}

async function openSettings() {
  const modal = document.querySelector("#settings-modal");
  const input = document.querySelector("#api-key-input");
  input.value = state.dbReady ? await getApiKey() : "";
  renderThemeOptions();
  modal.showModal();
}

async function saveSettings() {
  const input = document.querySelector("#api-key-input");
  const apiKey = input.value.trim();
  if (apiKey && state.dbReady) {
    await saveApiKey(apiKey);
    setStatus("설정 저장 완료");
  }
  document.querySelector("#settings-modal").close();
}

async function requestReview() {
  const summary = document.querySelector("#ai-summary");
  summary.hidden = false;
  summary.textContent = "AI 회고 요약 생성 중...";

  if (!state.dbReady) {
    summary.textContent = "SQLite가 준비된 Tauri 실행 환경에서 사용할 수 있습니다.";
    return;
  }

  const tasks = state.tasks[state.activeTab] ?? [];
  if (!tasks.length) {
    summary.textContent = "요약할 태스크가 없습니다.";
    return;
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    summary.textContent = "설정에서 Gemini API Key를 먼저 저장해주세요.";
    return;
  }

  const done = tasks.filter((task) => task.status === "DONE").map((task) => task.content);
  const pending = tasks
    .filter((task) => task.status !== "DONE")
    .map((task) => `${task.status}: ${task.content}`);

  const prompt = `다음은 사용자의 [${state.activeTab}] 불렛저널 일정 데이터입니다:
- 완료: ${done.length ? done.join(", ") : "없음"}
- 미완료: ${pending.length ? pending.join(", ") : "없음"}

이 데이터를 분석하여 (1) 성과 요약, (2) 미완료 항목에 대한 피드백, (3) 다음 주기 실행 제안을 3줄 내외로 간결하게 한국어로 작성해주세요.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
    const data = await response.json();
    summary.textContent =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Gemini 응답에서 요약 텍스트를 찾지 못했습니다.";
  } catch (error) {
    console.error(error);
    summary.textContent = "AI 회고 요약 요청에 실패했습니다.";
  }
}

renderShell();

document.querySelector("#sidebar-toggle").addEventListener("click", () => {
  const shell = document.querySelector(".shell");
  const collapsed = shell.dataset.sidebarCollapsed === "true";
  shell.dataset.sidebarCollapsed = String(!collapsed);
});
document.querySelector("#settings-button").addEventListener("click", openSettings);
document.querySelector("#save-api-key").addEventListener("click", saveSettings);
document.querySelector("#review-button").addEventListener("click", requestReview);
document.querySelector("#detail-close").addEventListener("click", closeDetailModal);
document.querySelector("#detail-modal").addEventListener("close", () => {
  state.detailModal = null;
});

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
