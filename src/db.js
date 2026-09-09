import Database from "@tauri-apps/plugin-sql";

const DB_PATH = "sqlite:bujo.db";

let db;

async function ensureColumn(database, tableName, columnName, definition) {
  const columns = await database.select(`PRAGMA table_info(${tableName})`);
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    await database.execute(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }
}

export async function initDb() {
  if (db) return db;

  db = await Database.load(DB_PATH);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'TODO',
      period_type TEXT NOT NULL,
      target_date TEXT NOT NULL,
      time_block TEXT DEFAULT NULL,
      position INTEGER NOT NULL DEFAULT 1000,
      split_lane INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn(db, "tasks", "time_block", "time_block TEXT DEFAULT NULL");
  await ensureColumn(db, "tasks", "position", "position INTEGER NOT NULL DEFAULT 1000");
  await ensureColumn(db, "tasks", "split_lane", "split_lane INTEGER DEFAULT NULL");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_date TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 1000,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}

export async function getTasks(periodType, targetDate) {
  const database = await initDb();
  return database.select(
    `SELECT *
       FROM tasks
      WHERE period_type = ? AND target_date = ?
      ORDER BY position ASC, id ASC`,
    [periodType, targetDate],
  );
}

export async function getTasksByTargetPrefix(periodType, targetPrefix) {
  const database = await initDb();
  return database.select(
    `SELECT *
       FROM tasks
      WHERE period_type = ? AND target_date LIKE ?
      ORDER BY target_date ASC, position ASC, id ASC`,
    [periodType, `${targetPrefix}%`],
  );
}

export async function addTask(
  content,
  periodType,
  targetDate,
  position = 1000,
  timeBlock = null,
  splitLane = null,
) {
  const database = await initDb();
  const result = await database.execute(
    `INSERT INTO tasks (content, period_type, target_date, position, time_block, split_lane)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [content, periodType, targetDate, position, timeBlock, splitLane],
  );

  return result.lastInsertId;
}

export async function updateTaskStatus(id, status) {
  const database = await initDb();
  return database.execute("UPDATE tasks SET status = ? WHERE id = ?", [
    status,
    id,
  ]);
}

export async function updateTaskContent(id, content) {
  const database = await initDb();
  return database.execute("UPDATE tasks SET content = ? WHERE id = ?", [
    content,
    id,
  ]);
}

export async function updateTaskBlock(id, content, status) {
  const database = await initDb();
  return database.execute("UPDATE tasks SET content = ?, status = ? WHERE id = ?", [
    content,
    status,
    id,
  ]);
}

export async function deleteTask(id) {
  const database = await initDb();
  return database.execute("DELETE FROM tasks WHERE id = ?", [id]);
}

export async function moveTask(
  id,
  periodType,
  targetDate,
  position,
  timeBlock = null,
  splitLane = null,
) {
  const database = await initDb();
  return database.execute(
    `UPDATE tasks
        SET period_type = ?, target_date = ?, position = ?, time_block = ?, split_lane = ?
      WHERE id = ?`,
    [periodType, targetDate, position, timeBlock, splitLane, id],
  );
}

export async function saveApiKey(apiKey) {
  return saveSetting("gemini_api_key", apiKey);
}

export async function getApiKey() {
  return getSetting("gemini_api_key", "");
}

export async function saveThemeId(themeId) {
  return saveSetting("theme_id", themeId);
}

export async function getThemeId() {
  return getSetting("theme_id", "sage-graphite-light");
}

export async function saveTimelineRange(targetDate, range) {
  return saveSetting(`timeline_range:${targetDate}`, JSON.stringify(range));
}

export async function getTimelineRange(targetDate) {
  const value = await getSetting(`timeline_range:${targetDate}`, "");
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function getAllJournalEntries() {
  const database = await initDb();
  return database.select(
    `SELECT *
       FROM journal_entries
      ORDER BY position DESC, id DESC`,
  );
}

export async function addJournalEntry(targetDate, position = 1000) {
  const database = await initDb();
  const result = await database.execute(
    `INSERT INTO journal_entries (target_date, position)
     VALUES (?, ?)`,
    [targetDate, position],
  );

  return result.lastInsertId;
}

export async function updateJournalEntry(id, content) {
  const database = await initDb();
  return database.execute(
    `UPDATE journal_entries
        SET content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [content, id],
  );
}

export async function deleteJournalEntry(id) {
  const database = await initDb();
  return database.execute("DELETE FROM journal_entries WHERE id = ?", [id]);
}

async function saveSetting(key, value) {
  const database = await initDb();
  return database.execute(
    `INSERT OR REPLACE INTO settings (key, value)
     VALUES (?, ?)`,
    [key, value],
  );
}

async function getSetting(key, fallback = "") {
  const database = await initDb();
  const rows = await database.select(
    "SELECT value FROM settings WHERE key = ? LIMIT 1",
    [key],
  );

  return rows[0]?.value ?? fallback;
}
