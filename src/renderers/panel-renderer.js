import { createPeriodOverviewRenderer } from "./period-overview-renderer.js";
import { createDetailModalController } from "./detail-modal-controller.js";
import { createDailyPanelRenderer } from "./daily-panel-renderer.js";

export function createPanelRenderer({
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
}) {
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
    } else if (periodType === "JOURNAL") {
      renderJournalPanel(panel, data, anchorDate);
    } else {
      renderPeriodPanel(panel, periodType, data, anchorDate);
    }
  
    return panel;
  }
  
  function monthTarget(year, monthIndex) {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  }
  
  function stagingKey(periodType, targetDate) {
    return `${periodType}:${targetDate}`;
  }

  function groupTasksByTargetDate(tasks) {
    return tasks.reduce((groups, task) => {
      const targetDate = task.target_date;
      if (!groups.has(targetDate)) groups.set(targetDate, []);
      groups.get(targetDate).push(task);
      return groups;
    }, new Map());
  }

  function createStagingHeading(card, periodType, targetDate, label, extra = null) {
    const key = stagingKey(periodType, targetDate);
    const isCollapsed = state.collapsedSections.has(key);
    card.classList.toggle("is-collapsed", isCollapsed);
  
    const heading = document.createElement("h3");
    const toggle = document.createElement("button");
    toggle.className = "staging-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(!isCollapsed));
    toggle.innerHTML = `<span aria-hidden="true">›</span><strong>${label}</strong>`;
    toggle.addEventListener("click", () => {
      const content = card.querySelector(".staging-content, .split-task-stack");
      const nextCollapsed = !card.classList.contains("is-collapsed");
      toggle.setAttribute("aria-expanded", String(!nextCollapsed));
  
      if (content) {
        if (nextCollapsed) {
          content.style.height = `${content.scrollHeight}px`;
          content.getBoundingClientRect();
          card.classList.add("is-collapsed");
          requestAnimationFrame(() => {
            content.style.minHeight = "0px";
            content.style.height = "0px";
          });
        } else {
          const clearExpandedHeight = (event) => {
            if (event.propertyName !== "height") return;
            content.removeEventListener("transitionend", clearExpandedHeight);
            if (card.classList.contains("is-collapsed")) return;
            content.style.height = "";
            content.style.minHeight = "";
          };

          card.classList.remove("is-collapsed");
          content.style.height = "auto";
          content.style.minHeight = "";
          const expandedHeight = content.getBoundingClientRect().height;
          content.style.minHeight = "0px";
          content.style.height = "0px";
          content.getBoundingClientRect();
          content.addEventListener("transitionend", clearExpandedHeight);
          requestAnimationFrame(() => {
            content.style.height = `${expandedHeight}px`;
          });
        }
      }
  
      if (!content) card.classList.toggle("is-collapsed", nextCollapsed);
      if (nextCollapsed) {
        state.collapsedSections.add(key);
      } else {
        state.collapsedSections.delete(key);
      }
    });
  
    heading.append(toggle);
    if (extra) heading.append(extra);
    return heading;
  }

  const { createPeriodOverview, createTodoSummary } = createPeriodOverviewRenderer({
    state,
    createStagingHeading,
    createSplitTaskStack,
    openJournalEditor,
    targetFor,
    futureYears,
    weekDates,
    toDateKey,
  });

  const { renderDailyPanel } = createDailyPanelRenderer({
    state,
    targetFor,
    timelineRangeFor,
    normalizeTimelineRange,
    isCurrentDate,
    isCurrentHourBlock,
    hoursForRange,
    hourValue,
    createTodoSummary,
    createPeriodOverview,
    createTaskStack,
    renderTaskList,
  });

  const { closeDetailModal, openDetailModal, renderDetailModal } = createDetailModalController({
    state,
    loadAndRender,
    loadTaskData,
    titleFor,
    targetFor,
    weekDates,
    toDateKey,
    toWeekStartDate,
    createPanel,
  });
  
  function createPeriodTaskCard({
    cardClass,
    currentClasses,
    isCurrent,
    label,
    periodType,
    anchorDate,
    targetDate,
    listClass,
    tasks,
    placeholder,
  }) {
    const card = document.createElement("section");
    card.className = cardClass;
    if (isCurrent) card.classList.add("current-period-card", ...currentClasses);
    const heading = document.createElement("h3");
    const button = document.createElement("button");
    button.className = "heading-link";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => openDetailModal(periodType, anchorDate));
    heading.append(button);
    const list = document.createElement("ul");
    list.className = `task-list ${listClass}`;
    list.dataset.periodType = periodType;
    list.dataset.targetDate = targetDate;
    renderTaskList(list, periodType, tasks, placeholder);
    card.append(heading, createTaskStack(list));
    return card;
  }

  function renderFuturePanel(panel, data = state, anchorDate = state.anchorDate) {
    const board = document.createElement("div");
    board.className = "future-board";
    const now = new Date();
  
    const decadeTarget = targetFor("FUTURE", anchorDate);
    const decadeGoals = createTodoSummary(
      "FUTURE",
      data.tasks.FUTURE,
      "Decade task",
      decadeTarget,
    );
  
    const grid = document.createElement("div");
    grid.className = "year-grid";
    const yearlyTasksByTarget = groupTasksByTargetDate(data.futureYearTasks);
  
    for (const year of futureYears(anchorDate)) {
      grid.append(createPeriodTaskCard({
        cardClass: "year-card", currentClasses: ["current-year-card"],
        isCurrent: year === now.getFullYear(), label: `${year} Goals`,
        periodType: "YEARLY", anchorDate: new Date(year, 0, 1), targetDate: String(year),
        listClass: "year-task-list", tasks: yearlyTasksByTarget.get(String(year)) ?? [],
        placeholder: `${year} 목표`,
      }));
    }
  
    board.append(
      createPeriodOverview("This Decade", "FUTURE", decadeTarget, decadeGoals, anchorDate, data),
      grid,
    );
    panel.append(board);
  }
  
  function renderYearlyPanel(panel, data = state, anchorDate = state.anchorDate) {
    const board = document.createElement("div");
    board.className = "yearly-board";
    const now = new Date();
  
    const yearTarget = targetFor("YEARLY", anchorDate);
    const yearGoals = createTodoSummary(
      "YEARLY",
      data.tasks.YEARLY,
      "Yearly task",
      yearTarget,
    );
  
    const grid = document.createElement("div");
    grid.className = "month-grid";
    const year = anchorDate.getFullYear();
    const monthlyTasksByTarget = groupTasksByTargetDate(data.yearlyMonthTasks);
  
    for (let index = 0; index < 12; index += 1) {
      const targetDate = monthTarget(year, index);
      grid.append(createPeriodTaskCard({
        cardClass: "month-card", currentClasses: ["current-month-card"],
        isCurrent: year === now.getFullYear() && index === now.getMonth(), label: `${index + 1}월`,
        periodType: "MONTHLY", anchorDate: new Date(year, index, 1), targetDate,
        listClass: "month-task-list", tasks: monthlyTasksByTarget.get(targetDate) ?? [],
        placeholder: `${index + 1}월 할 일 입력 후 Enter`,
      }));
    }
  
    board.append(
      createPeriodOverview("This Year", "YEARLY", yearTarget, yearGoals, anchorDate, data),
      grid,
    );
    panel.append(board);
  }
  
  function renderMonthlyPanel(panel, data = state, anchorDate = state.anchorDate) {
    const board = document.createElement("div");
    board.className = "monthly-board";
    const now = new Date();
  
    const monthTargetDate = targetFor("MONTHLY", anchorDate);
    const monthGoals = createTodoSummary(
      "MONTHLY",
      data.tasks.MONTHLY,
      "Monthly task",
      monthTargetDate,
    );
  
    const weekList = document.createElement("div");
    weekList.className = "month-week-list";
    const dailyTasksByTarget = groupTasksByTargetDate(
      data.monthDailyTasks.filter((task) => !task.time_block),
    );
  
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
        if (date.getDay() === 6) card.classList.add("weekend-saturday");
        if (date.getDay() === 0) card.classList.add("weekend-sunday");
        if (!isCurrentMonth) card.classList.add("muted-day-card");
        if (isCurrentMonth && isCurrentDate(date, now)) {
          card.classList.add("current-period-card", "current-day-card");
        }
  
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
            dailyTasksByTarget.get(targetDate) ?? [],
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
  
    board.append(
      createPeriodOverview("This Month", "MONTHLY", monthTargetDate, monthGoals, anchorDate, data),
      weekList,
    );
    panel.append(board);
  }
  
  function renderWeeklyPanel(panel, data = state, anchorDate = state.anchorDate) {
    const wrap = document.createElement("div");
    wrap.className = "weekly-board";
    const now = new Date();
    const dailyTasksByTarget = groupTasksByTargetDate(
      data.weekDailyTasks.filter((task) => !task.time_block),
    );
  
    const createWeekDayCard = (date) => {
      const targetDate = toDateKey(date);
      const card = document.createElement("section");
      card.className = "week-day-card";
      if (date.getDay() === 6) card.classList.add("weekend-saturday");
      if (date.getDay() === 0) card.classList.add("weekend-sunday");
      if (isCurrentDate(date, now)) {
        card.classList.add("current-period-card", "current-day-card");
      }
  
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
        dailyTasksByTarget.get(targetDate) ?? [],
        "Daily plan",
      );
  
      card.append(heading, createTaskStack(list));
      return card;
    };
  
    const dates = weekDates(anchorDate);
    const weekTarget = targetFor("WEEKLY", anchorDate);
    const goals = createTodoSummary(
      "WEEKLY",
      data.tasks.WEEKLY,
      "Weekly task",
      weekTarget,
    );
  
    const days = document.createElement("div");
    days.className = "week-day-strip";
    dates.forEach((date) => days.append(createWeekDayCard(date)));
  
    wrap.append(
      createPeriodOverview("This Week", "WEEKLY", weekTarget, goals, anchorDate, data),
      days,
    );
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
  
  return {
    closeDetailModal,
    createPanel,
    renderDetailModal,
  };
}
