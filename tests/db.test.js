import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

let moduleId = 0;

async function fixture(t, { setup, intercept = async () => {} } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  setup?.(sqlite);
  const calls = [];
  const originalWindow = globalThis.window;
  globalThis.window = { __TAURI_INTERNALS__: {
    async invoke(command, args) {
      calls.push({ command, ...args });
      await intercept(command, args);
      if (command === "plugin:sql|load") return args.db;
      const statement = sqlite.prepare(args.query);
      if (command === "plugin:sql|select") return statement.all(...args.values).map((row) => ({ ...row }));
      if (command === "plugin:sql|execute") {
        const result = statement.run(...args.values);
        return [Number(result.changes), Number(result.lastInsertRowid)];
      }
      assert.fail(`Unexpected command ${command}`);
    },
  } };
  t.after(() => { sqlite.close(); globalThis.window = originalWindow; });
  const db = await import(`../src/db.js?test=${++moduleId}`);
  return { db, sqlite, calls };
}

test("concurrent initialization and queries wait for all tables and share one connection load", async (t) => {
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const { db, calls } = await fixture(t, {
    intercept: async (command, args) => {
      if (command === "plugin:sql|execute" && args.query.includes("CREATE TABLE IF NOT EXISTS tasks")) await blocked;
    },
  });
  const initializing = db.initDb();
  const tasks = db.getTasks("DAILY", "2026-09-17");
  const journals = db.getAllJournalEntries();
  release();
  await initializing;
  assert.deepEqual(await tasks, []);
  assert.deepEqual(await journals, []);
  assert.equal(calls.filter((call) => call.command === "plugin:sql|load").length, 1);
});

test("initialization failures do not cache a partially prepared database", async (t) => {
  let fail = true;
  const { db, calls } = await fixture(t, {
    intercept: async (command, args) => {
      if (fail && command === "plugin:sql|execute" && args.query.includes("CREATE TABLE IF NOT EXISTS settings")) {
        fail = false;
        throw new Error("initialization failed");
      }
    },
  });
  await assert.rejects(db.initDb(), /initialization failed/);
  assert.deepEqual(await db.getAllJournalEntries(), []);
  assert.equal(calls.filter((call) => call.command === "plugin:sql|load").length, 2);
});

test("legacy task schema upgrades preserve existing rows", async (t) => {
  const { db } = await fixture(t, {
    setup: (sqlite) => sqlite.exec(`CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'TODO', period_type TEXT NOT NULL,
      target_date TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      INSERT INTO tasks (content, period_type, target_date) VALUES ('기존 태스크', 'DAILY', '2026-09-17');`),
  });
  const [task] = await db.getTasks("DAILY", "2026-09-17");
  assert.equal(task.content, "기존 태스크");
  assert.equal(task.position, 1000);
  assert.equal(task.time_block, null);
  assert.equal(task.split_lane, null);
});

test("task CRUD, cross-period movement and block replacement preserve all task fields", async (t) => {
  const { db } = await fixture(t);
  const id = await db.addTask("태스크", "WEEKLY", "2026-09-13", 2000, null, 1);
  await db.updateTaskContent(id, "수정");
  await db.updateTaskStatus(id, "DONE");
  await db.moveTask(id, "DAILY", "2026-09-17", 3000, "09:00", "0");
  const [task] = await db.getTasks("DAILY", "2026-09-17");
  assert.deepEqual([task.content, task.status, task.position, task.time_block, task.split_lane], ["수정", "DONE", 3000, "09:00", 0]);
  assert.deepEqual(await db.getTasks("WEEKLY", "2026-09-13"), []);
  assert.equal((await db.getTasksByTargetPrefix("DAILY", "2026-09-"))[0].id, id);
  assert.equal((await db.getTasksByTargets("DAILY", ["2026-09-16", "2026-09-17", "2026-09-17"]))[0].id, id);
  assert.deepEqual(await db.getTasksByTargets("DAILY", []), []);
  await db.updateTaskBlock(id, "복사한 블록", "CANCELLED");
  assert.equal((await db.getTasks("DAILY", "2026-09-17"))[0].status, "CANCELLED");
  await db.deleteTask(id);
  assert.deepEqual(await db.getTasks("DAILY", "2026-09-17"), []);
});

test("batch reordering saves positions and destinations together without changing content or status", async (t) => {
  const { db, calls } = await fixture(t);
  const first = await db.addTask("첫째", "MONTHLY", "2026-09", 1000);
  const second = await db.addTask("둘째", "DAILY", "2026-09-17", 1000);
  await db.updateTaskStatus(first, "DONE");
  const before = calls.length;
  await db.saveTaskOrder({ periodType: "DAILY", targetDate: "2026-09-17", timeBlock: "10:00", splitLane: "1" }, [
    { id: first, position: 2000 }, { id: second, position: 1000 },
  ]);
  assert.equal(calls.length - before, 1);
  const tasks = await db.getTasks("DAILY", "2026-09-17");
  assert.deepEqual(tasks.map((task) => task.id), [second, first]);
  assert.deepEqual(tasks.map((task) => [task.time_block, task.split_lane]), [["10:00", 1], ["10:00", 1]]);
  assert.equal(tasks[1].status, "DONE");
  assert.equal(tasks[1].content, "첫째");
  await db.saveTaskOrder({ periodType: "YEARLY", targetDate: "2027" }, [{ id: first, position: 1000 }]);
  const [moved] = await db.getTasks("YEARLY", "2027");
  assert.equal(moved.time_block, null);
  assert.equal(moved.split_lane, null);
  const noOpBefore = calls.length;
  await db.saveTaskOrder({}, []);
  assert.equal(calls.length, noOpBefore);
});

test("a failure on one task rolls back the entire reorder", async (t) => {
  const { db, sqlite } = await fixture(t);
  const first = await db.addTask("첫째", "DAILY", "2026-09-17", 1000);
  const second = await db.addTask("둘째", "DAILY", "2026-09-17", 2000);
  sqlite.exec(`CREATE TRIGGER reject_move BEFORE UPDATE ON tasks WHEN NEW.id = ${second}
    BEGIN SELECT RAISE(ABORT, 'write rejected'); END;`);
  await assert.rejects(db.saveTaskOrder({ periodType: "MONTHLY", targetDate: "2026-10" }, [
    { id: first, position: 2000 }, { id: second, position: 1000 },
  ]), /write rejected/);
  assert.deepEqual((await db.getTasks("DAILY", "2026-09-17")).map((task) => [task.id, task.position]), [[first, 1000], [second, 2000]]);
  assert.deepEqual(await db.getTasks("MONTHLY", "2026-10"), []);
});

test("journal creation writes content atomically and keeps update, delete and legacy empty creation", async (t) => {
  const { db } = await fixture(t);
  const id = await db.addJournalEntry("2026-09-17", 2000, "제목\n**본문**");
  const legacy = await db.addJournalEntry("2026-09-16");
  const entries = await db.getAllJournalEntries();
  assert.equal(entries[0].content, "제목\n**본문**");
  assert.equal(entries[1].content, "");
  await db.updateJournalEntry(id, "수정");
  assert.equal((await db.getAllJournalEntries())[0].content, "수정");
  await db.deleteJournalEntry(id);
  assert.equal((await db.getAllJournalEntries())[0].id, legacy);
});

test("API key, theme and timeline settings remain compatible", async (t) => {
  const { db, sqlite } = await fixture(t);
  assert.equal(await db.getApiKey(), "");
  assert.equal(await db.getThemeId(), "sage-graphite-light");
  assert.equal(await db.getTimelineRange("2026-09-17"), null);
  sqlite.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("gemini_api_key", "test-key");
  await db.saveThemeId("forest-ink-dark");
  await db.saveTimelineRange("2026-09-17", { start: 8, end: 20 });
  assert.equal(await db.getApiKey(), "test-key");
  await db.deleteApiKey();
  assert.equal(await db.getApiKey(), "");
  assert.equal(await db.getThemeId(), "forest-ink-dark");
  assert.deepEqual(await db.getTimelineRange("2026-09-17"), { start: 8, end: 20 });
  sqlite.prepare("UPDATE settings SET value = ? WHERE key = ?").run("broken json", "timeline_range:2026-09-17");
  assert.equal(await db.getTimelineRange("2026-09-17"), null);
});
