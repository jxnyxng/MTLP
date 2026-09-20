export function createDayTaskCardRenderer({
  createTaskStack,
  isCurrentDate,
  openDetailModal,
  renderTaskList,
  toDateKey,
}) {
  function appendHeadingLabel(button, primary, secondary) {
    const label = document.createElement("span");
    label.textContent = primary;
    const detail = document.createElement("small");
    detail.textContent = secondary;
    button.append(label, detail);
  }

  function createDayTaskCard({
    cardClass,
    date,
    enabled = true,
    headingPrimary,
    headingSecondary,
    listClass,
    now,
    placeholder,
    tasks,
  }) {
    const card = document.createElement("section");
    card.className = cardClass;
    if (date.getDay() === 6) card.classList.add("weekend-saturday");
    if (date.getDay() === 0) card.classList.add("weekend-sunday");
    if (!enabled) card.classList.add("muted-day-card");
    if (enabled && isCurrentDate(date, now)) {
      card.classList.add("current-period-card", "current-day-card");
    }

    const heading = document.createElement("h3");
    const headingButton = document.createElement("button");
    headingButton.className = "heading-link day-heading-link";
    headingButton.type = "button";
    appendHeadingLabel(headingButton, headingPrimary, headingSecondary);
    if (enabled) {
      headingButton.addEventListener("click", () => openDetailModal("DAILY", date));
    } else {
      headingButton.disabled = true;
      headingButton.setAttribute("aria-label", "이번 달이 아닌 날짜");
    }
    heading.append(headingButton);

    if (!enabled) {
      const mutedPlaceholder = document.createElement("div");
      mutedPlaceholder.className = "muted-day-placeholder";
      card.append(heading, mutedPlaceholder);
      return card;
    }

    const list = document.createElement("ul");
    list.className = `task-list ${listClass}`;
    list.dataset.periodType = "DAILY";
    list.dataset.targetDate = toDateKey(date);
    renderTaskList(list, "DAILY", tasks, placeholder);
    card.append(heading, createTaskStack(list));
    return card;
  }

  return { createDayTaskCard };
}
