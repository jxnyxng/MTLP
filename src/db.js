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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn(db, "tasks", "time_block", "time_block TEXT DEFAULT NULL");
  await ensureColumn(db, "tasks", "position", "position INTEGER NOT NULL DEFAULT 1000");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
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
) {
  const database = await initDb();
  const result = await database.execute(
    `INSERT INTO tasks (content, period_type, target_date, position, time_block)
     VALUES (?, ?, ?, ?, ?)`,
    [content, periodType, targetDate, position, timeBlock],
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
) {
  const database = await initDb();
  return database.execute(
    `UPDATE tasks
        SET period_type = ?, target_date = ?, position = ?, time_block = ?
      WHERE id = ?`,
    [periodType, targetDate, position, timeBlock, id],
  );
}

export async function saveApiKey(apiKey) {
  const database = await initDb();
  return database.execute(
    `INSERT OR REPLACE INTO settings (key, value)
     VALUES ('gemini_api_key', ?)`,
    [apiKey],
  );
}

export async function getApiKey() {
  const database = await initDb();
  const rows = await database.select(
    "SELECT value FROM settings WHERE key = 'gemini_api_key' LIMIT 1",
  );

  return rows[0]?.value ?? "";
}
