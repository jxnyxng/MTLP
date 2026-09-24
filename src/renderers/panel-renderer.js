import { createPeriodOverviewRenderer } from "./period-overview-renderer.js";
import { createDetailModalController } from "./detail-modal-controller.js";
import { createDailyPanelRenderer } from "./daily-panel-renderer.js";
import { createDayTaskCardRenderer } from "./day-task-card-renderer.js";
import { createPeriodBoardRenderer } from "./period-board-renderer.js";

export function createPanelRenderer({
  state,
  renderJournalPanel,
  openJournalEditor,
  createSplitTaskStack,
  createTaskStack,
  renderTaskList,
  titleFor,
  targetFor,
  timelineRangeFor,
  loadAndRender,
  loadTaskData,
  normalizeTimelineRange,
  futureYears,
  weekDates,
  monthWeeks,
  isCurrentDate,
  isCurrentHourBlock,
  hoursForRange,
  hourValue,
  toDateKey,
  toWeekStartDate,
}) {
  function createPanel(
    periodType,
    isCompanion = false,
    data = state,
    anchorDate = state.anchorDate,
    isDetail = false,
  ) {
    const panel = document.createElement("section");
    panel.className = `panel ${periodType.toLowerCase()}-panel`;
    if (isCompanion) panel.classList.add("companion-panel");
    if (isDetail) panel.classList.add("detail-panel");
    panel.setAttribute("aria-label", titleFor(periodType));
  
    if (periodType === "FUTURE") {
      renderFuturePanel(panel, data, anchorDate);
    } else if (periodType === "YEARLY") {
      renderYearlyPanel(panel, data, anchorDate, isDetail);
    } else if (periodType === "MONTHLY") {
      renderMonthlyPanel(panel, data, anchorDate, isDetail);
    } else if (periodType === "WEEKLY") {
      renderWeeklyPanel(panel, data, anchorDate, isDetail);
    } else if (periodType === "DAILY") {
      renderDailyPanel(panel, data, anchorDate);
    } else if (periodType === "JOURNAL") {
      renderJournalPanel(panel, data, anchorDate);
    } else {
      renderPeriodPanel(panel, periodType, data, anchorDate);
    }
  
    return panel;
  }
  
  function stagingKey(periodType, targetDate) {
    return `${periodType}:${targetDate}`;
  }

  function createStagingHeading(card, periodType, targetDate, label, extra = null) {
    const key = stagingKey(periodType, targetDate);
    const isCollapsed = state.collapsedSections.has(key);
    card.classList.toggle("is-collapsed", isCollapsed);
  
    const heading = document.createElement("h3");
    const toggle = document.createElement("button");
    toggle.className = "staging-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(!isCollapsed));
    toggle.innerHTML = `<span aria-hidden="true">›</span><strong>${label}</strong>`;
    toggle.addEventListener("click", () => {
      const content = card.querySelector(".staging-content, .split-task-stack");
      const nextCollapsed = !card.classList.contains("is-collapsed");
      toggle.setAttribute("aria-expanded", String(!nextCollapsed));
  
      if (content) {
        if (nextCollapsed) {
          content.style.height = `${content.scrollHeight}px`;
          content.getBoundingClientRect();
          card.classList.add("is-collapsed");
          requestAnimationFrame(() => {
            content.style.minHeight = "0px";
            content.style.height = "0px";
          });
        } else {
          const clearExpandedHeight = (event) => {
            if (event.propertyName !== "height") return;
            content.removeEventListener("transitionend", clearExpandedHeight);
            if (card.classList.contains("is-collapsed")) return;
            content.style.height = "";
            content.style.minHeight = "";
          };

          card.classList.remove("is-collapsed");
          content.style.height = "auto";
          content.style.minHeight = "";
          const expandedHeight = content.getBoundingClientRect().height;
          content.style.minHeight = "0px";
          content.style.height = "0px";
          content.getBoundingClientRect();
          content.addEventListener("transitionend", clearExpandedHeight);
          requestAnimationFrame(() => {
            content.style.height = `${expandedHeight}px`;
          });
        }
      }
  
      if (!content) card.classList.toggle("is-collapsed", nextCollapsed);
      if (nextCollapsed) {
        state.collapsedSections.add(key);
      } else {
        state.collapsedSections.delete(key);
      }
    });
  
    heading.append(toggle);
    if (extra) heading.append(extra);
    return heading;
  }

  const { createPeriodOverview, createTodoSummary } = createPeriodOverviewRenderer({
    state,
    createStagingHeading,
    createSplitTaskStack,
    openJournalEditor,
    targetFor,
    futureYears,
    weekDates,
    toDateKey,
  });

  const { renderDailyPanel } = createDailyPanelRenderer({
    state,
    targetFor,
    timelineRangeFor,
    normalizeTimelineRange,
    isCurrentDate,
    isCurrentHourBlock,
    hoursForRange,
    hourValue,
    createTodoSummary,
    createPeriodOverview,
    createTaskStack,
    renderTaskList,
  });

  const { closeDetailModal, openDetailModal, renderDetailModal } = createDetailModalController({
    state,
    loadAndRender,
    loadTaskData,
    titleFor,
    targetFor,
    weekDates,
    toDateKey,
    toWeekStartDate,
    createPanel,
  });

  const { createDayTaskCard } = createDayTaskCardRenderer({
    createTaskStack,
    isCurrentDate,
    openDetailModal,
    renderTaskList,
    toDateKey,
  });

  const { renderFuturePanel, renderMonthlyPanel, renderWeeklyPanel, renderYearlyPanel } =
    createPeriodBoardRenderer({
      state,
      createPeriodOverview,
      createTodoSummary,
      createTaskStack,
      createDayTaskCard,
      renderTaskList,
      openDetailModal,
      targetFor,
      futureYears,
      weekDates,
      monthWeeks,
      toDateKey,
    });
  
  function renderPeriodPanel(panel, periodType, data = state, anchorDate = state.anchorDate) {
    const list = document.createElement("ul");
    list.className = "task-list";
    list.dataset.periodType = periodType;
    list.dataset.targetDate = targetFor(periodType, anchorDate);
    renderTaskList(list, periodType, data.tasks[periodType], "새 불렛 입력 후 Enter");
    panel.append(createTaskStack(list));
  }
  
  return {
    closeDetailModal,
    createPanel,
    renderDetailModal,
  };
}
