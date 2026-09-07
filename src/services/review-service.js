export function createReviewService({
  state,
  getApiKey,
}) {
  function hideReviewSummary() {
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
    showReviewSummary("AI 회고 요약 생성 중...");

    if (!state.dbReady) {
      showReviewSummary("SQLite가 준비된 Tauri 실행 환경에서 사용할 수 있습니다.");
      return;
    }

    const tasks = state.tasks[state.activeTab] ?? [];
    if (!tasks.length) {
      showReviewSummary("요약할 태스크가 없습니다.");
      return;
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      showReviewSummary("설정에서 Gemini API Key를 먼저 저장해주세요.");
      return;
    }

    const done = tasks.filter((task) => task.status === "DONE").map((task) => task.content);
    const pending = tasks
      .filter((task) => task.status !== "DONE")
      .map((task) => `${task.status}: ${task.content}`);

    const prompt = `다음은 사용자의 [${state.activeTab}] 불렛저널 일정 데이터입니다:
- 완료: ${done.length ? done.join(", ") : "없음"}
- 미완료: ${pending.length ? pending.join(", ") : "없음"}

이 데이터를 분석하여 (1) 성과 요약, (2) 미완료 항목에 대한 피드백, (3) 다음 주기 실행 제안을 3줄 내외로 간결하게 한국어로 작성해주세요.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        },
      );

      if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
      const data = await response.json();
      showReviewSummary(
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
          "Gemini 응답에서 요약 텍스트를 찾지 못했습니다.",
      );
    } catch (error) {
      console.error(error);
      showReviewSummary("AI 회고 요약 요청에 실패했습니다.");
    }
  }

  return {
    requestReview,
  };
}
