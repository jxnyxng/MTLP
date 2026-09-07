function hourLabel(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function hourValue(timeBlock) {
  return Number(timeBlock?.split(":")[0]);
}

function isCurrentMonthDate(date, now = new Date()) {
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function isCurrentDate(date, now = new Date()) {
  return isCurrentMonthDate(date, now) && date.getDate() === now.getDate();
}

export function isCurrentHourBlock(timeBlock, now = new Date()) {
  return hourValue(timeBlock) === now.getHours();
}

export function hoursForRange(range, normalizeRange) {
  const normalized = normalizeRange(range);
  return Array.from(
    { length: normalized.end - normalized.start + 1 },
    (_, index) => hourLabel(normalized.start + index),
  );
}

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function toYearKey(date) {
  return String(date.getFullYear());
}

export function decadeStartYear(date = new Date()) {
  return Math.floor(date.getFullYear() / 10) * 10;
}

export function futureYears(date = new Date()) {
  const start = decadeStartYear(date);
  return Array.from({ length: 10 }, (_, index) => start + index);
}

export function toWeekStartDate(date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function weekDates(date = new Date()) {
  const start = toWeekStartDate(date);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function monthWeeks(date = new Date()) {
  const weeks = [];
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const cursor = toWeekStartDate(firstDay);
  const lastWeekStart = toWeekStartDate(lastDay);

  while (cursor <= lastWeekStart) {
    const days = weekDates(cursor);
    const anchorDate =
      days.find((day) => day.getMonth() === date.getMonth()) ?? new Date(cursor);
    weeks.push({
      targetDate: toDateKey(cursor),
      anchorDate,
      days,
    });
    cursor.setDate(cursor.getDate() + 7);
  }

  return weeks;
}

export function weekdayLabel(date) {
  return ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][
    date.getDay()
  ];
}
