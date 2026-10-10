// Appearance is device-local; changing themes never touches player save data.
const GAME_THEME_KEY = "heroes-of-click-theme";
const GAME_THEME_MODES = ["default", "stone"];
function readGameTheme() {
    try {
        const stored = localStorage.getItem(GAME_THEME_KEY);
        return stored === "dark" ? "stone" : (GAME_THEME_MODES.includes(stored) ? stored : "default");
    } catch (_error) { return "default"; }
}
function applyGameTheme(value) {
    const theme = value === "dark" ? "stone" : (GAME_THEME_MODES.includes(value) ? value : "default");
    if (document.documentElement) document.documentElement.setAttribute("data-theme", theme);
    const themeMeta = document.querySelector ? document.querySelector('meta[name="theme-color"]') : null;
    if (themeMeta && themeMeta.setAttribute) {
        themeMeta.setAttribute("content", theme === "stone" ? "#222629" : "#440c0c");
    }
    const checkbox = document.getElementById ? document.getElementById("stone-theme-toggle") : null;
    if (checkbox) checkbox.checked = theme === "stone";
    return theme;
}
function setGameTheme(value) {
    const mode = applyGameTheme(value);
    try { localStorage.setItem(GAME_THEME_KEY, mode); } catch (_error) { /* private mode */ }
    return mode;
}
function makeUIIcon(iconName) {
    const span = document.createElement("span");
    span.className = "ui-icon ui-icon-" + iconName;
    span.setAttribute("aria-hidden", "true");
    return span;
}
function setIconLabel(element, iconName, label) {
    element.replaceChildren(makeUIIcon(iconName), document.createTextNode(label));
    return element;
}
applyGameTheme(readGameTheme());
if (document.addEventListener) {
    document.addEventListener("DOMContentLoaded", () => applyGameTheme(readGameTheme()));
}
