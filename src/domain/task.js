export const TASK_STATUSES = Object.freeze(["TODO", "DONE", "CANCELLED"]);
export const PERIOD_TYPES = Object.freeze(["FUTURE", "YEARLY", "MONTHLY", "WEEKLY", "DAILY"]);

const taskStatuses = new Set(TASK_STATUSES);
const periodTypes = new Set(PERIOD_TYPES);

export class DomainValidationError extends Error {
  constructor(field, value, message = "유효하지 않은 값입니다.") {
    super(`${field}: ${message}`);
    this.name = "DomainValidationError";
    this.code = "INVALID_DOMAIN_VALUE";
    this.field = field;
    this.value = value;
  }
}

function invalid(field, value, message) {
  throw new DomainValidationError(field, value, message);
}

export function assertTaskId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) invalid("task.id", value, "양의 정수여야 합니다.");
  return id;
}

export function assertTaskStatus(value) {
  if (!taskStatuses.has(value)) invalid("task.status", value, "지원하지 않는 상태입니다.");
  return value;
}

export function assertPeriodType(value) {
  if (!periodTypes.has(value)) invalid("task.periodType", value, "지원하지 않는 기간 유형입니다.");
  return value;
}

export function assertTaskContent(value) {
  if (typeof value !== "string") invalid("task.content", value, "문자열이어야 합니다.");
  return value;
}

export function assertPosition(value) {
  const position = Number(value);
  if (!Number.isSafeInteger(position) || position < 0) {
    invalid("task.position", value, "0 이상의 정수여야 합니다.");
  }
  return position;
}

export function assertTargetDate(periodType, value) {
  if (typeof value !== "string") invalid("task.targetDate", value, "문자열이어야 합니다.");
  const patterns = {
    FUTURE: /^\d{4}$/,
    YEARLY: /^\d{4}$/,
    MONTHLY: /^\d{4}-(0[1-9]|1[0-2])$/,
    WEEKLY: /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/,
    DAILY: /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/,
  };
  if (!patterns[periodType]?.test(value)) {
    invalid("task.targetDate", value, `${periodType} 형식과 맞지 않습니다.`);
  }
  if (periodType === "DAILY" || periodType === "WEEKLY") {
    const [year, month, day] = value.split("-").map(Number);
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day < 1 || day > daysInMonth[month - 1]) {
      invalid("task.targetDate", value, "존재하지 않는 날짜입니다.");
    }
  }
  return value;
}

export function assertOptionalTimeBlock(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):00$/.test(value)) {
    invalid("task.timeBlock", value, "HH:00 형식이어야 합니다.");
  }
  return value;
}

export function assertOptionalSplitLane(value) {
  if (value === null || value === undefined || value === "") return null;
  const lane = Number(value);
  if (!Number.isInteger(lane) || (lane !== 0 && lane !== 1)) {
    invalid("task.splitLane", value, "0 또는 1이어야 합니다.");
  }
  return lane;
}

export function validateTaskWrite({ id, content, status, periodType, targetDate, position, timeBlock, splitLane }) {
  return {
    ...(id === undefined ? {} : { id: assertTaskId(id) }),
    ...(content === undefined ? {} : { content: assertTaskContent(content) }),
    ...(status === undefined ? {} : { status: assertTaskStatus(status) }),
    ...(periodType === undefined ? {} : { periodType: assertPeriodType(periodType) }),
    ...(targetDate === undefined ? {} : { targetDate: assertTargetDate(periodType, targetDate) }),
    ...(position === undefined ? {} : { position: assertPosition(position) }),
    ...(timeBlock === undefined ? {} : { timeBlock: assertOptionalTimeBlock(timeBlock) }),
    ...(splitLane === undefined ? {} : { splitLane: assertOptionalSplitLane(splitLane) }),
  };
}

export function validateTaskRow(row) {
  if (!row || typeof row !== "object") invalid("task", row, "DB 행이 객체가 아닙니다.");
  validateTaskWrite({
    id: row.id,
    content: row.content,
    status: row.status,
    periodType: row.period_type,
    targetDate: row.target_date,
    position: row.position,
    timeBlock: row.time_block ?? null,
    splitLane: row.split_lane ?? null,
  });
  return row;
}
