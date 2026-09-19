import test from "node:test";
import assert from "node:assert/strict";
import { createThemeService } from "../src/services/theme-service.js";

test("theme service maps legacy ids and applies the selected CSS variables", () => {
  const state = { themeId: "" };
  const values = new Map();
  const root = { dataset: {}, style: { setProperty: (name, value) => values.set(name, value) } };
  const themes = [
    { id: "sage-graphite-light", css: { "--color-bg": "white" } },
    { id: "graphite-blue-dark", css: { "--color-bg": "black" } },
  ];
  const service = createThemeService({ state, themes, root });
  service.applyTheme("productivity-dark");
  assert.equal(state.themeId, "graphite-blue-dark");
  assert.equal(root.dataset.theme, "graphite-blue-dark");
  assert.equal(values.get("--color-bg"), "black");
  assert.equal(service.themeById("missing").id, "sage-graphite-light");
});
