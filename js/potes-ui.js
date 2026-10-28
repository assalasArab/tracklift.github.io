/* ═══════════════════════════════════════════════════════════
   Partie Potes : outils d'écran partagés (feuilles plein écran,
   confirmation, dates relatives) et pont vers les données de l'appli.
   ═══════════════════════════════════════════════════════════ */
import { i18n } from "./i18n.js?v=20261028a";
import { escapeHtml } from "./utils.js?v=20261028a";
import { avatarSvg } from "./avatar.js?v=20261028a";

export const t = (key, vars) => i18n.t(key, vars);
/** singulier / pluriel : clé « …One » pour 1 (et 0 en français) */
export const tn = (key, count, vars = {}) => i18n.t(count === 1 || (count === 0 && i18n.getLanguage() !== "en") ? `${key}One` : key, { count, ...vars });
export const esc = escapeHtml;
export const MASCOT = "./assets/illustrations/intro-01-bienvenue.webp";
export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Pont vers l'appli (rempli par app.js) :
 * nameOf(id), exercise(id), getPrograms(), getCustomExercises(), addProgram(p), saveCustomExercise(ex),
 * replaceProgramSessions(localId, sessions), refresh(), myStats(), translate(category, value), sessionTypeLabel(type)
 */
export const Bridge = {};

/** Feuille plein écran (ou petite carte en bas avec small: true). Échap ferme ; le focus revient au bouton d'origine.
    beforeClose() peut renvoyer false pour retenir la fermeture (changements pas enregistrés) ; close(true) force. */
export function openSheet({ labelledBy = "tl-sheet-title", small = false, onClose, beforeClose } = {}) {
  document.querySelector(".tl-sheet")?.remove();
  const opener = document.activeElement;
  const sheet = document.createElement("div");
  sheet.className = `tl-sheet${small ? " tl-sheet-small" : ""}`;
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", labelledBy);
  document.body.appendChild(sheet);
  document.documentElement.classList.add("ob-open");
  const onKey = event => { if (event.key === "Escape") close(); };
  function close(force = false) {
    if (!sheet.isConnected) return;
    if (!force && beforeClose && beforeClose() === false) return;
    sheet.remove();
    document.documentElement.classList.remove("ob-open");
    document.removeEventListener("keydown", onKey);
    onClose?.();
    if (opener?.isConnected) opener.focus?.();
  }
  document.addEventListener("keydown", onKey);
  sheet.addEventListener("click", event => {
    if (event.target.closest("[data-sheet-close]")) close();
    else if (small && event.target === sheet) close();
  });
  return { sheet, close };
}

export const sheetHead = (title, step = "") => `
  <div class="tl-sheet-head">
    <div>
      ${step ? `<p class="tl-sheet-step">${esc(step)}</p>` : ""}
      <h2 id="tl-sheet-title" class="tl-sheet-title" tabindex="-1">${esc(title)}</h2>
    </div>
    <button type="button" class="icon-btn" data-sheet-close aria-label="${esc(t("close"))}">✕</button>
  </div>`;

/** Confirmation en bas d'écran. Renvoie une promesse : true si confirmé. */
export function confirmSheet({ title, text, confirmLabel, cancelLabel = t("potesStay"), danger = true }) {
  return new Promise(resolve => {
    let answered = false;
    const { sheet, close } = openSheet({ labelledBy: "tl-confirm-title", small: true, onClose: () => { if (!answered) resolve(false); } });
    sheet.innerHTML = `
      <div class="tl-sheet-inner">
        <div class="tl-sheet-head">
          <h2 id="tl-confirm-title" class="tl-sheet-title" tabindex="-1">${esc(title)}</h2>
          <button type="button" class="icon-btn" data-sheet-close aria-label="${esc(t("close"))}">✕</button>
        </div>
        ${text ? `<p class="pt-text">${esc(text)}</p>` : ""}
        <div class="pt-leave-actions">
          <button type="button" class="btn btn-surface btn-block" data-sheet-close>${esc(cancelLabel)}</button>
          <button type="button" class="${danger ? "text-danger-btn" : "btn btn-primary btn-block"}" data-confirm-ok>${esc(confirmLabel)}</button>
        </div>
      </div>`;
    sheet.querySelector("#tl-confirm-title").focus();
    sheet.querySelector("[data-confirm-ok]").addEventListener("click", () => { answered = true; resolve(true); close(); });
  });
}

/** « à l'instant », « il y a 5 min », « hier »… */
export function timeAgo(ts, now = Date.now()) {
  const rtf = new Intl.RelativeTimeFormat(i18n.getLocale(), { numeric: "auto" });
  const s = Math.round((ts - now) / 1000);
  if (Math.abs(s) < 60) return t("timeNow");
  const m = Math.round(s / 60);
  if (Math.abs(m) < 60) return rtf.format(m, "minute");
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24) return rtf.format(h, "hour");
  const d = Math.round(h / 24);
  if (Math.abs(d) < 7) return rtf.format(d, "day");
  return new Date(ts).toLocaleDateString(i18n.getLocale(), { day: "numeric", month: "short" });
}

export function shortDate(ts) {
  return new Date(ts).toLocaleDateString(i18n.getLocale(), { day: "numeric", month: "short" });
}

/** Avatar d'une personne ; décoratif quand son pseudo est écrit à côté */
export function personAvatar(profile, size = 40, { decorative = true } = {}) {
  if (!profile) return `<span class="pt-ghost" style="width:${size}px;height:${size}px" aria-hidden="true"></span>`;
  return avatarSvg(profile.avatar, { size, label: decorative ? "" : t("avatarOf", { name: profile.username }) });
}

export const nameOf = profile => profile?.username || t("potesSomeone");

export function kg(value) {
  return Number(value).toLocaleString(i18n.getLocale(), { maximumFractionDigits: 1 });
}

/** Petite courbe SVG (points { t, v }) */
export function sparkline(points, { width = 120, height = 36, label = "" } = {}) {
  if (!points || points.length < 2) return "";
  const vs = points.map(p => p.v);
  const min = Math.min(...vs), max = Math.max(...vs);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((p, i) => `${(i * step).toFixed(1)},${(height - 4 - ((p.v - min) / span) * (height - 8)).toFixed(1)}`);
  const last = coords[coords.length - 1].split(",");
  return `<svg class="pt-spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" ${label ? `role="img" aria-label="${esc(label)}"` : `aria-hidden="true"`}>
    <polyline points="${coords.join(" ")}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="3.5" fill="var(--p-orange)" stroke="var(--p-brown)" stroke-width="1.5"/>
  </svg>`;
}

/** Partage d'un lien : feuille de partage du téléphone, sinon copie */
export async function shareLink(url, title) {
  try {
    if (navigator.share) { await navigator.share({ title, url }); return "shared"; }
  } catch (err) { if (err?.name === "AbortError") return "cancel"; }
  try { await navigator.clipboard.writeText(url); return "copied"; }
  catch { window.prompt(t("potesCopyLink"), url); return "shown"; }
}

export function bump(el) {
  if (!el || reducedMotion()) return;
  el.classList.remove("is-bump");
  void el.offsetWidth;
  el.classList.add("is-bump");
}
