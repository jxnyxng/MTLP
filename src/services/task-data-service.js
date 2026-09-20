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

  async function loadTaskData(anchorDate) {
    const weekTargets = weekDates(anchorDate).map(toDateKey);
    const yearTargets = futureYears(anchorDate).map(String);
    const dailyTargetDate = targetFor("DAILY", anchorDate);
    const weeklyTargetDate = targetFor("WEEKLY", anchorDate);
    const legacyWeeklyTargetDate = legacyMondayTargetForWeek(anchorDate);
    const [
      futureYearTasks,
      future,
      yearly,
      monthly,
      weeklyTasks,
      daily,
      yearlyMonthTasks,
      monthDailyTasks,
      weekDailyTasks,
      journalEntries,
      timelineRange,
    ] = await Promise.all([
      getTasksByTargets("YEARLY", yearTargets),
      getTasks("FUTURE", targetFor("FUTURE", anchorDate)),
      getTasks("YEARLY", targetFor("YEARLY", anchorDate)),
      getTasks("MONTHLY", targetFor("MONTHLY", anchorDate)),
      getTasksByTargets("WEEKLY", [weeklyTargetDate, legacyWeeklyTargetDate]),
      getTasks("DAILY", dailyTargetDate),
      getTasksByTargetPrefix("MONTHLY", `${targetFor("YEARLY", anchorDate)}-`),
      getTasksByTargetPrefix("DAILY", `${targetFor("MONTHLY", anchorDate)}-`),
      getTasksByTargets("DAILY", weekTargets),
      getAllJournalEntries(),
      getTimelineRange(dailyTargetDate),
    ]);

    return {
      tasks: {
        FUTURE: future,
        YEARLY: yearly,
        MONTHLY: monthly,
        WEEKLY: uniqueTasks(weeklyTasks),
        DAILY: daily,
      },
      futureYearTasks,
      yearlyMonthTasks,
      monthDailyTasks,
      weekDailyTasks,
      journalEntries,
      timelineRange: normalizeTimelineRange(timelineRange),
    };
  }

  async function loadTasks() {
    if (!state.dbReady) return;

    const currentLoad = ++loadVersion;
    const anchorDate = new Date(state.anchorDate);
    const data = await loadTaskData(anchorDate);
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
    state.timelineRanges[targetFor("DAILY", anchorDate)] = data.timelineRange;
  }

  return {
    loadTaskData,
    loadTasks,
  };
}
