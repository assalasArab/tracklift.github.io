/* ═══════════════════════════════════════════════════════════
   Page d'un pote : uniquement ce qu'il partage.
   Sert aussi à « voir mon profil comme un pote » (relu depuis Firestore).
   ═══════════════════════════════════════════════════════════ */
import { showToast } from "./utils.js?v=20261028a";
import { Social } from "./social.js?v=20261028a";
import { streakAlive, weekKey, monthKey } from "./social-stats.js?v=20261028a";
import { t, esc, openSheet, sheetHead, confirmSheet, personAvatar, nameOf, kg, sparkline, shortDate, MASCOT, Bridge } from "./potes-ui.js?v=20261028a";

const FLAME = `<svg class="pf-flame" viewBox="0 0 24 24" aria-hidden="true"><use href="#flame-icon"/></svg>`;
const ORDER = ["streak", "sessions", "records", "curves", "program", "weight", "nutrition", "programs"];

function section(key, title, body, extra = "") {
  return `<section class="pf-card pf-${key}"><h3 class="pf-title">${esc(title)}</h3>${body}${extra}</section>`;
}

/** Les blocs d'un résumé partagé, dans l'ordre ; vide si rien n'est partagé */
export function sharedSectionsHtml(items, now = Date.now()) {
  const out = [];
  for (const key of ORDER) {
    const v = items?.[key];
    if (!v) continue;
    if (key === "streak") {
      const alive = streakAlive(v, now);
      out.push(section(key, t("pfStreak"), `<p class="pf-big">${FLAME}${alive}<small>${esc(alive > 1 ? t("streakDaysMany") : t("streakDaysOne"))}</small></p><p class="pf-meta">${esc(t("streakBest", { count: v.best || 0 }))}</p>`));
    }
    if (key === "sessions") {
      const count = v.weekKey === weekKey(now) ? Number(v.count) || 0 : 0;
      const goal = Number(v.goal) || 0;
      const dots = goal ? `<div class="pf-dots" aria-hidden="true">${Array.from({ length: Math.max(goal, count) }, (_, i) => `<i class="${i < count ? "on" : ""}"></i>`).join("")}</div>` : "";
      const recent = (v.recent || []).map(r => `<li><span>${esc(r.name)}</span><small>${esc(shortDate(r.t))}</small></li>`).join("");
      out.push(section(key, t("pfSessions"), `<p class="pf-big">${count}<small>${esc(goal ? t("pfOfGoal", { goal }) : t("pfThisWeek"))}</small></p>${dots}${recent ? `<ul class="pf-list">${recent}</ul>` : ""}`));
    }
    if (key === "records") {
      const month = v.monthKey === monthKey(now) ? Number(v.monthCount) || 0 : 0;
      const recent = (v.recent || []).map(r => `<li><span>${esc(r.name)}</span><b>${kg(r.weight)} kg${r.gain ? ` <em>+${kg(r.gain)}</em>` : ""}</b><small>${esc(shortDate(r.t))}</small></li>`).join("");
      out.push(section(key, t("pfRecords"), `<p class="pf-big">${month}<small>${esc(t("pfThisMonth"))}</small></p>${recent ? `<ul class="pf-list pf-list-3">${recent}</ul>` : ""}`));
    }
    if (key === "curves" && v.list?.length) {
      out.push(section(key, t("pfCurves"), `<ul class="pf-curve-list">${v.list.map(c => {
        const last = c.points?.[c.points.length - 1];
        return `<li><div><span>${esc(c.name)}</span>${last ? `<b>${kg(last.v)} kg</b>` : ""}</div>${sparkline(c.points, { label: t("pfCurveOf", { name: c.name }) })}</li>`;
      }).join("")}</ul>`));
    }
    if (key === "program") {
      out.push(section(key, t("pfProgram"), `<p class="pf-name">${esc(v.name)}</p><div class="pf-chips">${(v.sessions || []).map(s => `<span>${esc(s.name)}<small>${esc(t("pfExercisesCount", { count: s.count }))}</small></span>`).join("")}</div>`));
    }
    if (key === "weight") {
      const delta = v.delta30;
      out.push(section(key, t("pfWeight"), `<p class="pf-big">${kg(v.current)}<small>kg</small></p>${delta !== null && delta !== undefined ? `<p class="pf-meta">${esc(t("pfWeightDelta", { delta: `${delta > 0 ? "+" : ""}${kg(delta)}` }))}</p>` : ""}${sparkline(v.points, { width: 260, height: 48, label: t("pfWeight") })}`));
    }
    if (key === "nutrition") {
      out.push(section(key, t("pfNutrition"), `<p class="pf-name">${esc(t(`pfPhase.${v.phase}`))}</p>`));
    }
    if (key === "programs" && v.list?.length) {
      out.push(section(key, t("pfSharedPrograms"), `<ul class="pf-progs">${v.list.map(p => `<li><button type="button" class="pf-prog" data-open-program="${esc(p.id)}"><span>${esc(p.name)}</span><small>${esc(t("pfSeeProgram"))}</small></button></li>`).join("")}</ul>`));
    }
  }
  return out.join("");
}

function emptyHtml(name, self) {
  return `<div class="pt-card pt-empty card"><img class="pt-mascot pt-mascot-sm" src="${MASCOT}" alt="" width="70" height="184"><p class="pt-text">${esc(self ? t("pfSelfNothing") : t("pfNothing", { name }))}</p></div>`;
}

function bindProgramLinks(sheet) {
  sheet.addEventListener("click", event => {
    const btn = event.target.closest("[data-open-program]");
    if (btn) Bridge.openProgram?.(btn.dataset.openProgram);
  });
}

/** Page d'un pote, mise à jour en direct (s'il coupe un partage, le bloc disparaît) */
export function openFriendPage(uid) {
  let off = null;
  const { sheet, close } = openSheet({ onClose: () => off?.() });
  bindProgramLinks(sheet);

  let signature = "";
  function draw() {
    const friend = Social.friends.get(uid);
    // on ne redessine que si ce pote a changé (garde le focus clavier en place)
    const next = JSON.stringify(friend ? [friend.profile, friend.items, friend.itemsLoaded, friend.since] : null);
    if (next === signature) return;
    signature = next;
    if (!friend) {
      sheet.innerHTML = `<div class="tl-sheet-inner">${sheetHead(t("potes"))}<p class="pt-text">${esc(t("pfNotFriend"))}</p></div>`;
      return;
    }
    const name = nameOf(friend.profile);
    const body = !friend.itemsLoaded ? `<p class="pt-loading" role="status">${esc(t("potesLoading"))}</p>`
      : sharedSectionsHtml(friend.items) || emptyHtml(name, false);
    const focusInside = sheet.contains(document.activeElement) && document.activeElement !== sheet;
    sheet.innerHTML = `
      <div class="tl-sheet-inner">
        ${sheetHead(name)}
        <div class="pf-head">
          ${personAvatar(friend.profile, 96, { decorative: false })}
          ${friend.since ? `<p class="pf-since">${esc(t("pfSince", { date: shortDate(friend.since) }))}</p>` : ""}
        </div>
        <div class="pf-sections">${body}</div>
        <div class="pf-actions">
          <button type="button" class="hero-other" data-pf-remove>${esc(t("pfRemove"))}</button>
          <button type="button" class="text-danger-btn" data-pf-block>${esc(t("pfBlock"))}</button>
        </div>
      </div>`;
    if (!focusInside) sheet.querySelector("#tl-sheet-title")?.focus();
  }

  sheet.addEventListener("click", async event => {
    const friend = Social.friends.get(uid);
    const name = nameOf(friend?.profile);
    if (event.target.closest("[data-pf-remove]")) {
      const ok = await confirmSheet({ title: t("pfRemoveTitle", { name }), text: t("pfRemoveText"), confirmLabel: t("pfRemove") });
      if (!ok) return;
      try { await Social.removeFriend(uid); close(); showToast(t("pfRemoved", { name })); }
      catch { showToast(t("potesJoinError")); }
    }
    if (event.target.closest("[data-pf-block]")) {
      const ok = await confirmSheet({ title: t("pfBlockTitle", { name }), text: t("pfBlockText"), confirmLabel: t("pfBlock") });
      if (!ok) return;
      try { await Social.block(uid); close(); showToast(t("pfBlocked", { name })); }
      catch { showToast(t("potesJoinError")); }
    }
  });

  off = Social.onChange(draw);
  draw();
}

/** Exactement ce que tes potes voient, relu depuis Firestore */
export async function openMyProfileAsFriend() {
  const { sheet } = openSheet();
  bindProgramLinks(sheet);
  const frame = body => {
    sheet.innerHTML = `
      <div class="tl-sheet-inner">
        ${sheetHead(Social.username)}
        <p class="pf-banner">${esc(t("pfSelfBanner"))}</p>
        <div class="pf-head">${personAvatar(Social.profile, 96, { decorative: false })}</div>
        <div class="pf-sections">${body}</div>
        <button type="button" class="btn btn-surface btn-block pf-settings" data-open-settings>${esc(t("psOpen"))}</button>
      </div>`;
  };
  frame(`<p class="pt-loading" role="status">${esc(t("potesLoading"))}</p>`);
  sheet.querySelector("#tl-sheet-title").focus();
  try {
    const items = await Social.readMyShared();
    frame(sharedSectionsHtml(items) || emptyHtml("", true));
  } catch {
    frame(`<p class="pt-text">${esc(t("potesErrorText"))}</p>`);
  }
  sheet.addEventListener("click", event => {
    if (event.target.closest("[data-open-settings]")) Bridge.openSettings?.();
  });
}
