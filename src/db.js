import Database from "@tauri-apps/plugin-sql";
import {
  assertPeriodType,
  assertTargetDate,
  assertTaskContent,
  assertTaskId,
  assertTaskStatus,
  validateTaskRow,
  validateTaskWrite,
} from "./domain/task.js";

const DB_PATH = "sqlite:bujo.db";

let db;
let initialization;

async function ensureColumn(database, tableName, columnName, definition) {
  const columns = await database.select(`PRAGMA table_info(${tableName})`);
  const exists = columns.some((column) => column.name === columnName);
  if (!exists) {
    await database.execute(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
  }
}

export async function initDb() {
  if (db) return db;
  if (!initialization) {
    initialization = initializeDb().catch((error) => {
      initialization = null;
      throw error;
    });
  }
  return initialization;
}

async function initializeDb() {
  const database = await Database.load(DB_PATH);

  await database.execute(`
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

  await ensureColumn(database, "tasks", "time_block", "time_block TEXT DEFAULT NULL");
  await ensureColumn(database, "tasks", "position", "position INTEGER NOT NULL DEFAULT 1000");
  await ensureColumn(database, "tasks", "split_lane", "split_lane INTEGER DEFAULT NULL");

  await database.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await database.execute(`
    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_date TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 1000,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await database.execute(`
    CREATE INDEX IF NOT EXISTS idx_tasks_period_target_position
      ON tasks (period_type, target_date, position)
  `);

  db = database;
  return database;
}

export async function getTasks(periodType, targetDate) {
  assertPeriodType(periodType);
  assertTargetDate(periodType, targetDate);
  const database = await initDb();
  const rows = await database.select(
    `SELECT *
       FROM tasks
      WHERE period_type = ? AND target_date = ?
      ORDER BY position ASC, id ASC`,
    [periodType, targetDate],
  );
  return rows.map(validateTaskRow);
}

export async function getTasksByTargetPrefix(periodType, targetPrefix) {
  assertPeriodType(periodType);
  if (typeof targetPrefix !== "string" || !targetPrefix) {
    throw new TypeError("targetPrefix must be a non-empty string");
  }
  const database = await initDb();
  const rows = await database.select(
    `SELECT *
       FROM tasks
      WHERE period_type = ? AND target_date LIKE ?
      ORDER BY target_date ASC, position ASC, id ASC`,
    [periodType, `${targetPrefix}%`],
  );
  return rows.map(validateTaskRow);
}

export async function getTasksByTargets(periodType, targetDates) {
  assertPeriodType(periodType);
  if (!Array.isArray(targetDates)) throw new TypeError("targetDates must be an array");
  const uniqueTargets = [...new Set(targetDates)];
  if (!uniqueTargets.length) return [];
  uniqueTargets.forEach((target) => assertTargetDate(periodType, target));
  const database = await initDb();
  const placeholders = uniqueTargets.map(() => "?").join(", ");
  const rows = await database.select(
    `SELECT *
       FROM tasks
      WHERE period_type = ? AND target_date IN (${placeholders})
      ORDER BY target_date ASC, position ASC, id ASC`,
    [periodType, ...uniqueTargets],
  );
  return rows.map(validateTaskRow);
}

export async function addTask(
  content,
  periodType,
  targetDate,
  position = 1000,
  timeBlock = null,
  splitLane = null,
) {
  const task = validateTaskWrite({ content, periodType, targetDate, position, timeBlock, splitLane });
  const database = await initDb();
  const result = await database.execute(
    `INSERT INTO tasks (content, period_type, target_date, position, time_block, split_lane)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [task.content, task.periodType, task.targetDate, task.position, task.timeBlock, task.splitLane],
  );

  return result.lastInsertId;
}

export async function updateTaskStatus(id, status) {
  id = assertTaskId(id);
  status = assertTaskStatus(status);
  const database = await initDb();
  return database.execute("UPDATE tasks SET status = ? WHERE id = ?", [
    status,
    id,
  ]);
}

export async function updateTaskContent(id, content) {
  id = assertTaskId(id);
  content = assertTaskContent(content);
  const database = await initDb();
  return database.execute("UPDATE tasks SET content = ? WHERE id = ?", [
    content,
    id,
  ]);
}

export async function updateTaskBlock(id, content, status) {
  id = assertTaskId(id);
  content = assertTaskContent(content);
  status = assertTaskStatus(status);
  const database = await initDb();
  return database.execute("UPDATE tasks SET content = ?, status = ? WHERE id = ?", [
    content,
    status,
    id,
  ]);
}

export async function deleteTask(id) {
  id = assertTaskId(id);
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
  const task = validateTaskWrite({ id, periodType, targetDate, position, timeBlock, splitLane });
  const database = await initDb();
  return database.execute(
    `UPDATE tasks
        SET period_type = ?, target_date = ?, position = ?, time_block = ?, split_lane = ?
      WHERE id = ?`,
    [task.periodType, task.targetDate, task.position, task.timeBlock, task.splitLane, task.id],
  );
}

export async function saveTaskOrder(target, updates) {
  if (!Array.isArray(updates)) throw new TypeError("updates must be an array");
  if (!updates.length) return;
  const destination = validateTaskWrite({
    periodType: target?.periodType,
    targetDate: target?.targetDate,
    timeBlock: target?.timeBlock ?? null,
    splitLane: target?.splitLane ?? null,
  });
  const normalizedUpdates = updates.map((update) => ({
    id: assertTaskId(update?.id),
    position: validateTaskWrite({ position: update?.position }).position,
  }));
  const database = await initDb();
  const order = JSON.stringify(normalizedUpdates);
  // One UPDATE keeps a failed reorder from leaving only part of the list saved.
  return database.execute(
    `UPDATE tasks
        SET period_type = ?, target_date = ?, time_block = ?, split_lane = ?,
            position = (
              SELECT json_extract(value, '$.position')
                FROM json_each(?)
               WHERE json_extract(value, '$.id') = tasks.id
            )
      WHERE id IN (SELECT json_extract(value, '$.id') FROM json_each(?))`,
    [destination.periodType, destination.targetDate, destination.timeBlock,
      destination.splitLane, order, order],
  );
}

export async function getApiKey() {
  return getSetting("gemini_api_key", "");
}

export async function deleteApiKey() {
  const database = await initDb();
  return database.execute("DELETE FROM settings WHERE key = ?", ["gemini_api_key"]);
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

export async function addJournalEntry(targetDate, position = 1000, content = "") {
  const database = await initDb();
  const result = await database.execute(
    `INSERT INTO journal_entries (target_date, position, content)
     VALUES (?, ?, ?)`,
    [targetDate, position, content],
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
