export function createShellRenderer({
  app,
  state,
  tabs,
  createTimelineRangeControls,
  dateInputValue,
  inputTypeFor,
  jumpToday,
  loadAndRender,
  openSettings,
  parseDateInput,
  periodLabel,
  requestReview,
  shiftDate,
  shiftedPeriodDate,
  switchTab,
  timelineRangeFor,
  toDateKey,
}) {
  function renderShell() {
    app.innerHTML = `
      <main class="shell" data-sidebar-collapsed="false">
        <aside class="sidebar">
          <div class="sidebar-head">
            <button class="icon-button" id="sidebar-toggle" type="button" aria-label="사이드바 접기">☰</button>
            <div class="brand">
              <strong>MTLP</strong>
              <span>My Tiny Local Planner</span>
            </div>
          </div>
          <nav class="tabs" aria-label="Planner views"></nav>
          <div class="sidebar-actions">
            <button id="review-button" class="review-action" type="button" aria-label="AI 회고 요약">
              <span class="sidebar-action-icon review-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <defs>
                    <clipPath id="gemini-tip-cut">
                      <rect x="1.6" y="1.6" width="20.8" height="20.8" rx="0.2" />
                    </clipPath>
                    <filter id="gemini-round">
                      <feGaussianBlur in="SourceAlpha" stdDeviation="0.35" result="blur" />
                      <feColorMatrix
                        in="blur"
                        mode="matrix"
                        values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
                        result="round"
                      />
                      <feComposite in="SourceGraphic" in2="round" operator="in" />
                    </filter>
                  </defs>
                  <path clip-path="url(#gemini-tip-cut)" filter="url(#gemini-round)" stroke="currentColor" stroke-width="0.55" stroke-linejoin="round" d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" />
                </svg>
              </span>
              <span class="sidebar-action-label">AI 회고</span>
            </button>
            <button id="settings-button" type="button" aria-label="설정">
              <span class="sidebar-action-icon settings-action-icon" aria-hidden="true">⚙</span>
              <span class="sidebar-action-label">설정</span>
            </button>
          </div>
        </aside>
        <section class="workspace">
          <header class="topbar">
            <div class="topbar-title">
              <div class="topbar-title-row">
                <h1 id="view-title"></h1>
                <button id="today-jump" class="today-button" type="button"></button>
              </div>
              <p id="view-meta"></p>
            </div>
            <section id="period-nav" class="period-nav"></section>
            <section class="topbar-actions">
              <section id="view-actions" class="view-actions"></section>
              <section id="lock-actions" class="lock-actions"></section>
            </section>
          </header>
          <section id="view"></section>
          <section id="ai-summary" class="summary" hidden></section>
        </section>
      </main>
      <dialog id="settings-modal">
        <form method="dialog" class="modal">
          <header class="modal-header">
            <h2>설정</h2>
            <button class="modal-close icon-button" value="cancel" type="submit" aria-label="닫기">×</button>
          </header>
          <fieldset class="theme-settings">
            <legend>테마</legend>
            <div id="theme-options" class="theme-options"></div>
          </fieldset>
          <details class="api-key-setting">
            <summary>Gemini API Key</summary>
            <div class="api-key-row">
              <input id="api-key-input" type="password" autocomplete="off" />
              <button id="save-api-key" value="default" type="button">저장</button>
            </div>
          </details>
        </form>
      </dialog>
      <dialog id="detail-modal">
        <section class="detail-modal">
          <header class="detail-modal-head">
            <div>
              <h2 id="detail-title"></h2>
              <p id="detail-meta"></p>
            </div>
            <button id="detail-close" class="icon-button" type="button" aria-label="닫기">×</button>
          </header>
          <section id="detail-view"></section>
        </section>
      </dialog>
    `;
  }

  function bindShellEvents({ closeDetailModal, handleTaskBlockShortcuts, saveSettings }) {
    document.querySelector("#sidebar-toggle").addEventListener("click", () => {
      const shell = document.querySelector(".shell");
      const collapsed = shell.dataset.sidebarCollapsed === "true";
      shell.dataset.sidebarCollapsed = String(!collapsed);
    });
    document.querySelector("#settings-button").addEventListener("click", openSettings);
    document.querySelector("#save-api-key").addEventListener("click", saveSettings);
    document.querySelector("#review-button").addEventListener("click", requestReview);
    document.querySelector("#today-jump").addEventListener("click", jumpToday);
    document.querySelector("#detail-close").addEventListener("click", closeDetailModal);
    document.querySelector("#detail-modal").addEventListener("close", () => {
      state.detailModal = null;
    });
    document.addEventListener("keydown", handleTaskBlockShortcuts);
  }

  function renderTabs() {
    const nav = document.querySelector(".tabs");
    nav.replaceChildren(
      ...tabs.map((tab) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = tab.id === state.activeTab ? "active" : "";
        button.title = tab.label;
        button.setAttribute("aria-label", tab.label);

        const icon = document.createElement("span");
        icon.className = "tab-icon";
        icon.textContent = tab.icon;
        icon.setAttribute("aria-hidden", "true");

        const label = document.createElement("span");
        label.className = "tab-label";
        label.textContent = tab.label.toLowerCase();

        button.append(icon, label);
        button.addEventListener("click", async () => {
          await switchTab(tab.id);
        });
        return button;
      }),
    );
  }

  function renderViewActions({ closeSidePanel, openSidePanel }) {
    const actions = document.querySelector("#view-actions");
    const lockActions = document.querySelector("#lock-actions");
    const actionItems = [];

    const companionButtons = (state.activeTab === "JOURNAL" ? [] : tabs)
      .filter((tab) => tab.id !== "JOURNAL")
      .filter((tab) => tab.id !== state.activeTab && tab.id !== state.sideTab)
      .map((tab) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = tab.label.slice(0, 1);
        button.title = `${tab.label} 함께 보기`;
        button.setAttribute("aria-label", `${tab.label} 함께 보기`);
        button.addEventListener("click", async () => {
          await openSidePanel(tab.id);
        });
        return button;
      });
    actionItems.push(...companionButtons);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = ">";
    closeButton.title = "우측 닫기";
    closeButton.setAttribute("aria-label", "우측 닫기");
    closeButton.hidden = !state.sideTab;
    closeButton.addEventListener("click", async () => {
      await closeSidePanel();
    });
    actionItems.push(closeButton);

    if (state.activeTab === "DAILY") {
      actionItems.push(createTimelineRangeControls(state.anchorDate, timelineRangeFor(state.anchorDate)));
    }

    const lockButton = document.createElement("button");
    lockButton.type = "button";
    lockButton.className = "lock-mode-button";
    lockButton.title = state.isLocked ? "입력 잠금 해제" : "보기 전용으로 잠금";
    lockButton.setAttribute("aria-label", state.isLocked ? "입력 잠금 해제" : "보기 전용으로 잠금");
    lockButton.setAttribute("aria-pressed", String(state.isLocked));
    lockButton.innerHTML = state.isLocked
      ? `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M7.5 10.5H18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h1.5Z" />
          <path d="M8.5 10.5V8.2A3.7 3.7 0 0 1 12.2 4.5a3.7 3.7 0 0 1 3.7 3.7" />
          <path d="M12 14.4v2.2" />
        </svg>`
      : `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="4" y="10.5" width="16" height="10" rx="2" />
          <path d="M8 10.5V8.2A4 4 0 0 1 12 4.2a4 4 0 0 1 4 4v2.3" />
          <path d="M12 14.4v2.2" />
        </svg>`;
    lockButton.addEventListener("click", async () => {
      state.isLocked = !state.isLocked;
      await loadAndRender();
    });

    actions.replaceChildren(...actionItems);
    lockActions.replaceChildren(...(state.activeTab === "JOURNAL" ? [] : [lockButton]));
  }

  function renderPeriodNav() {
    const nav = document.querySelector("#period-nav");
    nav.replaceChildren();
    if (state.activeTab === "JOURNAL") return;
    renderDateControls(nav, state.activeTab);
  }

  function renderDateControls(container, periodType) {
    const controls = document.createElement("div");
    controls.className = "date-carousel";
    if (state.shouldAnimatePeriod) controls.classList.add("animate-period");

    const previous = document.createElement("button");
    previous.type = "button";
    previous.className = "period-card side-card";
    previous.textContent = "‹";
    previous.setAttribute("aria-label", `${periodLabel(periodType, shiftedPeriodDate(periodType, -1))}로 이동`);
    previous.title = "이전";
    previous.addEventListener("click", async () => {
      shiftDate(periodType, -1);
      await loadAndRender();
    });

    const currentWrap = document.createElement("div");
    currentWrap.className = "current-period";

    const current = document.createElement("button");
    current.type = "button";
    current.className = "period-card current-card";
    current.textContent = periodLabel(periodType, state.anchorDate);
    current.title = "직접 입력";

    const picker = document.createElement("input");
    picker.className = "period-input";
    picker.type = inputTypeFor(periodType);
    picker.value = dateInputValue(periodType);
    picker.hidden = true;
    if (periodType === "FUTURE" || periodType === "YEARLY") {
      picker.min = "1900";
      picker.max = "2100";
    }

    current.addEventListener("click", () => {
      current.hidden = true;
      picker.hidden = false;
      picker.focus();
      picker.select();
    });
    picker.addEventListener("change", async () => {
      parseDateInput(periodType, picker.value);
      await loadAndRender();
    });
    picker.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") return;
      parseDateInput(periodType, picker.value);
      await loadAndRender();
    });
    picker.addEventListener("blur", () => {
      picker.hidden = true;
      current.hidden = false;
    });

    const next = document.createElement("button");
    next.type = "button";
    next.className = "period-card side-card";
    next.textContent = "›";
    next.setAttribute("aria-label", `${periodLabel(periodType, shiftedPeriodDate(periodType, 1))}로 이동`);
    next.title = "다음";
    next.addEventListener("click", async () => {
      shiftDate(periodType, 1);
      await loadAndRender();
    });

    currentWrap.append(current, picker);
    controls.append(previous, currentWrap, next);
    container.append(controls);
  }

  function renderViewHeading(title) {
    document.querySelector("#view-title").textContent = title;
    const todayJump = document.querySelector("#today-jump");
    todayJump.textContent = `Today, ${toDateKey(new Date())}`;
    todayJump.hidden = state.activeTab === "JOURNAL";
    document.querySelector("#view-meta").textContent = "";
  }

  return {
    bindShellEvents,
    renderPeriodNav,
    renderShell,
    renderTabs,
    renderViewActions,
    renderViewHeading,
  };
}
