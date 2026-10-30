/* ═══════════════════════════════════════════════════════════
   Notifications dans l'appli : cloche + badge, liste regroupée,
   « bravo » en un toucher, une ligne sur l'accueil, message en direct.
   En direct quand l'appli est ouverte ; au retour sinon (badge).
   ═══════════════════════════════════════════════════════════ */
import { showToast } from "./utils.js?v=20261030a";
import { Social } from "./social.js?v=20261030a";
import { t, tn, esc, openSheet, sheetHead, personAvatar, nameOf, kg, timeAgo, MASCOT, Bridge, bump } from "./potes-ui.js?v=20261030a";
import { acceptProgramInvite, declineProgramInvite } from "./potes-programs.js?v=20261030a";

const DAY = 86400000;
const GROUP_WINDOW = 6 * 3600000; // les événements d'un même pote à moins de 6 h se regroupent

/**
 * Branchement futur des vraies notifications (appli fermée) : il faudra Firebase Cloud Messaging,
 * une Cloud Function (forfait Blaze) et, sur iPhone, l'appli ajoutée à l'écran d'accueil.
 * Aujourd'hui rien n'est envoyé hors de l'appli : deliver() est le seul point à brancher.
 */
export const PushHook = { deliver(/* notification, text */) {} };

/** Toutes les notifications, regroupées, les plus récentes d'abord (les types coupés n'apparaissent pas) */
export function buildNotifications() {
  if (!Social.joined) return [];
  const mute = Social.mute;
  const out = [];
  if (!mute.request) for (const r of Social.requestsIn) out.push({ key: `req:${r.from}`, kind: "request", uid: r.from, at: r.createdAt });
  if (!mute.invite) for (const inv of Social.invitesIn) out.push({ key: `inv:${inv.id}`, kind: "invite", uid: inv.from, invite: inv, at: inv.createdAt });
  if (!mute.accepted) for (const f of Social.friends.values()) {
    if (f.createdBy && f.createdBy !== Social.uid && f.since > Date.now() - 30 * DAY) out.push({ key: `acc:${f.uid}`, kind: "accepted", uid: f.uid, at: f.since });
  }
  for (const f of Social.friends.values()) {
    const events = (f.events || []).filter(e => !mute[e.type]).sort((a, b) => b.createdAt - a.createdAt);
    let group = null;
    for (const e of events) {
      if (group && group.type === e.type && group.oldest - e.createdAt <= GROUP_WINDOW) { group.events.push(e); group.oldest = e.createdAt; continue; }
      group = { key: `ev:${e.id}`, kind: "event", type: e.type, uid: f.uid, at: e.createdAt, oldest: e.createdAt, events: [e] };
      out.push(group);
    }
  }
  if (!mute.cheer) {
    const byEvent = new Map();
    for (const c of Social.cheersIn) {
      const g = byEvent.get(c.eventId) || { key: `ch:${c.eventId}`, kind: "cheer", eventId: c.eventId, from: [], at: 0 };
      if (!g.from.includes(c.from)) g.from.push(c.from);
      g.at = Math.max(g.at, c.createdAt);
      g.key = `ch:${c.eventId}:${g.from.length}`;
      byEvent.set(c.eventId, g);
    }
    out.push(...byEvent.values());
  }
  return out.sort((a, b) => b.at - a.at);
}

export function unseenCount(list = buildNotifications(), seenAt = Social.seenAt) {
  return list.filter(n => n.at > seenAt).length;
}

/** Texte d'une notification ; le pseudo en gras, tout le reste échappé */
function textOf(n, plain = false) {
  const MARK = "\u0001";
  let name, raw;
  if (n.kind === "cheer") {
    name = nameOf(Social.profileOf(n.from[0]));
    const ev = Social.myEvents.find(e => e.id === n.eventId);
    const what = t(`nfWhat.${ev?.type || "default"}`);
    raw = n.from.length > 1 ? tn("nfCheers", n.from.length - 1, { name: MARK, what }) : t("nfCheer", { name: MARK, what });
  } else {
    name = nameOf(Social.profileOf(n.uid));
    if (n.kind === "request") raw = t("nfRequest", { name: MARK });
    else if (n.kind === "invite") raw = t("nfInvite", { name: MARK, program: n.invite.name });
    else if (n.kind === "accepted") raw = t("nfAccepted", { name: MARK });
    else {
      const e = n.events[0], count = n.events.length, d = e.data || {};
      if (n.type === "record") raw = count > 1 ? t("nfRecords", { name: MARK, count }) : t("nfRecord", { name: MARK, exercise: d.name || "", weight: kg(d.weight || 0) });
      else if (n.type === "streak") raw = t("nfStreak", { name: MARK, days: d.days || 0 });
      else raw = t("nfWeekGoal", { name: MARK, count: d.count || 0 });
    }
  }
  if (plain) return raw.replace(MARK, name);
  return esc(raw).replace(MARK, `<b>${esc(name)}</b>`);
}

function actionsHtml(n) {
  if (n.kind === "request") return `
    <div class="nf-actions">
      <button type="button" class="btn btn-ghost btn-sm" data-nf-accept="${esc(n.uid)}">${esc(t("pqAccept"))}</button>
      <button type="button" class="btn btn-surface btn-sm" data-nf-refuse="${esc(n.uid)}">${esc(t("pqRefuse"))}</button>
    </div>`;
  if (n.kind === "invite") return `
    <div class="nf-actions">
      <button type="button" class="btn btn-ghost btn-sm" data-nf-join="${esc(n.invite.id)}">${esc(t("grAccept"))}</button>
      <button type="button" class="btn btn-surface btn-sm" data-nf-nojoin="${esc(n.invite.id)}">${esc(t("grDecline"))}</button>
    </div>`;
  if (n.kind === "event") {
    const eventId = n.events[0].id;
    return Social.hasCheered(eventId)
      ? `<div class="nf-actions"><span class="nf-cheered">${esc(t("nfCheered"))}</span></div>`
      : `<div class="nf-actions"><button type="button" class="btn btn-ghost btn-sm nf-bravo" data-nf-bravo="${esc(n.uid)}|${esc(eventId)}">${esc(t("nfBravo"))}</button></div>`;
  }
  return "";
}

function itemHtml(n, seenAt) {
  const who = n.kind === "cheer" ? n.from[0] : n.uid;
  const openable = n.kind !== "request" && n.kind !== "invite" && Social.isFriend(who);
  const inner = `${personAvatar(Social.profileOf(who), 40)}<span class="nf-text"><span>${textOf(n)}</span><small>${esc(timeAgo(n.at))}</small></span>`;
  return `
    <li class="nf-item${n.at > seenAt ? " is-new" : ""}">
      ${openable ? `<button type="button" class="nf-main" data-nf-open="${esc(who)}">${inner}</button>` : `<div class="nf-main">${inner}</div>`}
      ${actionsHtml(n)}
      ${n.at > seenAt ? `<span class="sr-only">${esc(t("nfNewLabel"))}</span>` : ""}
    </li>`;
}

/** Gère les boutons communs (accepter, refuser, bravo, ouvrir un pote) dans un conteneur */
export function bindNotifActions(container) {
  container.addEventListener("click", async event => {
    const accept = event.target.closest("[data-nf-accept]");
    const refuse = event.target.closest("[data-nf-refuse]");
    const bravo = event.target.closest("[data-nf-bravo]");
    const open = event.target.closest("[data-nf-open]");
    const join = event.target.closest("[data-nf-join]");
    const nojoin = event.target.closest("[data-nf-nojoin]");
    if (join) { join.disabled = true; acceptProgramInvite(join.dataset.nfJoin); return; }
    if (nojoin) { nojoin.disabled = true; declineProgramInvite(nojoin.dataset.nfNojoin); return; }
    try {
      if (accept) { accept.disabled = true; await Social.acceptRequest(accept.dataset.nfAccept); showToast(t("pqAccepted", { name: nameOf(Social.profileOf(accept.dataset.nfAccept)) })); }
      else if (refuse) { refuse.disabled = true; await Social.refuseRequest(refuse.dataset.nfRefuse); showToast(t("pqRefused")); }
      else if (bravo) {
        const [author, eventId] = bravo.dataset.nfBravo.split("|");
        bravo.disabled = true;
        bravo.classList.add("is-sent");
        await Social.cheer(author, eventId);
        showToast(t("nfBravoSent", { name: nameOf(Social.profileOf(author)) }));
      } else if (open) Bridge.openFriend?.(open.dataset.nfOpen);
    } catch (err) {
      console.error("[TrackLift] notification :", err);
      showToast(t(navigator.onLine === false ? "potesNeedOnline" : "potesJoinError"));
      [accept, refuse, bravo].forEach(btn => { if (btn) { btn.disabled = false; btn.classList.remove("is-sent"); } });
    }
  });
}

/* ─── Liste des notifications ──────────────────────────── */
export function openNotifications() {
  let off = null;
  const seenAt = Social.seenAt; // gardé à l'ouverture : les nouveautés restent marquées pendant la lecture
  const { sheet } = openSheet({ onClose: () => off?.() });
  bindNotifActions(sheet);
  let first = true;
  let signature = "";
  const draw = () => {
    const list = buildNotifications();
    const next = JSON.stringify(list.map(n => [n.key, n.at, n.kind === "event" && Social.hasCheered(n.events[0].id), Social.profileOf(n.uid || n.from?.[0])?.username]));
    if (next === signature) return;
    signature = next;
    sheet.innerHTML = `
      <div class="tl-sheet-inner">
        ${sheetHead(t("nfTitle"))}
        ${list.length ? `<ul class="nf-list">${list.map(n => itemHtml(n, seenAt)).join("")}</ul>`
          : `<div class="card pt-card pt-empty"><img class="pt-mascot pt-mascot-sm" src="${MASCOT}" alt="" width="70" height="184"><p class="pt-text">${esc(t("nfEmpty"))}</p></div>`}
        <button type="button" class="hero-other nf-settings" data-nf-settings>${esc(t("nfSettings"))}</button>
      </div>`;
    if (first) { sheet.querySelector("#tl-sheet-title").focus(); first = false; }
  };
  sheet.addEventListener("click", event => { if (event.target.closest("[data-nf-settings]")) Bridge.openSettings?.(); });
  off = Social.onChange(draw);
  draw();
  Social.markSeen();
}

/* ─── Cloche ───────────────────────────────────────────── */
export function mountBell(btn) {
  const badge = btn.querySelector(".bell-badge");
  let last = -1;
  const update = () => {
    btn.classList.toggle("hidden", !Social.joined);
    if (!Social.joined) return;
    const count = unseenCount();
    badge.textContent = count > 9 ? "9+" : String(count);
    badge.classList.toggle("hidden", count === 0);
    btn.setAttribute("aria-label", count ? tn("nfBellNew", count) : t("nfTitle"));
    if (count > last && last >= 0) bump(btn);
    last = count;
  };
  btn.addEventListener("click", openNotifications);
  Social.onChange(update);
  update();
}

/* ─── En direct : un petit message quand un pote fait quelque chose ── */
export function watchLive() {
  let known = null;
  let armedAt = 0;
  Social.onChange(() => {
    if (!Social.joined || !Social.liveReady) { known = null; return; }
    const list = buildNotifications();
    if (!known) {
      // on laisse le temps aux listes de se remplir avant d'annoncer quoi que ce soit
      if (!armedAt) armedAt = Date.now() + 2500;
      if (Date.now() < armedAt) return;
      known = new Set(list.map(n => n.key));
      return;
    }
    const fresh = list.filter(n => !known.has(n.key) && n.at > Date.now() - 10 * 60000);
    list.forEach(n => known.add(n.key));
    if (!fresh.length) return;
    const text = textOf(fresh[0], true);
    showToast(text);
    fresh.forEach(n => PushHook.deliver(n, textOf(n, true)));
  });
}

/* ─── Une seule ligne d'activité sur l'accueil ─────────── */
export function renderHomeLine(el) {
  if (!el) return;
  const list = Social.joined ? buildNotifications().filter(n => n.kind === "request" || n.kind === "invite" || (n.kind === "event" && n.at > Date.now() - 3 * DAY)) : [];
  const top = list.find(n => n.kind === "request" || n.kind === "invite") || list[0];
  if (!top) { el.innerHTML = ""; el.classList.add("hidden"); return; }
  el.classList.remove("hidden");
  const who = top.uid;
  const action = top.kind === "event" && !Social.hasCheered(top.events[0].id)
    ? `<button type="button" class="btn btn-ghost btn-sm nf-bravo" data-nf-bravo="${esc(who)}|${esc(top.events[0].id)}">${esc(t("nfBravo"))}</button>` : "";
  el.innerHTML = `
    <button type="button" class="pl-main" data-pl-open>
      ${personAvatar(Social.profileOf(who), 34)}
      <span class="pl-text">${textOf(top)}</span>
      <svg class="pl-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
    </button>
    ${action}`;
}

export function bindHomeLine(el) {
  bindNotifActions(el);
  el.addEventListener("click", event => { if (event.target.closest("[data-pl-open]")) openNotifications(); });
}
