export function createDetailModalController({
  state,
  loadAndRender,
  loadTaskData,
  titleFor,
  targetFor,
  weekDates,
  toDateKey,
  toWeekStartDate,
  createPanel,
}) {
  async function openDetailModal(periodType, anchorDate) {
    if (periodType === state.activeTab && periodType === "DAILY") return;
    state.detailModal = { periodType, anchorDate: new Date(anchorDate) };
    const detail = state.detailModal;
    await loadAndRender();
    if (state.detailModal !== detail) return;
    document.querySelector("#detail-modal").showModal();
  }

  function closeDetailModal() {
    state.detailModal = null;
    const modal = document.querySelector("#detail-modal");
    if (modal.open) modal.close();
    document.querySelector("#detail-view").replaceChildren();
  }

  async function renderDetailModal(isCurrent = () => true) {
    const modal = document.querySelector("#detail-modal");
    const detailView = document.querySelector("#detail-view");
    if (!state.detailModal) {
      if (modal.open) modal.close();
      detailView.replaceChildren();
      return;
    }

    const detail = state.detailModal;
    const { periodType, anchorDate } = detail;
    const data = await loadTaskData(anchorDate);
    if (state.detailModal !== detail || !isCurrent()) return;
    document.querySelector(".detail-modal").className =
      `detail-modal detail-modal-${periodType.toLowerCase()}`;
    document.querySelector("#detail-title").textContent = titleFor(periodType);
    document.querySelector("#detail-meta").textContent = periodType === "WEEKLY"
      ? `${toDateKey(toWeekStartDate(anchorDate))} - ${toDateKey(weekDates(anchorDate).at(-1))}`
      : targetFor(periodType, anchorDate);
    detailView.replaceChildren(createPanel(periodType, false, data, anchorDate, true));
  }

  return { closeDetailModal, openDetailModal, renderDetailModal };
}
