export const POSITION_STEP = 1000;

export function getNextPosition(items) {
  if (!items.length) return POSITION_STEP;
  return items.reduce((maximum, item) => Math.max(maximum, Number(item.position) || 0), -Infinity)
    + POSITION_STEP;
}

export function calculateAppendPosition(list) {
  return getNextPosition(
    Array.from(list.children)
      .filter((child) => child.classList.contains("task-item"))
      .map((child) => ({ position: child.dataset.position })),
  );
}

export function splitTasksIntoLanes(tasks) {
  const lanes = [[], []];
  let fallbackIndex = 0;
  for (const task of tasks) {
    const hasSavedLane = task.split_lane !== null && task.split_lane !== undefined;
    const savedLane = hasSavedLane ? Number(task.split_lane) : null;
    const lane = savedLane === 0 || savedLane === 1 ? savedLane : fallbackIndex++ % 2;
    lanes[lane].push(task);
  }
  return lanes;
}
