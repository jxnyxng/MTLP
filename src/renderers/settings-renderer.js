export function createSettingsRenderer({
  state,
  themes,
  applyTheme,
  saveThemeId,
  setStatus,
}) {
  function createThemeOption(theme) {
    const label = document.createElement("label");
    label.className = "theme-option";
    label.style.setProperty("--theme-primary", theme.primary);
    label.style.setProperty("--theme-secondary", theme.secondary);
    label.style.setProperty("--theme-bg", theme.background);

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "theme";
    input.value = theme.id;
    input.checked = theme.id === state.themeId;

    const sample = document.createElement("span");
    sample.className = "theme-swatch";
    sample.setAttribute("aria-hidden", "true");
    sample.innerHTML = "<i></i><i></i><i></i>";

    const text = document.createElement("span");
    text.className = "theme-option-text";
    const name = document.createElement("strong");
    name.textContent = theme.name;
    const description = document.createElement("small");
    description.textContent = theme.description;

    text.append(name, description);

    input.addEventListener("change", async () => {
      applyTheme(theme.id);
      renderThemeOptions();
      if (state.dbReady) {
        await saveThemeId(theme.id);
        setStatus("테마 저장 완료");
      }
    });

    label.append(input, sample, text);
    return label;
  }

  function createThemeGroup(title, themeList) {
    const group = document.createElement("section");
    group.className = "theme-group";

    const heading = document.createElement("h3");
    heading.textContent = title;

    const grid = document.createElement("div");
    grid.className = "theme-grid";
    grid.append(...themeList.map(createThemeOption));

    group.append(heading, grid);
    return group;
  }

  function renderThemeOptions() {
    const options = document.querySelector("#theme-options");
    if (!options) return;

    options.replaceChildren(
      createThemeGroup("라이트 테마", themes.filter((theme) => theme.mode === "light")),
      createThemeGroup("다크 테마", themes.filter((theme) => theme.mode === "dark")),
    );
  }

  return {
    renderThemeOptions,
  };
}
