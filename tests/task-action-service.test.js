import test from "node:test";
import assert from "node:assert/strict";
import { createTaskActionService } from "../src/services/task-action-service.js";

function fixture({ ready = true, fail = false, failRefresh = false } = {}) {
  const writes = [];
  const statuses = [];
  const state = { dbReady: ready, selectedTaskId: 7 };
  const action = async (...args) => {
    writes.push(args);
    if (fail) throw new Error("write failed");
  };
  const service = createTaskActionService({
    state,
    deleteTask: action,
    updateTaskContent: action,
    updateTaskStatus: action,
    setStatus: (message) => statuses.push(message),
    loadAndRender: async () => {
      if (failRefresh) throw new Error("refresh failed");
    },
  });
  return { service, state, statuses, writes };
}

test("task actions keep persistence and refresh failures distinct", async (t) => {
  const originalError = console.error;
  console.error = () => {};
  t.after(() => { console.error = originalError; });

  const refreshed = fixture({ failRefresh: true });
  assert.equal(await refreshed.service.saveTaskContent({ id: 7 }, "edited"), true);
  assert.deepEqual(refreshed.writes, [[7, "edited"]]);
  assert.equal(refreshed.statuses.at(-1), "변경은 저장됐지만 화면을 갱신하지 못했습니다.");

  const failed = fixture({ fail: true });
  assert.equal(await failed.service.toggleTaskStatus({ id: 7, status: "TODO" }), false);
  assert.equal(failed.statuses.at(-1), "상태 저장 실패");
});

test("removing the selected task clears selection only after persistence", async (t) => {
  const originalError = console.error;
  console.error = () => {};
  t.after(() => { console.error = originalError; });

  const saved = fixture();
  assert.equal(await saved.service.removeTask({ id: 7 }), true);
  assert.equal(saved.state.selectedTaskId, null);

  const failed = fixture({ fail: true });
  assert.equal(await failed.service.removeTask({ id: 7 }), false);
  assert.equal(failed.state.selectedTaskId, 7);
});

test("task actions do not write before the database is ready", async () => {
  const f = fixture({ ready: false });
  assert.equal(await f.service.removeTask({ id: 7 }), false);
  assert.equal(await f.service.toggleTaskStatus({ id: 7, status: "TODO" }), false);
  assert.equal(await f.service.saveTaskContent({ id: 7 }, "edited"), false);
  assert.deepEqual(f.writes, []);
  assert.equal(f.statuses.at(-1), "SQLite가 준비되지 않아 저장할 수 없습니다.");
});
