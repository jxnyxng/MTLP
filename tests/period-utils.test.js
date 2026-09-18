import test from "node:test";
import assert from "node:assert/strict";
import { targetFor, shiftedPeriodDate, periodLabel, inputTypeFor, dateInputValue, parseDateInput, titleFor } from "../src/period-utils.js";
import { toDateKey } from "../src/date-utils.js";

test("all period targets, labels and date input formats retain their behavior", () => {
  const date = new Date(2026, 8, 18);
  const periods = ["FUTURE", "YEARLY", "MONTHLY", "WEEKLY", "DAILY", "JOURNAL"];
  assert.deepEqual(periods.map((p) => targetFor(p, date)), ["2020", "2026", "2026-09", "2026-09-13", "2026-09-18", "2026-09-18"]);
  assert.deepEqual(periods.map((p) => inputTypeFor(p)), ["number", "number", "month", "date", "date", "date"]);
  assert.deepEqual(periods.map((p) => dateInputValue(p, date)), ["2020", "2026", "2026-09", "2026-09-18", "2026-09-18", "2026-09-18"]);
  assert.deepEqual(periods.map((p) => titleFor(p)), ["Long-term Plan", "Yearly Log", "Monthly Log", "Weekly Log", "Daily Log", "Journal"]);
  assert.deepEqual(periods.map((p) => periodLabel(p, date)), ["2020 - 2029", "2026년", "2026년 9월", "9/13 - 9/19", "9월 18일 금요일", "9월 18일 금요일"]);
});

test("month and year shifts clamp month ends, preserve time and never mutate the anchor", () => {
  for (const [period, year, month, day, amount, expected] of [
    ["MONTHLY", 2026, 0, 31, 1, "2026-02-28"],
    ["MONTHLY", 2024, 0, 31, 1, "2024-02-29"],
    ["MONTHLY", 2026, 2, 31, -1, "2026-02-28"],
    ["MONTHLY", 2026, 11, 31, 1, "2027-01-31"],
    ["YEARLY", 2024, 1, 29, 1, "2025-02-28"],
    ["FUTURE", 2024, 1, 29, 1, "2034-02-28"],
    ["WEEKLY", 2026, 11, 28, 1, "2027-01-04"],
    ["DAILY", 2026, 11, 31, 1, "2027-01-01"],
    ["JOURNAL", 2026, 0, 1, -1, "2025-12-31"],
  ]) {
    const anchor = new Date(year, month, day, 13, 45);
    const before = anchor.getTime();
    const result = shiftedPeriodDate(period, amount, anchor);
    assert.equal(toDateKey(result), expected);
    assert.equal(result.getHours(), 13);
    assert.equal(result.getMinutes(), 45);
    assert.equal(anchor.getTime(), before);
  }
});

test("date inputs parse all periods and reject invalid dates without rollover", () => {
  for (const [period, input, expected] of [
    ["FUTURE", "2030", "2030-01-01"], ["YEARLY", "2026", "2026-01-01"],
    ["MONTHLY", "2026-09", "2026-09-01"], ["WEEKLY", "2026-09-18", "2026-09-18"],
    ["DAILY", "2024-02-29", "2024-02-29"], ["JOURNAL", "2026-09-18", "2026-09-18"],
  ]) assert.equal(toDateKey(parseDateInput(period, input)), expected);
  for (const input of ["", "invalid", "2026-02-29", "2026-13-01", "2026-09-00", "2026-09-31"]) {
    assert.equal(parseDateInput("DAILY", input), null);
  }
  assert.equal(parseDateInput("YEARLY", "Infinity"), null);
});
