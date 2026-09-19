export function createTimelineRangeRenderer({
  state,
  timelineHourOptions,
  targetFor,
  saveTimelineRange,
  setStatus,
  loadAndRender,
}) {
  function createTimelineRangeControls(anchorDate, range) {
    const controls = document.createElement("div");
    controls.className = "timeline-range-controls";

    const startSelect = document.createElement("select");
    startSelect.setAttribute("aria-label", "시작 시간");

    const endSelect = document.createElement("select");
    endSelect.setAttribute("aria-label", "끝 시간");

    timelineHourOptions.forEach((label, hour) => {
      if (hour < 24) {
        const option = document.createElement("option");
        option.value = String(hour);
        option.textContent = label;
        startSelect.append(option);
      }
      if (hour > 0) {
        const option = document.createElement("option");
        option.value = String(hour);
        option.textContent = label;
        endSelect.append(option);
      }
    });

    startSelect.value = String(range.start);
    endSelect.value = String(range.end);

    const saveRange = async () => {
      let start = Number(startSelect.value);
      let end = Number(endSelect.value);
      if (start >= end) {
        if (document.activeElement === startSelect) {
          end = Math.min(24, start + 1);
          endSelect.value = String(end);
        } else {
          start = Math.max(0, end - 1);
          startSelect.value = String(start);
        }
      }

      const targetDate = targetFor("DAILY", anchorDate);
      const previousRange = state.timelineRanges[targetDate];
      const nextRange = { start, end };
      startSelect.disabled = true;
      endSelect.disabled = true;

      try {
        if (state.dbReady) await saveTimelineRange(targetDate, nextRange);
      } catch (error) {
        console.error(error);
        if (previousRange === undefined) delete state.timelineRanges[targetDate];
        else state.timelineRanges[targetDate] = previousRange;
        startSelect.value = String(previousRange?.start ?? range.start);
        endSelect.value = String(previousRange?.end ?? range.end);
        setStatus("시간 범위 저장 실패");
        startSelect.disabled = false;
        endSelect.disabled = false;
        return;
      }

      state.timelineRanges[targetDate] = nextRange;
      setStatus("시간 범위 저장 완료");
      try {
        await loadAndRender();
      } catch (error) {
        console.error(error);
        setStatus("저장 완료 (화면 새로고침 실패)");
      } finally {
        startSelect.disabled = false;
        endSelect.disabled = false;
      }
    };

    startSelect.addEventListener("change", saveRange);
    endSelect.addEventListener("change", saveRange);

    const separator = document.createElement("span");
    separator.textContent = "-";
    controls.append(startSelect, separator, endSelect);
    return controls;
  }

  return { createTimelineRangeControls };
}
