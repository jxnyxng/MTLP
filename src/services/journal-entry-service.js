export function createJournalEntrySaver({ entry, addJournalEntry, updateJournalEntry }) {
  let pendingSave = null;

  async function persist(content) {
    if (entry.id === null || entry.id === undefined) {
      const id = await addJournalEntry(entry.target_date, entry.position, content);
      entry.id = id;
    } else {
      await updateJournalEntry(entry.id, content);
    }
    entry.content = content;
  }

  function save(content) {
    if (!pendingSave) {
      pendingSave = persist(content).finally(() => {
        pendingSave = null;
      });
    }
    return pendingSave;
  }

  return { save };
}
