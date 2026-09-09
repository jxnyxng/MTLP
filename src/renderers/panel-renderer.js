import { createPeriodOverviewRenderer } from "./period-overview-renderer.js";

export function createPanelRenderer({
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
  
    for (const year of futureYears(anchorDate)) {
      const card = document.createElement("section");
      card.className = "year-card";
      if (year === now.getFullYear()) {
        card.classList.add("current-period-card", "current-year-card");
      }
  
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
  
    for (let index = 0; index < 12; index += 1) {
      const card = document.createElement("section");
      card.className = "month-card";
      if (year === now.getFullYear() && index === now.getMonth()) {
        card.classList.add("current-period-card", "current-month-card");
      }
  
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
        data.weekDailyTasks.filter((task) => task.target_date === targetDate && !task.time_block),
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
    const now = new Date();
    const isToday = isCurrentDate(anchorDate, now);
  
    const dayTarget = targetFor("DAILY", anchorDate);
    const today = createTodoSummary(
      "DAILY",
      data.tasks.DAILY.filter((task) => !task.time_block),
      "Daily task",
      dayTarget,
    );
  
    const timeline = document.createElement("div");
    timeline.className = "timeline";
  
    const hourColumns = document.createElement("div");
    hourColumns.className = "timeline-columns";
  
    const leftColumn = document.createElement("div");
    leftColumn.className = "timeline-column";
  
    const rightColumn = document.createElement("div");
    rightColumn.className = "timeline-column";
  
    const visibleHours = hoursForRange(range, normalizeTimelineRange);
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
      if (isToday && isCurrentHourBlock(hour, now)) {
        row.classList.add("current-hour-row");
      }
  
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
  
    board.append(
      createPeriodOverview("This Day", "DAILY", dayTarget, today, anchorDate, data),
      timeline,
    );
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

  return {
    closeDetailModal,
    createPanel,
    createTimelineRangeControls,
    renderDetailModal,
  };
}
