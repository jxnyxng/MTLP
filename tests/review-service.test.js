import test from "node:test";
import assert from "node:assert/strict";
import { collectReviewTasks, createReviewService } from "../src/services/review-service.js";
import { installFakeDom } from "./helpers/fake-dom.js";

function setup(t, overrides = {}) {
  const { body } = installFakeDom(t);
  const summary = document.createElement("section");
  summary.id = "ai-summary";
  summary.hidden = true;
  body.append(summary);
  const state = { dbReady: true, activeTab: "DAILY", tasks: { DAILY: [
    { id: 1, status: "DONE", content: "완료" }, { id: 2, status: "TODO", content: "대기" },
  ] }, futureYearTasks: [], yearlyMonthTasks: [], monthDailyTasks: [], weekDailyTasks: [] };
  const service = createReviewService({
    state,
    hasApiKey: async () => true,
    generateReview: async () => ({ summary: "회고", feedback: "피드백", nextAction: "실행" }),
    ...overrides,
  });
  return { state, summary, service };
}

test("review service builds a task prompt and renders the generated review", async (t) => {
  let request;
  const { summary, service } = setup(t, { generateReview: async (value) => {
    request = value;
    return { summary: "회고", feedback: "피드백", nextAction: "실행" };
  } });
  await service.requestReview();
  assert.match(request, /DONE: 완료/);
  assert.match(request, /TODO: 대기/);
  assert.match(request, /저널 원문은 포함되지 않았습니다/);
  assert.match(summary.textContent, /성과: 회고/);
  assert.equal(summary.hidden, false);
});

test("review service reports network failures without replacing them with an exception", async (t) => {
  const originalError = console.error;
  console.error = () => {};
  t.after(() => { console.error = originalError; });
  const { summary, service } = setup(t, { generateReview: async () => { throw new Error("offline"); } });
  await service.requestReview();
  assert.match(summary.textContent, /요청에 실패/);
});

test("review service includes child-period tasks once", () => {
  const shared = { id: 2, status: "TODO", content: "daily" };
  const tasks = collectReviewTasks({
    activeTab: "MONTHLY",
    tasks: { MONTHLY: [{ id: 1, status: "DONE", content: "goal" }] },
    monthDailyTasks: [shared, shared],
  });
  assert.deepEqual(tasks.map(({ id }) => id), [1, 2]);
});

test("review service reports quota errors specifically", async (t) => {
  const originalError = console.error;
  console.error = () => {};
  t.after(() => { console.error = originalError; });
  const { summary, service } = setup(t, {
    generateReview: async () => { throw new Error("GEMINI_HTTP_429"); },
  });
  await service.requestReview();
  assert.match(summary.textContent, /요청 한도를 초과/);
});

test("review service ignores duplicate requests while one is in flight", async (t) => {
  let release;
  let requests = 0;
  const pending = new Promise((resolve) => { release = resolve; });
  const { service } = setup(t, {
    generateReview: async () => {
      requests += 1;
      await pending;
      return { summary: "회고", feedback: "피드백", nextAction: "실행" };
    },
  });
  const first = service.requestReview();
  const duplicate = service.requestReview();
  await Promise.resolve();
  assert.equal(requests, 1);
  release();
  await Promise.all([first, duplicate]);
  assert.equal(requests, 1);
});
