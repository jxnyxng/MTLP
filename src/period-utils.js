import { decadeStartYear, futureYears, toYearKey, toMonthKey, toDateKey, toWeekStartDate, weekdayLabel } from "./date-utils.js";

export function targetFor(periodType, date) {
  if (periodType === "FUTURE") return String(decadeStartYear(date));
  if (periodType === "YEARLY") return toYearKey(date);
  if (periodType === "MONTHLY") return toMonthKey(date);
  if (periodType === "WEEKLY") return toDateKey(toWeekStartDate(date));
  if (periodType === "JOURNAL") return toDateKey(date);
  return toDateKey(date);
}

export function titleFor(periodType) {
  if (periodType === "FUTURE") return "Long-term Plan";
  if (periodType === "YEARLY") return "Yearly Log";
  if (periodType === "MONTHLY") return "Monthly Log";
  if (periodType === "WEEKLY") return "Weekly Log";
  if (periodType === "JOURNAL") return "Journal";
  return "Daily Log";
}

export function shiftedPeriodDate(periodType, amount, anchorDate) {
  const next = new Date(anchorDate);
  if (["FUTURE", "YEARLY", "MONTHLY"].includes(periodType)) {
    const day = next.getDate();
    next.setDate(1);
    if (periodType === "MONTHLY") next.setMonth(next.getMonth() + amount);
    else next.setFullYear(next.getFullYear() + amount * (periodType === "FUTURE" ? 10 : 1));
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, lastDay));
  }
  if (periodType === "WEEKLY") next.setDate(next.getDate() + amount * 7);
  if (periodType === "JOURNAL") next.setDate(next.getDate() + amount);
  if (periodType === "DAILY") next.setDate(next.getDate() + amount);
  return next;
}

export function periodLabel(periodType, date) {
  if (periodType === "FUTURE") {
    const years = futureYears(date);
    return `${years[0]} - ${years.at(-1)}`;
  }
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
  if (periodType === "JOURNAL") return `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdayLabel(date)}`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdayLabel(date)}`;
}

export function inputTypeFor(periodType) {
  if (periodType === "FUTURE") return "number";
  if (periodType === "YEARLY") return "number";
  if (periodType === "MONTHLY") return "month";
  return "date";
}

export function dateInputValue(periodType, anchorDate) {
  if (periodType === "FUTURE") return targetFor("FUTURE", anchorDate);
  if (periodType === "YEARLY") return targetFor("YEARLY", anchorDate);
  if (periodType === "MONTHLY") return targetFor("MONTHLY", anchorDate);
  return toDateKey(anchorDate);
}

export function parseDateInput(periodType, value) {
  if (!value) return null;
  let year, month = 1, day = 1;
  if (periodType === "YEARLY" || periodType === "FUTURE") {
    if (!/^\d+$/.test(value)) return null;
    year = Number(value);
  } else {
    const pattern = periodType === "MONTHLY" ? /^\d{4,}-\d{2}$/ : /^\d{4,}-\d{2}-\d{2}$/;
    if (!pattern.test(value)) return null;
    [year, month, day = 1] = value.split("-").map(Number);
  }
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

