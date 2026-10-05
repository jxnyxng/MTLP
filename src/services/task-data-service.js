export function createTaskDataService({
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
}) {
  let loadVersion = 0;

  function legacyMondayTargetForWeek(anchorDate) {
    const sunday = weekDates(anchorDate)[0];
    const monday = new Date(sunday);
    monday.setDate(sunday.getDate() + 1);
    return toDateKey(monday);
  }

  function uniqueTasks(tasks) {
    const seen = new Set();
    return tasks.filter((task) => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
  }

  async function loadTaskData(anchorDate, requestedPeriodTypes = null) {
    const requested = requestedPeriodTypes
      ? new Set(requestedPeriodTypes)
      : new Set(["FUTURE", "YEARLY", "MONTHLY", "WEEKLY", "DAILY", "JOURNAL"]);
    const weekTargets = weekDates(anchorDate).map(toDateKey);
    const yearTargets = futureYears(anchorDate).map(String);
    const dailyTargetDate = targetFor("DAILY", anchorDate);
    const weeklyTargetDate = targetFor("WEEKLY", anchorDate);
    const legacyWeeklyTargetDate = legacyMondayTargetForWeek(anchorDate);
    const queries = {
      futureYearTasks: requested.has("FUTURE")
        ? getTasksByTargets("YEARLY", yearTargets) : Promise.resolve([]),
      future: requested.has("FUTURE")
        ? getTasks("FUTURE", targetFor("FUTURE", anchorDate)) : Promise.resolve([]),
      yearly: requested.has("YEARLY")
        ? getTasks("YEARLY", targetFor("YEARLY", anchorDate)) : Promise.resolve([]),
      monthly: requested.has("MONTHLY")
        ? getTasks("MONTHLY", targetFor("MONTHLY", anchorDate)) : Promise.resolve([]),
      weeklyTasks: requested.has("WEEKLY")
        ? getTasksByTargets("WEEKLY", [weeklyTargetDate, legacyWeeklyTargetDate])
        : Promise.resolve([]),
      daily: requested.has("DAILY")
        ? getTasks("DAILY", dailyTargetDate) : Promise.resolve([]),
      yearlyMonthTasks: requested.has("YEARLY")
        ? getTasksByTargetPrefix("MONTHLY", `${targetFor("YEARLY", anchorDate)}-`)
        : Promise.resolve([]),
      monthDailyTasks: requested.has("MONTHLY")
        ? getTasksByTargetPrefix("DAILY", `${targetFor("MONTHLY", anchorDate)}-`)
        : Promise.resolve([]),
      weekDailyTasks: requested.has("WEEKLY")
        ? getTasksByTargets("DAILY", weekTargets) : Promise.resolve([]),
      // Every planner overview includes its matching journal entries.
      journalEntries: getAllJournalEntries(),
      timelineRange: requested.has("DAILY")
        ? getTimelineRange(dailyTargetDate) : Promise.resolve(null),
    };
    const keys = Object.keys(queries);
    const values = await Promise.all(Object.values(queries));
    const data = Object.fromEntries(keys.map((key, index) => [key, values[index]]));

    return {
      tasks: {
        FUTURE: data.future,
        YEARLY: data.yearly,
        MONTHLY: data.monthly,
        WEEKLY: uniqueTasks(data.weeklyTasks),
        DAILY: data.daily,
      },
      futureYearTasks: data.futureYearTasks,
      yearlyMonthTasks: data.yearlyMonthTasks,
      monthDailyTasks: data.monthDailyTasks,
      weekDailyTasks: data.weekDailyTasks,
      journalEntries: data.journalEntries,
      timelineRange: requested.has("DAILY") ? normalizeTimelineRange(data.timelineRange) : null,
    };
  }

  async function loadTasks() {
    if (!state.dbReady) return;

    const currentLoad = ++loadVersion;
    const anchorDate = new Date(state.anchorDate);
    const visiblePeriods = state.activeTab
      ? [state.activeTab, state.sideTab, state.detailModal?.periodType].filter(Boolean)
      : null;
    const data = await loadTaskData(anchorDate, visiblePeriods);
    if (currentLoad !== loadVersion || anchorDate.getTime() !== state.anchorDate.getTime()) {
      return;
    }

    state.tasks.YEARLY = data.tasks.YEARLY;
    state.tasks.MONTHLY = data.tasks.MONTHLY;
    state.tasks.WEEKLY = data.tasks.WEEKLY;
    state.tasks.DAILY = data.tasks.DAILY;
    state.tasks.FUTURE = data.tasks.FUTURE;
    state.futureYearTasks = data.futureYearTasks;
    state.yearlyMonthTasks = data.yearlyMonthTasks;
    state.monthDailyTasks = data.monthDailyTasks;
    state.weekDailyTasks = data.weekDailyTasks;
    state.journalEntries = data.journalEntries;
    if (data.timelineRange) {
      state.timelineRanges[targetFor("DAILY", anchorDate)] = data.timelineRange;
    }
  }

  return {
    loadTaskData,
    loadTasks,
  };
}
