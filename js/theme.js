/* ═══════════════════════════════════════════════════════════
   Mode nuit : « Auto » (suit le téléphone), « Clair » ou « Sombre ».
   Le choix est gardé sur l'appareil ; il est appliqué dès le début
   de la page (petit script dans index.html) pour éviter un flash blanc.
   ═══════════════════════════════════════════════════════════ */
const KEY = "tl-theme";
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set();

export function themePref() {
  try { return localStorage.getItem(KEY) || "auto"; } catch { return "auto"; }
}

export function isDark() {
  const pref = themePref();
  return pref === "dark" || (pref === "auto" && darkQuery.matches);
}

/** Couleur d'une variable du thème en cours (graphiques, barre du navigateur) */
export function themeColor(name, fallback = "") {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function onThemeChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function applyTheme(pref = themePref()) {
  try {
    if (pref === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch { /* stockage indisponible : le choix vaut pour cette visite */ }
  const root = document.documentElement;
  if (pref === "auto") delete root.dataset.theme;
  else root.dataset.theme = pref;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = themeColor("--bg", "#eef6ea");
  document.querySelectorAll("[data-theme-set]").forEach(btn => btn.setAttribute("aria-pressed", String(btn.dataset.themeSet === pref)));
  listeners.forEach(fn => { try { fn(isDark()); } catch (err) { console.error(err); } });
}

darkQuery.addEventListener("change", () => { if (themePref() === "auto") applyTheme("auto"); });
