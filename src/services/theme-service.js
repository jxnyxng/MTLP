const LEGACY_THEME_IDS = {
  productivity: "sage-graphite-light",
  "productivity-light": "sage-graphite-light",
  diary: "mist-blue-light",
  "diary-light": "mist-blue-light",
  study: "ink-lavender-light",
  "study-light": "ink-lavender-light",
  minimal: "sage-graphite-light",
  "minimal-light": "sage-graphite-light",
  "productivity-dark": "graphite-blue-dark",
  "diary-dark": "forest-ink-dark",
  "study-dark": "graphite-blue-dark",
  "minimal-dark": "graphite-blue-dark",
};

export function createThemeService({ state, themes, root = document.documentElement }) {
  function themeById(themeId) {
    const normalizedId = LEGACY_THEME_IDS[themeId] ?? themeId;
    return themes.find((theme) => theme.id === normalizedId) ?? themes[0];
  }

  function applyTheme(themeId) {
    const theme = themeById(themeId);
    state.themeId = theme.id;
    root.dataset.theme = theme.id;
    Object.entries(theme.css).forEach(([name, value]) => root.style.setProperty(name, value));
  }

  return { applyTheme, themeById };
}
