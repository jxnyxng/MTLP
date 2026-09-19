export function createDailyPanelRenderer({
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
}) {
  function groupTasksByTimeBlock(tasks) {
    return tasks.reduce((groups, task) => {
      const timeBlock = task.time_block || null;
      if (!groups.has(timeBlock)) groups.set(timeBlock, []);
      groups.get(timeBlock).push(task);
      return groups;
    }, new Map());
  }

  function renderDailyPanel(panel, data = state, anchorDate = state.anchorDate) {
    const board = document.createElement("div");
    board.className = "daily-board";
    const range = timelineRangeFor(anchorDate, data);
    const now = new Date();
    const isToday = isCurrentDate(anchorDate, now);
    const dayTarget = targetFor("DAILY", anchorDate);
    const tasksByTimeBlock = groupTasksByTimeBlock(data.tasks.DAILY);
    const today = createTodoSummary("DAILY", tasksByTimeBlock.get(null) ?? [], "Daily task", dayTarget);

    const timeline = document.createElement("div");
    timeline.className = "timeline";
    const hourColumns = document.createElement("div");
    hourColumns.className = "timeline-columns";
    const columns = [document.createElement("div"), document.createElement("div")];
    columns.forEach((column) => { column.className = "timeline-column"; });

    const visibleHours = hoursForRange(range, normalizeTimelineRange);
    const selectedHours = new Set(visibleHours);
    const outsideTaskHours = [...new Set(data.tasks.DAILY
      .map((task) => task.time_block)
      .filter((timeBlock) => timeBlock && !selectedHours.has(timeBlock)))]
      .sort((left, right) => hourValue(left) - hourValue(right));
    const timelineHours = [...visibleHours, ...outsideTaskHours];

    timelineHours.forEach((hour, index) => {
      const row = document.createElement("section");
      row.className = "hour-row";
      if (isToday && isCurrentHourBlock(hour, now)) row.classList.add("current-hour-row");
      const label = document.createElement("strong");
      label.textContent = hour;
      const list = document.createElement("ul");
      list.className = "task-list compact";
      list.dataset.periodType = "DAILY";
      list.dataset.targetDate = dayTarget;
      list.dataset.timeBlock = hour;
      renderTaskList(list, "DAILY", tasksByTimeBlock.get(hour) ?? [], "이 칸에 입력 후 Enter");
      row.append(label, createTaskStack(list));
      columns[index < timelineHours.length / 2 ? 0 : 1].append(row);
    });

    hourColumns.append(...columns);
    timeline.append(hourColumns);
    board.append(createPeriodOverview("This Day", "DAILY", dayTarget, today, anchorDate, data), timeline);
    panel.append(board);
  }

  return { renderDailyPanel };
}
