import { splitJournalContent } from "../journal-utils.js";
import { getNextPosition } from "../task-layout.js";
import { createJournalEditor } from "./journal-editor-renderer.js";
import { journalMarkdownToPlainText } from "./journal-markdown-renderer.js";

export function createJournalRenderer({
  state,
  addJournalEntry,
  deleteJournalEntry,
  updateJournalEntry,
  toDateKey,
  setStatus,
  loadAndRender,
}) {
  const { openJournalEditor } = createJournalEditor({
    state, addJournalEntry, updateJournalEntry, setStatus, loadAndRender,
  });

  const journalFilters = {
    query: "",
    date: "",
    sort: "newest",
  };

  function filterJournalEntries(entries) {
    const query = journalFilters.query.trim().toLocaleLowerCase();
    const date = journalFilters.date;

    return entries
      .filter((entry) => {
        const { title, body } = splitJournalContent(entry.content ?? "");
        const matchesQuery =
          !query || `${title}\n${body}`.toLocaleLowerCase().includes(query);
        const matchesDate = !date || entry.target_date === date;
        return matchesQuery && matchesDate;
      })
      .sort((a, b) => {
        const order = String(a.target_date).localeCompare(String(b.target_date));
        return journalFilters.sort === "oldest" ? order : -order;
      });
  }

  function renderJournalPages(container, entries) {
    const filteredEntries = filterJournalEntries(entries);
    if (filteredEntries.length) {
      container.replaceChildren(...filteredEntries.map(createJournalPage));
      return;
    }

    const empty = document.createElement("p");
    empty.className = "journal-empty-filter";
    empty.textContent =
      journalFilters.query || journalFilters.date
        ? "조건에 맞는 저널이 없습니다."
        : "작성된 저널이 없습니다.";
    container.replaceChildren(empty);
  }

  function renderVisibleJournalPages() {
    const pages = document.querySelector(".journal-panel .journal-pages");
    if (!pages) return;
    renderJournalPages(pages, state.journalEntries ?? []);
  }

  function createJournalPage(entry) {
    const page = document.createElement("article");
    page.className = "journal-page";
    page.tabIndex = 0;
    page.setAttribute("role", "button");
    page.setAttribute("aria-label", `${entry.target_date} 일기 열기`);

    const { title, body } = splitJournalContent(entry.content ?? "");

    const previewTitle = document.createElement("h3");
    previewTitle.className = "journal-preview-title";
    const previewContent = `${title}\n${body}`.trim();
    if (!title.trim()) previewTitle.classList.add("is-empty");
    previewTitle.textContent = title.trim() || "제목";

    const preview = document.createElement("p");
    preview.className = "journal-preview";
    if (!previewContent) preview.classList.add("is-empty");
    preview.textContent =
      journalMarkdownToPlainText(body) || (previewContent ? "" : "오늘의 생각을 적어보세요.");

    const mark = document.createElement("span");
    mark.className = "journal-date-mark";
    mark.textContent = entry.target_date;

    const deleteButton = document.createElement("button");
    deleteButton.className = "journal-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", "일기 삭제");
    deleteButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (!state.dbReady) return;
      try {
        await deleteJournalEntry(entry.id);
        setStatus("일기 삭제 완료");
        await loadAndRender();
      } catch (error) {
        console.error(error);
        setStatus("일기 삭제 실패");
      }
    });

    page.addEventListener("click", () => openJournalEditor(entry));
    page.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openJournalEditor(entry);
    });
    page.append(deleteButton, previewTitle, preview, mark);
    return page;
  }

  async function addJournalPage() {
    if (!state.dbReady) {
      setStatus("SQLite가 준비되지 않아 저장할 수 없습니다.");
      return;
    }

    openJournalEditor(
      {
        id: null,
        target_date: toDateKey(new Date()),
        position: getNextPosition(state.journalEntries),
        content: "",
      },
      "edit",
    );
  }

  function renderJournalActions(container) {
    container.classList.add("journal-view-actions");

    const searchInput = document.createElement("input");
    searchInput.className = "journal-search-input";
    searchInput.type = "search";
    searchInput.placeholder = "제목 또는 내용 검색";
    searchInput.value = journalFilters.query;
    searchInput.setAttribute("aria-label", "저널 검색");

    const dateInput = document.createElement("input");
    dateInput.className = "journal-date-input";
    dateInput.type = "date";
    dateInput.value = journalFilters.date;
    dateInput.setAttribute("aria-label", "저널 날짜 필터");

    const sortSelect = document.createElement("select");
    sortSelect.className = "journal-sort-select";
    sortSelect.setAttribute("aria-label", "저널 정렬");
    [
      ["newest", "최신순"],
      ["oldest", "오래된순"],
    ].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      sortSelect.append(option);
    });
    sortSelect.value = journalFilters.sort;

    const clearButton = document.createElement("button");
    clearButton.className = "journal-clear-button";
    clearButton.type = "button";
    clearButton.textContent = "초기화";
    clearButton.hidden = !journalFilters.query && !journalFilters.date;

    const addButton = document.createElement("button");
    addButton.className = "journal-add-button";
    addButton.type = "button";
    addButton.textContent = "작성하기";
    addButton.setAttribute("aria-label", "메모 작성하기");
    addButton.addEventListener("click", async () => {
      await addJournalPage();
    });

    const applyFilters = () => {
      journalFilters.query = searchInput.value;
      journalFilters.date = dateInput.value;
      journalFilters.sort = sortSelect.value;
      clearButton.hidden = !journalFilters.query && !journalFilters.date;
      renderVisibleJournalPages();
    };

    searchInput.addEventListener("input", applyFilters);
    dateInput.addEventListener("change", applyFilters);
    sortSelect.addEventListener("change", applyFilters);
    clearButton.addEventListener("click", () => {
      journalFilters.query = "";
      journalFilters.date = "";
      searchInput.value = "";
      dateInput.value = "";
      clearButton.hidden = true;
      renderVisibleJournalPages();
    });

    container.append(searchInput, dateInput, sortSelect, clearButton, addButton);
  }

  function renderJournalPanel(panel, data = state) {
    const board = document.createElement("div");
    board.className = "journal-board";

    const pages = document.createElement("section");
    pages.className = "journal-pages";
    renderJournalPages(pages, data.journalEntries ?? []);

    board.append(pages);
    panel.replaceChildren(board);
  }

  return {
    openJournalEditor,
    renderJournalActions,
    renderJournalPanel,
  };
}
