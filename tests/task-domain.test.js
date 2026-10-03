import test from "node:test";
import assert from "node:assert/strict";
import {
  DomainValidationError,
  assertTargetDate,
  validateTaskRow,
  validateTaskWrite,
} from "../src/domain/task.js";

test("task writes normalize database-compatible values", () => {
  assert.deepEqual(validateTaskWrite({
    id: "7",
    content: "task",
    status: "TODO",
    periodType: "DAILY",
    targetDate: "2026-09-17",
    position: "1000",
    timeBlock: "09:00",
    splitLane: "1",
  }), {
    id: 7,
    content: "task",
    status: "TODO",
    periodType: "DAILY",
    targetDate: "2026-09-17",
    position: 1000,
    timeBlock: "09:00",
    splitLane: 1,
  });
});

test("invalid task values fail before reaching persistence or rendering", () => {
  assert.throws(() => validateTaskWrite({ status: "BROKEN" }), DomainValidationError);
  assert.throws(() => validateTaskWrite({ position: -1 }), /task.position/);
  assert.throws(() => validateTaskWrite({ splitLane: 3 }), /task.splitLane/);
  assert.throws(() => assertTargetDate("MONTHLY", "2026-13"), /task.targetDate/);
  assert.throws(() => assertTargetDate("DAILY", "2026-02-29"), /존재하지 않는 날짜/);
  assert.equal(assertTargetDate("DAILY", "2028-02-29"), "2028-02-29");
  assert.throws(() => validateTaskRow({
    id: 1,
    content: "task",
    status: "UNKNOWN",
    period_type: "DAILY",
    target_date: "2026-09-17",
    position: 1000,
  }), /task.status/);
});
