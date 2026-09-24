export function createPeriodBoardRenderer({
  state,
  createPeriodOverview,
  createTodoSummary,
  createTaskStack,
  createDayTaskCard,
  renderTaskList,
  openDetailModal,
  targetFor,
  futureYears,
  weekDates,
  monthWeeks,
  toDateKey,
}) {
  function monthTarget(year, monthIndex) {
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  }

  function groupTasksByTargetDate(tasks) {
    return tasks.reduce((groups, task) => {
      const targetDate = task.target_date;
      if (!groups.has(targetDate)) groups.set(targetDate, []);
      groups.get(targetDate).push(task);
      return groups;
    }, new Map());
  }

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
        cardClass: "year-card",
        currentClasses: ["current-year-card"],
        isCurrent: year === now.getFullYear(),
        label: `${year} Goals`,
        periodType: "YEARLY",
        anchorDate: new Date(year, 0, 1),
        targetDate: String(year),
        listClass: "year-task-list",
        tasks: yearlyTasksByTarget.get(String(year)) ?? [],
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
    const yearGoals = createTodoSummary("YEARLY", data.tasks.YEARLY, "Yearly task", yearTarget);
    const grid = document.createElement("div");
    grid.className = "month-grid";
    const year = anchorDate.getFullYear();
    const monthlyTasksByTarget = groupTasksByTargetDate(data.yearlyMonthTasks);

    for (let index = 0; index < 12; index += 1) {
      const targetDate = monthTarget(year, index);
      grid.append(createPeriodTaskCard({
        cardClass: "month-card",
        currentClasses: ["current-month-card"],
        isCurrent: year === now.getFullYear() && index === now.getMonth(),
        label: `${index + 1}월`,
        periodType: "MONTHLY",
        anchorDate: new Date(year, index, 1),
        targetDate,
        listClass: "month-task-list",
        tasks: monthlyTasksByTarget.get(targetDate) ?? [],
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
        const targetDate = toDateKey(date);
        const isCurrentMonth =
          date.getFullYear() === anchorDate.getFullYear() &&
          date.getMonth() === anchorDate.getMonth();
        grid.append(createDayTaskCard({
          cardClass: "day-card",
          date,
          enabled: isCurrentMonth,
          headingPrimary: String(date.getDate()),
          headingSecondary: date.toLocaleDateString("en-US", { weekday: "short" }),
          listClass: "day-task-list",
          now,
          placeholder: "Plan this day",
          tasks: dailyTasksByTarget.get(targetDate) ?? [],
        }));
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
    const dates = weekDates(anchorDate);
    const weekTarget = targetFor("WEEKLY", anchorDate);
    const goals = createTodoSummary("WEEKLY", data.tasks.WEEKLY, "Weekly task", weekTarget);
    const days = document.createElement("div");
    days.className = "week-day-strip";

    dates.forEach((date) => days.append(createDayTaskCard({
      cardClass: "week-day-card",
      date,
      headingPrimary: date.toLocaleDateString("en-US", { weekday: "short" }),
      headingSecondary: `${date.getMonth() + 1}/${date.getDate()}`,
      listClass: "week-task-list",
      now,
      placeholder: "Daily plan",
      tasks: dailyTasksByTarget.get(toDateKey(date)) ?? [],
    })));

    wrap.append(
      createPeriodOverview("This Week", "WEEKLY", weekTarget, goals, anchorDate, data),
      days,
    );
    panel.append(wrap);
  }

  return { renderFuturePanel, renderMonthlyPanel, renderWeeklyPanel, renderYearlyPanel };
}
