export function createTaskDataService({
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
}) {
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
      futureYearGroups,
      future,
      yearly,
      monthly,
      weeklyGroups,
      daily,
      yearlyMonthTasks,
      monthDailyTasks,
      weekDailyGroups,
      journalEntries,
      timelineRange,
    ] = await Promise.all([
      Promise.all(yearTargets.map((targetDate) => getTasks("YEARLY", targetDate))),
      getTasks("FUTURE", targetFor("FUTURE", anchorDate)),
      getTasks("YEARLY", targetFor("YEARLY", anchorDate)),
      getTasks("MONTHLY", targetFor("MONTHLY", anchorDate)),
      Promise.all(
        [weeklyTargetDate, legacyWeeklyTargetDate]
          .filter((targetDate, index, targetDates) => targetDates.indexOf(targetDate) === index)
          .map((targetDate) => getTasks("WEEKLY", targetDate)),
      ),
      getTasks("DAILY", dailyTargetDate),
      getTasksByTargetPrefix("MONTHLY", `${targetFor("YEARLY", anchorDate)}-`),
      getTasksByTargetPrefix("DAILY", `${targetFor("MONTHLY", anchorDate)}-`),
      Promise.all(weekTargets.map((targetDate) => getTasks("DAILY", targetDate))),
      getAllJournalEntries(),
      getTimelineRange(dailyTargetDate),
    ]);

    return {
      tasks: {
        FUTURE: future,
        YEARLY: yearly,
        MONTHLY: monthly,
        WEEKLY: uniqueTasks(weeklyGroups.flat()),
        DAILY: daily,
      },
      futureYearTasks: futureYearGroups.flat(),
      yearlyMonthTasks,
      monthDailyTasks,
      weekDailyTasks: weekDailyGroups.flat(),
      journalEntries,
      timelineRange: normalizeTimelineRange(timelineRange),
    };
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
    state.journalEntries = data.journalEntries;
    state.timelineRanges[targetFor("DAILY", state.anchorDate)] = data.timelineRange;
  }

  return {
    loadTaskData,
    loadTasks,
  };
}
