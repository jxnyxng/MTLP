import Sortable from "sortablejs";
import "./styles.css";
import {
  addTask,
  deleteTask,
  getApiKey,
  getTasks,
  getTasksByTargetPrefix,
  initDb,
  moveTask,
  saveApiKey,
  updateTaskStatus,
} from "./db.js";

const tabs = [
  { id: "YEARLY", label: "Yearly" },
  { id: "MONTHLY", label: "Monthly" },
  { id: "WEEKLY", label: "Weekly" },
  { id: "DAILY", label: "Daily" },
];

const hours = Array.from({ length: 15 }, (_, index) => {
  return `${String(index + 8).padStart(2, "0")}:00`;
});

const state = {
  activeTab: "DAILY",
  sideTab: null,
  dbReady: false,
  anchorDate: new Date(),
  tasks: {
    YEARLY: [],
    MONTHLY: [],
    WEEKLY: [],
    DAILY: [],
  },
  yearlyMonthTasks: [],
  monthDailyTasks: [],
  weekDailyTasks: [],
  periodNavPulse: 0,
};

const app = document.querySelector("#app");

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

function toWeekStartDate(date) {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function targetFor(periodType) {
  if (periodType === "YEARLY") return toYearKey(state.anchorDate);
  if (periodType === "MONTHLY") return toMonthKey(state.anchorDate);
  if (periodType === "WEEKLY") return toDateKey(toWeekStartDate(state.anchorDate));
  return toDateKey(state.anchorDate);
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

function titleFor(periodType) {
  if (periodType === "YEARLY") return "Yearly Log";
  if (periodType === "MONTHLY") return "Monthly Log";
  if (periodType === "WEEKLY") return "Weekly Log";
  return "Daily Log";
}

function rangeLabelFor(periodType) {
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
  if (periodType === "YEARLY") next.setFullYear(next.getFullYear() + amount);
  if (periodType === "MONTHLY") next.setMonth(next.getMonth() + amount);
  if (periodType === "WEEKLY") next.setDate(next.getDate() + amount * 7);
  if (periodType === "DAILY") next.setDate(next.getDate() + amount);
  return next;
}

function periodLabel(periodType, date) {
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
  if (periodType === "YEARLY") return "number";
  if (periodType === "MONTHLY") return "month";
  return "date";
}

function dateInputValue(periodType) {
  if (periodType === "YEARLY") return targetFor("YEARLY");
  if (periodType === "MONTHLY") return targetFor("MONTHLY");
  return toDateKey(state.anchorDate);
}

function parseDateInput(periodType, value) {
  if (!value) return;

  if (periodType === "YEARLY") {
    state.anchorDate = new Date(Number(value), 0, 1);
    state.periodNavPulse += 1;
    return;
  }

  if (periodType === "MONTHLY") {
    const [year, month] = value.split("-").map(Number);
    state.anchorDate = new Date(year, month - 1, 1);
    state.periodNavPulse += 1;
    return;
  }

  const [year, month, day] = value.split("-").map(Number);
  state.anchorDate = new Date(year, month - 1, day);
  state.periodNavPulse += 1;
}

function shiftDate(periodType, amount) {
  const next = new Date(state.anchorDate);
  if (periodType === "YEARLY") next.setFullYear(next.getFullYear() + amount);
  if (periodType === "MONTHLY") next.setMonth(next.getMonth() + amount);
  if (periodType === "WEEKLY") next.setDate(next.getDate() + amount * 7);
  if (periodType === "DAILY") next.setDate(next.getDate() + amount);
  state.anchorDate = next;
  state.periodNavPulse += 1;
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
    await addTask(
      content,
      periodType,
      targetDate,
      getNextPosition(tasksFor(periodType, timeBlock, targetDate)),
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

function calculateDropPosition(item) {
  let previous = item.previousElementSibling;
  while (previous && !previous.classList.contains("task-item")) {
    previous = previous.previousElementSibling;
  }

  let next = item.nextElementSibling;
  while (next && !next.classList.contains("task-item")) {
    next = next.nextElementSibling;
  }

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
          <div>
            <h1 id="view-title"></h1>
            <p id="view-meta"></p>
          </div>
          <p id="db-status">SQLite 초기화 중...</p>
        </header>
        <section id="view-actions" class="view-actions"></section>
        <section id="period-nav" class="period-nav"></section>
        <section id="view"></section>
        <section id="ai-summary" class="summary" hidden></section>
      </section>
    </main>
    <dialog id="settings-modal">
      <form method="dialog" class="modal">
        <h2>설정</h2>
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

function renderViewActions() {
  const actions = document.querySelector("#view-actions");
  const companionButtons = tabs
    .filter((tab) => tab.id !== state.activeTab && tab.id !== state.sideTab)
    .map((tab) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${tab.label} 함께 보기`;
      button.addEventListener("click", async () => {
        state.sideTab = tab.id;
        await loadAndRender();
      });
      return button;
    });

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "우측 닫기";
  closeButton.hidden = !state.sideTab;
  closeButton.addEventListener("click", async () => {
    state.sideTab = null;
    await loadAndRender();
  });

  actions.replaceChildren(...companionButtons, closeButton);
}

function renderPeriodNav() {
  const nav = document.querySelector("#period-nav");
  nav.replaceChildren();
  renderDateControls(nav, state.activeTab);
}

function renderDateControls(container, periodType) {
  const controls = document.createElement("div");
  controls.className = "date-carousel";
  controls.dataset.pulse = state.periodNavPulse;

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
  if (periodType === "YEARLY") {
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
    state.periodNavPulse += 1;
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

  item.append(bullet, content, deleteButton);
  return item;
}

function createEntryInput(
  periodType,
  placeholder,
  timeBlock = null,
  targetDate = targetFor(periodType),
) {
  const row = document.createElement("li");
  row.className = "entry-row";

  const bullet = document.createElement("span");
  bullet.textContent = "•";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = placeholder;
  input.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    await addTaskFromInput(input, periodType, timeBlock, targetDate);
  });

  row.append(bullet, input);
  return row;
}

function renderTaskList(list, periodType, tasks, placeholder) {
  list.replaceChildren(
    ...tasks.map(createTaskItem),
    createEntryInput(
      periodType,
      placeholder,
      list.dataset.timeBlock ?? null,
      list.dataset.targetDate,
    ),
  );
}

function createPanel(periodType, isCompanion = false) {
  const panel = document.createElement("section");
  panel.className = `panel ${periodType.toLowerCase()}-panel`;
  if (isCompanion) panel.classList.add("companion-panel");
  panel.setAttribute("aria-label", titleFor(periodType));

  if (periodType === "YEARLY") {
    renderYearlyPanel(panel);
  } else if (periodType === "MONTHLY") {
    renderMonthlyPanel(panel);
  } else if (periodType === "WEEKLY") {
    renderWeeklyPanel(panel);
  } else if (periodType === "DAILY") {
    renderDailyPanel(panel);
  } else {
    renderPeriodPanel(panel, periodType);
  }

  return panel;
}

function monthTarget(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function renderYearlyPanel(panel) {
  const grid = document.createElement("div");
  grid.className = "month-grid";
  const year = state.anchorDate.getFullYear();

  for (let index = 0; index < 12; index += 1) {
    const card = document.createElement("section");
    card.className = "month-card";

    const heading = document.createElement("h3");
    heading.textContent = `${index + 1}월`;

    const list = document.createElement("ul");
    list.className = "task-list month-task-list";
    list.dataset.periodType = "MONTHLY";
    list.dataset.targetDate = monthTarget(year, index);

    renderTaskList(
      list,
      "MONTHLY",
      state.yearlyMonthTasks.filter((task) => task.target_date === list.dataset.targetDate),
      `${index + 1}월 할 일 입력 후 Enter`,
    );

    card.append(heading, list);
    grid.append(card);
  }

  panel.append(grid);
}

function renderMonthlyPanel(panel) {
  const grid = document.createElement("div");
  grid.className = "day-grid";
  const monthPrefix = targetFor("MONTHLY");

  for (let day = 1; day <= daysInMonth(); day += 1) {
    const targetDate = `${monthPrefix}-${String(day).padStart(2, "0")}`;
    const date = dateFromKey(targetDate);
    const card = document.createElement("section");
    card.className = "day-card";

    const heading = document.createElement("h3");
    heading.innerHTML = `<span>${day}</span><small>${date.toLocaleDateString("en-US", { weekday: "short" })}</small>`;

    const list = document.createElement("ul");
    list.className = "task-list day-task-list";
    list.dataset.periodType = "DAILY";
    list.dataset.targetDate = targetDate;

    renderTaskList(
      list,
      "DAILY",
      state.monthDailyTasks.filter((task) => task.target_date === targetDate && !task.time_block),
      "Plan this day",
    );

    card.append(heading, list);
    grid.append(card);
  }

  panel.append(grid);
}

function renderWeeklyPanel(panel) {
  const wrap = document.createElement("div");
  wrap.className = "weekly-board";

  const goals = document.createElement("section");
  goals.className = "weekly-goals";
  const goalsTitle = document.createElement("h3");
  goalsTitle.textContent = "This Week";
  const goalsList = document.createElement("ul");
  goalsList.className = "task-list";
  goalsList.dataset.periodType = "WEEKLY";
  goalsList.dataset.targetDate = targetFor("WEEKLY");
  renderTaskList(goalsList, "WEEKLY", state.tasks.WEEKLY, "Weekly task");
  goals.append(goalsTitle, goalsList);

  const days = document.createElement("div");
  days.className = "week-day-strip";

  for (const date of weekDates()) {
    const targetDate = toDateKey(date);
    const card = document.createElement("section");
    card.className = "week-day-card";

    const heading = document.createElement("h3");
    heading.innerHTML = `<span>${date.toLocaleDateString("en-US", { weekday: "short" })}</span><small>${date.getMonth() + 1}/${date.getDate()}</small>`;

    const list = document.createElement("ul");
    list.className = "task-list week-task-list";
    list.dataset.periodType = "DAILY";
    list.dataset.targetDate = targetDate;

    renderTaskList(
      list,
      "DAILY",
      state.weekDailyTasks.filter((task) => task.target_date === targetDate && !task.time_block),
      "Daily plan",
    );

    card.append(heading, list);
    days.append(card);
  }

  wrap.append(goals, days);
  panel.append(wrap);
}

function renderPeriodPanel(panel, periodType) {
  const list = document.createElement("ul");
  list.className = "task-list";
  list.dataset.periodType = periodType;
  list.dataset.targetDate = targetFor(periodType);
  renderTaskList(list, periodType, state.tasks[periodType], "새 불렛 입력 후 Enter");
  panel.append(list);
}

function renderDailyPanel(panel) {
  const timeline = document.createElement("div");
  timeline.className = "timeline";

  const allDay = document.createElement("section");
  allDay.className = "hour-row all-day-row";
  const allDayLabel = document.createElement("strong");
  allDayLabel.textContent = "All-day";
  const allDayList = document.createElement("ul");
  allDayList.className = "task-list compact";
  allDayList.dataset.periodType = "DAILY";
  allDayList.dataset.targetDate = targetFor("DAILY");
  renderTaskList(
    allDayList,
    "DAILY",
    state.tasks.DAILY.filter((task) => !task.time_block),
    "Plan this day",
  );
  allDay.append(allDayLabel, allDayList);
  timeline.append(allDay);

  for (const hour of hours) {
    const row = document.createElement("section");
    row.className = "hour-row";

    const label = document.createElement("strong");
    label.textContent = hour;

    const list = document.createElement("ul");
    list.className = "task-list compact";
    list.dataset.periodType = "DAILY";
    list.dataset.targetDate = targetFor("DAILY");
    list.dataset.timeBlock = hour;
    renderTaskList(
      list,
      "DAILY",
      state.tasks.DAILY.filter((task) => task.time_block === hour),
      "이 칸에 입력 후 Enter",
    );

    row.append(label, list);
    timeline.append(row);
  }

  panel.append(timeline);
}

function bindSortables() {
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
      fallbackOnBody: true,
      ghostClass: "task-ghost",
      chosenClass: "task-chosen",
      draggable: ".task-item",
      async onEnd(event) {
        if (!state.dbReady) return;

        const fromType = event.from.dataset.periodType;
        const targetList = event.to;
        const toType = targetList.dataset.periodType;
        const targetDate = targetList.dataset.targetDate;
        const timeBlock = targetList.dataset.timeBlock ?? null;
        const position = calculateDropPosition(event.item);

        try {
          if (fromType === "WEEKLY" && toType === "DAILY") {
            await addTask(event.item.dataset.content, "DAILY", targetDate, position, timeBlock);
            setStatus("Daily로 복사 완료");
          } else {
            await moveTask(Number(event.item.dataset.id), toType, targetDate, position, timeBlock);
            setStatus("이동 저장 완료");
          }
          await loadAndRender();
        } catch (error) {
          console.error(error);
          setStatus("드래그 저장 실패");
          await loadAndRender();
        }
      },
    });
  });
}

async function loadTasks() {
  if (!state.dbReady) return;

  const weekTargets = weekDates().map(toDateKey);
  const [yearly, monthly, weekly, daily, yearlyMonthTasks, monthDailyTasks, weekDailyGroups] =
    await Promise.all([
      getTasks("YEARLY", targetFor("YEARLY")),
      getTasks("MONTHLY", targetFor("MONTHLY")),
      getTasks("WEEKLY", targetFor("WEEKLY")),
      getTasks("DAILY", targetFor("DAILY")),
      getTasksByTargetPrefix("MONTHLY", `${targetFor("YEARLY")}-`),
      getTasksByTargetPrefix("DAILY", `${targetFor("MONTHLY")}-`),
      Promise.all(weekTargets.map((targetDate) => getTasks("DAILY", targetDate))),
    ]);

  state.tasks.YEARLY = yearly;
  state.tasks.MONTHLY = monthly;
  state.tasks.WEEKLY = weekly;
  state.tasks.DAILY = daily;
  state.yearlyMonthTasks = yearlyMonthTasks;
  state.monthDailyTasks = monthDailyTasks;
  state.weekDailyTasks = weekDailyGroups.flat();
}

async function loadAndRender() {
  await loadTasks();
  renderTabs();
  renderViewActions();
  renderPeriodNav();

  document.querySelector("#view-title").textContent = titleFor(state.activeTab);
  document.querySelector("#view-meta").textContent = rangeLabelFor(state.activeTab);

  const panels = [createPanel(state.activeTab)];
  if (state.sideTab) panels.push(createPanel(state.sideTab, true));

  const view = document.querySelector("#view");
  view.className = state.sideTab ? "split" : "single";
  view.replaceChildren(...panels);

  bindSortables();
}

async function openSettings() {
  const modal = document.querySelector("#settings-modal");
  const input = document.querySelector("#api-key-input");
  input.value = state.dbReady ? await getApiKey() : "";
  modal.showModal();
}

async function saveSettings() {
  const input = document.querySelector("#api-key-input");
  const apiKey = input.value.trim();
  if (!apiKey || !state.dbReady) return;
  await saveApiKey(apiKey);
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

try {
  await initDb();
  state.dbReady = true;
  setStatus("SQLite 준비 완료");
} catch (error) {
  setStatus("Tauri 환경에서 SQLite를 초기화할 수 있습니다.");
  console.error(error);
}

await loadAndRender();
