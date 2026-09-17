import test from "node:test";
import assert from "node:assert/strict";
import { createPanelRenderer } from "../src/renderers/panel-renderer.js";

function fixture(t) {
  const originalDocument = globalThis.document;
  const elements = new Map();
  globalThis.document = { querySelector: (selector) => {
    if (!elements.has(selector)) elements.set(selector, {
      open: false, replacements: 0, replaceChildren() { this.replacements++; },
      close() { this.open = false; },
    });
    return elements.get(selector);
  } };
  t.after(() => { globalThis.document = originalDocument; });
  const state = { detailModal: { periodType: "MONTHLY", anchorDate: new Date(2026, 8, 1) } };
  let release;
  const renderer = createPanelRenderer({ state,
    loadTaskData: () => new Promise((resolve) => { release = resolve; }),
  });
  return { state, renderer, elements, release: () => release({}) };
}

test("closing a detail modal prevents a pending load from recreating its contents", async (t) => {
  const { state, renderer, elements, release } = fixture(t);
  const loading = renderer.renderDetailModal();
  renderer.closeDetailModal();
  assert.equal(state.detailModal, null);
  release();
  await loading;
  assert.equal(elements.get("#detail-view").replacements, 1);
  assert.equal(elements.has("#detail-title"), false);
});

test("replacing the requested detail prevents an older detail from rendering", async (t) => {
  const { state, renderer, elements, release } = fixture(t);
  const loading = renderer.renderDetailModal();
  state.detailModal = { periodType: "DAILY", anchorDate: new Date(2026, 8, 18) };
  release();
  await loading;
  assert.equal(elements.get("#detail-view").replacements, 0);
  assert.equal(elements.has("#detail-title"), false);
});

test("a superseded main render cannot update the detail modal", async (t) => {
  const { renderer, elements, release } = fixture(t);
  let current = true;
  const loading = renderer.renderDetailModal(() => current);
  current = false;
  release();
  await loading;
  assert.equal(elements.get("#detail-view").replacements, 0);
  assert.equal(elements.has("#detail-title"), false);
});
