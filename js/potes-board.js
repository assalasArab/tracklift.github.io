/* ═══════════════════════════════════════════════════════════
   Classement entre potes (jamais public).
   Critères qui récompensent la régularité : séances de la semaine
   (lundi → dimanche, heure de Paris), flamme, records du mois.
   Jamais le poids du corps ni la charge brute.
   On n'apparaît que si on l'a accepté, critère par critère.
   ═══════════════════════════════════════════════════════════ */
import { showToast } from "./utils.js?v=20261031a";
import { i18n } from "./i18n.js?v=20261031a";
import { Social } from "./social.js?v=20261031a";
import { boardValue, rankEntries, weekKey, monthKey } from "./social-stats.js?v=20261031a";
import { t, esc, personAvatar, nameOf, MASCOT, Bridge, reducedMotion } from "./potes-ui.js?v=20261031a";

export const CRITERIA = ["sessions", "streak", "records"];

export function ordinal(n) {
  if (i18n.getLanguage() === "en") {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  return n === 1 ? "1er" : `${n}e`;
}

export function boardEntries(criterion, now = Date.now()) {
  const entries = [];
  if (Social.board[criterion]) {
    const mine = Bridge.myStats?.() || {};
    entries.push({ uid: Social.uid, me: true, name: Social.username, profile: Social.profile, value: Number(mine[criterion]) || 0 });
  }
  for (const f of Social.friends.values()) {
    const value = boardValue(criterion, f.items?.board, now);
    if (value !== null) entries.push({ uid: f.uid, name: nameOf(f.profile), profile: f.profile, value });
  }
  return rankEntries(entries);
}

function periodKey(criterion, now) { return criterion === "records" ? monthKey(now) : criterion === "sessions" ? weekKey(now) : "now"; }

function periodLabel(criterion, now) {
  const locale = i18n.getLocale();
  if (criterion === "sessions") {
    const monday = new Date(`${weekKey(now)}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
    return t("pbWeek", { date: monday });
  }
  if (criterion === "records") {
    const month = new Date(`${monthKey(now)}-15T12:00:00Z`).toLocaleDateString(locale, { month: "long", timeZone: "UTC" });
    return t("pbMonth", { month });
  }
  return t("pbStreakNow");
}

// pluriel : à partir de 2 en français, tout sauf 1 en anglais
const unit = (criterion, value) => t(`pbUnit.${criterion}${(i18n.getLanguage() === "en" ? value !== 1 : value > 1) ? "Many" : ""}`);

function podiumHtml(top) {
  // ordre visuel : 2e, 1er, 3e
  const order = [top[1], top[0], top[2]].filter(Boolean);
  return `<ol class="pb-podium" aria-label="${esc(t("pbPodium"))}">${order.map(e => `
    <li class="pb-step pb-place-${Math.min(e.place, 3)}${e.me ? " is-me" : ""}${e === top[0] ? " is-first" : ""}" data-board-uid="${esc(e.uid)}">
      <span class="pb-av">${personAvatar(e.profile, e === top[0] ? 66 : 52)}</span>
      <span class="pb-medal" aria-hidden="true">${e.place}</span>
      <span class="pb-name">${esc(e.me ? t("pbYou") : e.name)}</span>
      <span class="pb-value"><b>${e.value}</b> ${esc(unit(e.criterion, e.value))}</span>
      <span class="sr-only">${esc(t("pbPlaceSr", { place: ordinal(e.place) }))}</span>
    </li>`).join("")}</ol>`;
}

export function boardHtml(criterion) {
  const now = Date.now();
  const ranked = boardEntries(criterion, now).map(e => ({ ...e, criterion }));
  const mine = ranked.find(e => e.me);
  const tabs = `
    <div class="pb-tabs" role="radiogroup" aria-label="${esc(t("pbCriterion"))}">
      ${CRITERIA.map(c => `<button type="button" role="radio" class="pb-tab" aria-checked="${c === criterion}" tabindex="${c === criterion ? 0 : -1}" data-board-crit="${c}">${esc(t(`pbCrit.${c}`))}</button>`).join("")}
    </div>
    <p class="pb-period">${esc(periodLabel(criterion, now))}</p>`;

  const join = mine ? "" : `
    <div class="card pt-card pb-join">
      <p class="pt-text"><b>${esc(t("pbNotIn"))}</b> ${esc(t("pbNotInHint"))}</p>
      <button type="button" class="btn btn-ghost btn-sm" data-board-join="${criterion}">${esc(t("pbJoin"))}</button>
    </div>`;

  const others = ranked.filter(e => !e.me);
  if (!others.length) {
    return `${tabs}${join}
      ${mine ? `<p class="pb-mine">${esc(t("pbMyPlace", { place: ordinal(1), total: 1 }))} · <b>${mine.value}</b> ${esc(unit(criterion, mine.value))}</p>` : ""}
      <div class="card pt-card pt-empty"><img class="pt-mascot pt-mascot-sm" src="${MASCOT}" alt="" width="70" height="184">
        <div><p class="pt-text">${esc(t("pbSolo"))}</p><button type="button" class="btn btn-ghost btn-sm" data-share-invite>${esc(t("pqShareLink"))}</button></div>
      </div>`;
  }

  const rest = ranked.slice(3);
  return `${tabs}${join}
    ${mine ? `<p class="pb-mine" aria-live="polite">${esc(t("pbMyPlace", { place: ordinal(mine.place), total: ranked.length }))}</p>` : ""}
    ${podiumHtml(ranked.slice(0, 3))}
    ${rest.length ? `<ol class="pb-list" start="4">${rest.map(e => `
      <li class="pb-row${e.me ? " is-me" : ""}" data-board-uid="${esc(e.uid)}">
        <span class="pb-rank">${e.place}</span>
        ${personAvatar(e.profile, 36)}
        <span class="pb-row-name">${esc(e.me ? t("pbYou") : e.name)}</span>
        <span class="pb-row-value"><b>${e.value}</b> ${esc(unit(criterion, e.value))}</span>
      </li>`).join("")}</ol>` : ""}
    <p class="pb-note">${esc(t("pbNote"))}</p>`;
}

/** Petite fête quand on monte au classement (une fois par montée) */
export function celebrateRank(container, criterion) {
  const now = Date.now();
  const ranked = boardEntries(criterion, now);
  const mine = ranked.find(e => e.me);
  if (!mine || ranked.length < 2) return;
  const key = `tl-board-${criterion}-${periodKey(criterion, now)}`;
  let previous = null;
  try { previous = Number(localStorage.getItem(key)) || null; } catch { /* stockage indisponible */ }
  try { localStorage.setItem(key, String(mine.place)); } catch { /* idem */ }
  if (previous && mine.place < previous) {
    const el = container.querySelector(`[data-board-uid="${CSS.escape(mine.uid)}"]`);
    if (el && !reducedMotion()) el.classList.add("is-up");
    showToast(t("pbUp", { place: ordinal(mine.place) }));
  }
}

export async function joinBoard(criterion) {
  try {
    await Social.updateSettings({ board: { [criterion]: true } });
    showToast(t("psBoardOn"));
  } catch { showToast(t(navigator.onLine === false ? "potesNeedOnline" : "potesJoinError")); }
}
