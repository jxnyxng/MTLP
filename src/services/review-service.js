import { geminiClient } from "./gemini-client.js";

export function collectReviewTasks(state) {
  const sources = {
    FUTURE: [state.tasks.FUTURE, state.futureYearTasks],
    YEARLY: [state.tasks.YEARLY, state.yearlyMonthTasks],
    MONTHLY: [state.tasks.MONTHLY, state.monthDailyTasks],
    WEEKLY: [state.tasks.WEEKLY, state.weekDailyTasks],
    DAILY: [state.tasks.DAILY],
  }[state.activeTab] ?? [[]];
  const seen = new Set();
  return sources.filter(Array.isArray).flat().filter((task) => {
    if (seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
}

export function createReviewService({
  state,
  hasApiKey = geminiClient.hasApiKey,
  generateReview = geminiClient.generateReview,
}) {
  let requestVersion = 0;
  let isRequesting = false;

  function hideReviewSummary() {
    requestVersion += 1;
    const summary = document.querySelector("#ai-summary");
    if (!summary) return;
    summary.hidden = true;
    summary.replaceChildren();
  }

  function showReviewSummary(message) {
    const summary = document.querySelector("#ai-summary");
    if (!summary) return;

    const content = document.createElement("div");
    content.className = "summary-content";
    content.textContent = message;

    const closeButton = document.createElement("button");
    closeButton.className = "summary-close";
    closeButton.type = "button";
    closeButton.textContent = "×";
    closeButton.setAttribute("aria-label", "AI 회고 요약 닫기");
    closeButton.addEventListener("click", hideReviewSummary);

    summary.hidden = false;
    summary.replaceChildren(content, closeButton);
  }

  async function requestReview() {
    if (isRequesting) return;
    const currentRequest = ++requestVersion;
    isRequesting = true;
    showReviewSummary("AI 회고 요약 생성 중...");

    try {
      if (!state.dbReady) throw new Error("NOT_TAURI");
      const tasks = collectReviewTasks(state).slice(0, 200);
      if (!tasks.length) throw new Error("NO_TASKS");
      if (!(await hasApiKey())) throw new Error("MISSING_API_KEY");
      const done = tasks.filter((task) => task.status === "DONE");
      const pending = tasks.filter((task) => task.status !== "DONE");
      const format = (task) => `${task.status}: ${String(task.content).slice(0, 300)}`;
      const prompt = `다음은 사용자의 [${state.activeTab}] 플래너 태스크입니다.
완료 ${done.length}/${tasks.length}: ${done.map(format).join(" | ") || "없음"}
미완료 ${pending.length}/${tasks.length}: ${pending.map(format).join(" | ") || "없음"}
저널 원문은 포함되지 않았습니다.
한국어로 회고하고 JSON 객체만 반환하세요: {"summary":"성과 요약","feedback":"미완료 피드백","nextAction":"다음 주기 실행 제안"}`;
      const review = await generateReview(prompt);
      if (currentRequest !== requestVersion) return;
      showReviewSummary(`성과: ${review.summary}\n피드백: ${review.feedback}\n다음 실행: ${review.nextAction}`);
    } catch (error) {
      console.error(error);
      if (currentRequest !== requestVersion) return;
      const code = String(error?.message ?? error);
      const message = code.includes("NO_TASKS") ? "요약할 태스크가 없습니다."
        : code.includes("MISSING_API_KEY") ? "설정에서 Gemini API Key를 먼저 저장해주세요."
          : code.includes("NOT_TAURI") ? "Tauri 실행 환경에서 사용할 수 있습니다."
            : code.includes("GEMINI_HTTP_401") || code.includes("GEMINI_HTTP_403") ? "API Key 권한을 확인해주세요."
              : code.includes("GEMINI_HTTP_429") ? "Gemini 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요."
                : code.includes("GEMINI_TIMEOUT") ? "Gemini 응답 시간이 초과되었습니다."
                  : "AI 회고 요약 요청에 실패했습니다.";
      showReviewSummary(message);
    } finally {
      isRequesting = false;
    }
  }

  return {
    requestReview,
  };
}
