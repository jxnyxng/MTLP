import { journalTitle } from "../journal-utils.js";

export function createPeriodOverviewRenderer({
  state,
  createStagingHeading,
  createSplitTaskStack,
  openJournalEditor,
  targetFor,
  futureYears,
  weekDates,
  toDateKey,
}) {
  function decadeStartYearForDate(date) {
    return futureYears(date)[0];
  }

  function journalsForPeriod(periodType, anchorDate, data = state) {
    const entries = data.journalEntries ?? [];
    if (periodType === "FUTURE") {
      const start = decadeStartYearForDate(anchorDate);
      const end = start + 9;
      return entries.filter((entry) => {
        const year = Number(entry.target_date?.slice(0, 4));
        return year >= start && year <= end;
      });
    }
    if (periodType === "YEARLY") {
      return entries.filter((entry) =>
        entry.target_date?.startsWith(`${targetFor("YEARLY", anchorDate)}-`),
      );
    }
    if (periodType === "MONTHLY") {
      return entries.filter((entry) =>
        entry.target_date?.startsWith(targetFor("MONTHLY", anchorDate)),
      );
    }
    if (periodType === "WEEKLY") {
      const targets = new Set(weekDates(anchorDate).map(toDateKey));
      return entries.filter((entry) => targets.has(entry.target_date));
    }
    return entries.filter((entry) =>
      entry.target_date === targetFor("DAILY", anchorDate),
    );
  }

  function createJournalSummary(periodType, anchorDate, data = state) {
    const card = document.createElement("section");
    card.className = "period-summary-card period-journal-card";

    const heading = document.createElement("h3");
    heading.textContent = "Journal";

    const list = document.createElement("div");
    list.className = "period-journal-list";

    const entries = journalsForPeriod(periodType, anchorDate, data);
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "period-journal-empty";
      empty.textContent = "작성된 저널이 없습니다.";
      list.append(empty);
    } else {
      list.append(
        ...entries.map((entry) => {
          const button = document.createElement("button");
          button.className = "period-journal-item";
          button.type = "button";
          button.title = `${entry.target_date} ${journalTitle(entry)}`;
          button.addEventListener("click", () => openJournalEditor?.(entry));

          const title = document.createElement("strong");
          title.textContent = journalTitle(entry);

          button.append(title);
          return button;
        }),
      );
    }

    card.append(heading, list);
    return card;
  }

  function createTodoSummary(periodType, tasks, placeholder, targetDate) {
    const card = document.createElement("section");
    card.className = "period-summary-card period-todo-card";

    const heading = document.createElement("h3");
    heading.textContent = "Todo";

    card.append(
      heading,
      createSplitTaskStack(
        periodType,
        tasks,
        placeholder,
        targetDate,
      ),
    );
    return card;
  }

  function createPeriodOverview(label, periodType, targetDate, todoCard, anchorDate, data = state) {
    const card = document.createElement("section");
    card.className = "period-staging-card period-overview-card";
    const heading = createStagingHeading(card, periodType, targetDate, label);

    const overview = document.createElement("section");
    overview.className = "period-overview staging-content";
    overview.append(todoCard, createJournalSummary(periodType, anchorDate, data));

    card.append(heading, overview);
    return card;
  }

  return {
    createPeriodOverview,
    createTodoSummary,
  };
}
