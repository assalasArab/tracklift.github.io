/* ═══════════════════════════════════════════════════════════
   Programmes en commun : mettre un de ses programmes en commun,
   inviter ses potes par un bouton (pas de lien à envoyer), rejoindre,
   et un classement dans chaque programme (séances et records faits
   avec CE programme, jamais les charges).
   Plus bas : exercices de la communauté (10 maximum par personne).
   ═══════════════════════════════════════════════════════════ */
import { showToast } from "./utils.js?v=20261030a";
import { i18n } from "./i18n.js?v=20261030a";
import { Social } from "./social.js?v=20261030a";
import { rankEntries, competitionValue } from "./social-stats.js?v=20261030a";
import { SharedPrograms, Community, COMMUNITY_LIMIT } from "./community.js?v=20261030a";
import { t, tn, esc, openSheet, sheetHead, confirmSheet, personAvatar, nameOf, MASCOT, Bridge } from "./potes-ui.js?v=20261030a";
import { ordinal } from "./potes-board.js?v=20261030a";

const errorText = err => t(err?.code === "offline" ? "potesNeedOnline" : err?.code === "limit" ? "cmLimit" : err?.code === "gone" ? "spGone" : "potesJoinError", { limit: COMMUNITY_LIMIT });
const CHEVRON = `<svg class="gr-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>`;
const emptyCard = text => `<div class="card pt-card pt-empty"><img class="pt-mascot pt-mascot-sm" src="${MASCOT}" alt="" width="70" height="184"><p class="pt-text">${esc(text)}</p></div>`;

/* ─── Programmes en commun : programme + membres, gardés une minute ─── */
const groupCache = new Map(); // idPartagé → { program, members, at }
async function loadGroup(id, force = false) {
  const cached = groupCache.get(id);
  if (cached && !force && Date.now() - cached.at < 60000) return cached;
  const [program, members] = await Promise.all([SharedPrograms.get(id), SharedPrograms.membersData(id)]);
  const entry = { program, members: members || [], at: Date.now() };
  groupCache.set(id, entry);
  await Social._fetchProfiles([...entry.members.map(m => m.uid), program?.owner].filter(Boolean));
  return entry;
}
export function forgetGroups() { groupCache.clear(); }

/** Personnes dans le programme : l'auteur + les membres (sans doublon) */
function peopleOf(entry) {
  return [...new Set([entry.program?.owner, ...entry.members.map(m => m.uid)].filter(Boolean))];
}

const CP_CRITERIA = ["week", "total", "records"];
const cpUnit = (criterion, value) => t(`pbUnit.${criterion === "records" ? "records" : "sessions"}${(i18n.getLanguage() === "en" ? value !== 1 : value > 1) ? "Many" : ""}`);

function ranking(members, criterion, now = Date.now()) {
  return rankEntries(members.filter(m => m.compete).map(m => {
    const me = m.uid === Social.uid;
    const profile = me ? Social.profile : Social.profileOf(m.uid);
    return { uid: m.uid, me, profile, name: me ? Social.username : nameOf(profile), value: competitionValue(criterion, m, now) };
  }));
}

/** Programmes que mes potes partagent (vus dans leur résumé) et que je n'ai pas encore */
function friendsPrograms(mineIds) {
  const out = [];
  for (const friend of Social.friends.values()) {
    for (const p of friend.items?.programs?.list || []) {
      if (p?.id && !mineIds.has(p.id) && !out.some(o => o.id === p.id)) out.push({ id: p.id, name: p.name, owner: friend.uid });
    }
  }
  return out;
}

/* ─── Onglet « Programmes » de la page Potes ───────────── */
let panelLoading = false;
export function groupsPanelHtml() {
  const groups = SharedPrograms.myGroups(Bridge.getPrograms());
  const missing = groups.filter(g => !groupCache.has(g.id));
  if (missing.length && !panelLoading) {
    panelLoading = true;
    Promise.all(missing.map(g => loadGroup(g.id).catch(() => null))).finally(() => { panelLoading = false; Social._emit(); });
  }
  const invites = Social.invitesIn.map(inv => {
    const name = nameOf(Social.profileOf(inv.from));
    const text = esc(t("grInvitedBy", { name: "\u0001", program: inv.name })).replace("\u0001", `<b>${esc(name)}</b>`);
    return `
      <li class="card pt-card gr-invite">
        <div class="gr-invite-head">${personAvatar(Social.profileOf(inv.from), 40)}<p class="pt-text">${text}</p></div>
        <p class="gr-fine">${esc(t("grJoinFine"))}</p>
        <div class="gr-actions">
          <button type="button" class="btn btn-primary btn-sm" data-gr-accept="${esc(inv.id)}" data-k="gra-${esc(inv.id)}">${esc(t("grAccept"))}</button>
          <button type="button" class="btn btn-surface btn-sm" data-gr-decline="${esc(inv.id)}" data-k="grd-${esc(inv.id)}">${esc(t("grDecline"))}</button>
        </div>
      </li>`;
  }).join("");
  const rows = groups.map(g => {
    const entry = groupCache.get(g.id);
    const bits = [g.mine ? t("grMine") : entry?.program ? t("spBy", { name: nameOf(Social.profileOf(entry.program.owner)) }) : ""];
    if (entry?.program) {
      bits.push(tn("grPeople", peopleOf(entry).length));
      const me = ranking(entry.members, "week").find(e => e.me);
      if (me) bits.push(t("grMyPlace", { place: ordinal(me.place) }));
    }
    return `<li><button type="button" class="card gr-row" data-gr-open="${esc(g.id)}" data-k="gro-${esc(g.id)}">
      <span class="gr-row-text"><b>${esc(g.name)}</b><small>${esc(bits.filter(Boolean).join(" · "))}</small></span>${CHEVRON}</button></li>`;
  }).join("");
  const mineIds = new Set([...groups.map(g => g.id), ...Social.invitesIn.map(inv => inv.programId)]);
  const others = friendsPrograms(mineIds).map(p => `
    <li><button type="button" class="card gr-row" data-gr-preview="${esc(p.id)}" data-k="grp-${esc(p.id)}">
      <span class="gr-row-text"><b>${esc(p.name)}</b><small>${esc(t("spBy", { name: nameOf(Social.profileOf(p.owner)) }))}</small></span>
      <span class="gr-row-cta">${esc(t("grSee"))}</span></button></li>`).join("");
  return `
    <div class="pt-panel" role="tabpanel" id="pt-panel" aria-labelledby="pt-tab-programs">
      <p class="tl-sheet-hand gr-hand">${esc(t("grHand"))}</p>
      ${invites ? `<h2 class="section-title pt-section">${esc(t("grInvitesTitle"))}</h2><ul class="gr-invites">${invites}</ul>` : ""}
      <h2 class="section-title pt-section">${esc(t("grMineTitle"))}</h2>
      ${rows ? `<ul class="gr-list">${rows}</ul>` : emptyCard(t("grEmpty"))}
      <button type="button" class="btn btn-primary btn-block gr-create" data-gr-create data-k="gr-create">${esc(t("grCreate"))}</button>
      ${others ? `<h2 class="section-title pt-section">${esc(t("grFriendsTitle"))}</h2><ul class="gr-list">${others}</ul>` : ""}
    </div>`;
}

/** Boutons de l'onglet (renvoie vrai si le clic est traité ici) */
export function handleGroupsClick(event) {
  const el = selector => event.target.closest(selector);
  const accept = el("[data-gr-accept]");
  if (accept) { accept.disabled = true; acceptProgramInvite(accept.dataset.grAccept); return true; }
  const decline = el("[data-gr-decline]");
  if (decline) { decline.disabled = true; declineProgramInvite(decline.dataset.grDecline); return true; }
  const open = el("[data-gr-open]");
  if (open) { openProgramGroup(open.dataset.grOpen); return true; }
  const preview = el("[data-gr-preview]");
  if (preview) { openProgramPreview(preview.dataset.grPreview); return true; }
  if (el("[data-gr-create]")) { openShareChooser(); return true; }
  return false;
}

/* ─── Accepter / refuser une invitation (onglet ou notifications) ─── */
export async function acceptProgramInvite(inviteId) {
  const invite = Social.invitesIn.find(item => item.id === inviteId);
  if (!invite) return;
  try {
    const program = await SharedPrograms.acceptInvite(invite, Bridge.joinProgram, localId => Bridge.programStats(localId));
    groupCache.delete(program.id);
    showToast(t("spJoined", { name: program.name }));
    Bridge.refresh?.();
    openProgramGroup(program.id);
  } catch (err) {
    console.error("[TrackLift] invitation :", err);
    showToast(errorText(err));
    Social._emit();
  }
}

export async function declineProgramInvite(inviteId) {
  const invite = Social.invitesIn.find(item => item.id === inviteId);
  if (!invite) return;
  try { await SharedPrograms.declineInvite(invite); showToast(t("grDeclined")); }
  catch (err) { console.error("[TrackLift] invitation :", err); showToast(errorText(err)); Social._emit(); }
}

/* ─── Mettre un programme en commun ────────────────────── */
/** Choisir lequel de mes programmes mettre en commun (ou en créer un) */
export function openShareChooser() {
  const { sheet, close } = openSheet();
  const taken = new Set([...Object.keys(SharedPrograms.shares), ...Object.values(SharedPrograms.joined).map(entry => entry.localId)]);
  const free = Bridge.getPrograms().filter(p => !taken.has(p.id));
  sheet.innerHTML = `
    <div class="tl-sheet-inner">
      ${sheetHead(t("grCreateTitle"))}
      <p class="tl-sheet-hand">${esc(t("grCreateHand"))}</p>
      ${free.length ? `<ul class="gr-list">${free.map(p => `
        <li><button type="button" class="card gr-row" data-gr-pick="${esc(p.id)}">
          <span class="gr-row-text"><b>${esc(p.name)}</b><small>${esc(tn("grSessions", (p.sessions || []).length))}</small></span>
          <span class="gr-row-cta">${esc(t("grChoose"))}</span></button></li>`).join("")}</ul>` : `<p class="pt-text">${esc(t("grNoProgram"))}</p>`}
      <button type="button" class="btn btn-surface btn-block gr-new" data-gr-new>${esc(t("grNewProgram"))}</button>
    </div>`;
  sheet.querySelector("#tl-sheet-title").focus();
  sheet.addEventListener("click", event => {
    const pick = event.target.closest("[data-gr-pick]");
    if (pick) { openShareProgram(pick.dataset.grPick); return; }
    if (event.target.closest("[data-gr-new]")) { close(); Bridge.newProgram?.(localId => openShareProgram(localId)); }
  });
}

/** Mettre ce programme en commun : on explique ce qui est montré, puis on invite ses potes */
export function openShareProgram(localId) {
  const shareId = SharedPrograms.shares[localId];
  if (shareId) { openProgramGroup(shareId); return; }
  const program = Bridge.getPrograms().find(p => p.id === localId);
  if (!program) return;
  const { sheet } = openSheet();
  sheet.innerHTML = `
    <div class="tl-sheet-inner">
      ${sheetHead(t("grShareTitle", { name: program.name }))}
      <p class="pt-text">${esc(t("grShareIntro"))}</p>
      <ul class="pj-see">
        <li class="is-yes"><span aria-hidden="true">✓</span>${esc(t("spWhatYes"))}</li>
        <li class="is-yes"><span aria-hidden="true">✓</span>${esc(t("grWhatRanking"))}</li>
        <li class="is-no"><span aria-hidden="true">✕</span>${esc(t("grWhatNo"))}</li>
      </ul>
    </div>
    <div class="tl-dock"><button type="button" class="btn btn-primary btn-block" data-gr-share>${esc(t("grShareBtn"))}</button></div>`;
  sheet.querySelector("#tl-sheet-title").focus();
  sheet.addEventListener("click", async event => {
    const btn = event.target.closest("[data-gr-share]");
    if (!btn) return;
    btn.disabled = true;
    try {
      const shared = await SharedPrograms.publish(program, Bridge.getCustomExercises());
      // l'auteur est dans le classement de son programme, comme les membres
      await SharedPrograms.setCompete(shared.id, true, Bridge.programStats(localId));
      groupCache.delete(shared.id);
      showToast(t("grShared"));
      Bridge.refresh?.();
      openInvitePicker(shared.id, { fresh: true });
    } catch (err) {
      console.error("[TrackLift] mise en commun :", err);
      showToast(errorText(err));
      btn.disabled = false;
    }
  });
}

/* ─── Inviter des potes (par bouton) ───────────────────── */
export async function openInvitePicker(id, { fresh = false } = {}) {
  let off = null;
  const { sheet, close } = openSheet({ onClose: () => off?.() });
  sheet.innerHTML = `<div class="tl-sheet-inner">${sheetHead(t("grInviteTitle"))}<p class="pt-loading" role="status">${esc(t("potesLoading"))}</p></div>`;
  sheet.querySelector("#tl-sheet-title").focus();
  const entry = await loadGroup(id, true).catch(() => null);
  if (!sheet.isConnected) return;
  if (!entry?.program) { sheet.innerHTML = `<div class="tl-sheet-inner">${sheetHead(t("grInviteTitle"))}${emptyCard(t("spGone"))}</div>`; return; }
  const inside = new Set(peopleOf(entry));
  let first = true;
  let actedOn = null; // le pote qu'on vient d'inviter : le focus reste sur sa ligne
  const draw = () => {
    const friends = [...Social.friends.values()].sort((a, b) => nameOf(a.profile).localeCompare(nameOf(b.profile)));
    const rows = friends.map(f => {
      const name = nameOf(f.profile);
      let action;
      if (inside.has(f.uid)) action = `<span class="pq-tag">${esc(t("grInside"))}</span>`;
      else if (SharedPrograms.isInvited(id, f.uid)) action = `<span class="pq-tag">${esc(t("grInvitedTag"))}</span><button type="button" class="hero-other gr-undo" data-gr-uninvite="${esc(f.uid)}" aria-label="${esc(t("grUninviteOf", { name }))}">${esc(t("pqCancel"))}</button>`;
      else action = `<button type="button" class="btn btn-ghost btn-sm" data-gr-invite-friend="${esc(f.uid)}" aria-label="${esc(t("grInviteOf", { name }))}">${esc(t("grInviteBtn"))}</button>`;
      return `<li class="pq-row">${personAvatar(f.profile, 40)}<span class="pq-name">${esc(name)}</span><span class="pq-actions">${action}</span></li>`;
    }).join("");
    const focusKey = actedOn || (sheet.contains(document.activeElement) ? document.activeElement.dataset?.grInviteFriend || document.activeElement.dataset?.grUninvite : null);
    sheet.innerHTML = `
      <div class="tl-sheet-inner">
        ${sheetHead(t(fresh ? "grInviteTitleFresh" : "grInviteTitle"), entry.program.name)}
        <p class="tl-sheet-hand">${esc(t("grInviteHand"))}</p>
        ${rows ? `<ul class="pq-list card gr-picker">${rows}</ul>`
          : `${emptyCard(t("grNoFriends"))}<button type="button" class="btn btn-surface btn-block" data-gr-go-friends>${esc(t("grGoFriends"))}</button>`}
      </div>
      <div class="tl-dock"><button type="button" class="btn btn-primary btn-block" data-gr-done>${esc(t(fresh ? "grSeeGroup" : "grDone"))}</button></div>`;
    if (first) { sheet.querySelector("#tl-sheet-title").focus(); first = false; }
    else if (focusKey) (sheet.querySelector(`[data-gr-uninvite="${CSS.escape(focusKey)}"], [data-gr-invite-friend="${CSS.escape(focusKey)}"]`) || sheet.querySelector("[data-gr-done]"))?.focus();
  };
  draw();
  off = Social.onChange(draw);
  sheet.addEventListener("click", async event => {
    if (event.target.closest("[data-gr-done]")) { openProgramGroup(id); return; }
    if (event.target.closest("[data-gr-go-friends]")) { close(); Bridge.goPotes?.("friends"); return; }
    const invite = event.target.closest("[data-gr-invite-friend]");
    const undo = event.target.closest("[data-gr-uninvite]");
    if (!invite && !undo) return;
    const uid = invite?.dataset.grInviteFriend || undo.dataset.grUninvite;
    const name = nameOf(Social.profileOf(uid));
    actedOn = uid;
    (invite || undo).disabled = true;
    try {
      if (invite) { await SharedPrograms.invite(id, entry.program.name, uid); showToast(t("grInvited", { name })); }
      else { await SharedPrograms.cancelInvite(id, uid); showToast(t("grUninvited", { name })); }
    } catch (err) {
      console.error("[TrackLift] invitation :", err);
      // déjà invité par un autre membre : l'invitation existe déjà
      showToast(err?.code === "permission-denied" && invite ? t("grAlreadyInvited", { name }) : errorText(err));
      (invite || undo).disabled = false;
    }
  });
}

/* ─── Voir un programme partagé (lien, page d'un pote, onglet) et le rejoindre ─── */
function exerciseLabel(exId, program) {
  const custom = (program.customs || []).find(c => c.id === exId);
  return custom ? custom.name : Bridge.nameOf(exId);
}

export async function openProgramPreview(id) {
  const mineAlready = Object.values(SharedPrograms.shares).includes(id) || SharedPrograms.joined[id];
  if (mineAlready) { openProgramGroup(id); return; }
  const { sheet, close } = openSheet();
  sheet.innerHTML = `<div class="tl-sheet-inner">${sheetHead(t("spPreviewTitle"))}<p class="pt-loading" role="status">${esc(t("potesLoading"))}</p></div>`;
  sheet.querySelector("#tl-sheet-title").focus();
  const program = await SharedPrograms.get(id);
  if (!sheet.isConnected) return;
  if (!program) { sheet.innerHTML = `<div class="tl-sheet-inner">${sheetHead(t("spPreviewTitle"))}${emptyCard(t("spGone"))}</div>`; return; }
  await Social._fetchProfiles([program.owner]);
  const owner = program.owner === Social.uid ? Social.profile : Social.profileOf(program.owner);
  sheet.innerHTML = `
    <div class="tl-sheet-inner">
      ${sheetHead(program.name, t("grKicker"))}
      <div class="sp-owner">${personAvatar(owner, 40)}<span>${esc(t("spBy", { name: nameOf(owner) }))}</span></div>
      ${program.description ? `<p class="pt-text">${esc(program.description)}</p>` : ""}
      ${sessionsHtml(program)}
    </div>
    <div class="tl-dock sp-dock">
      ${Social.joined ? `<p class="gr-fine">${esc(t("grJoinFine"))}</p><button type="button" class="btn btn-primary btn-block" data-sp-join>${esc(t("spJoin"))}</button>`
        : `<button type="button" class="btn btn-primary btn-block" data-sp-need-join>${esc(t("spNeedJoin"))}</button>`}
    </div>`;
  sheet.addEventListener("click", async event => {
    if (event.target.closest("[data-sp-need-join]")) { close(); Bridge.goPotes?.(); return; }
    const btn = event.target.closest("[data-sp-join]");
    if (!btn) return;
    btn.disabled = true;
    try {
      const localId = Bridge.joinProgram(program);
      await SharedPrograms.join(program, localId, Bridge.programStats(localId));
      // une invitation en attente pour ce programme n'a plus lieu d'être
      const pending = Social.invitesIn.find(inv => inv.programId === id);
      if (pending) SharedPrograms.declineInvite(pending).catch(() => {});
      groupCache.delete(id);
      showToast(t("spJoined", { name: program.name }));
      Bridge.refresh?.();
      openProgramGroup(id);
    } catch (err) { console.error("[TrackLift] programme partagé :", err); showToast(errorText(err)); btn.disabled = false; }
  });
}

function sessionsHtml(program) {
  return `<ol class="sp-sessions">${(program.sessions || []).map(s => `
    <li class="card pt-card">
      <h3 class="sp-session-name">${esc(s.name)} <span class="badge">${esc(Bridge.sessionTypeLabel?.(s.type) || s.type)}</span></h3>
      <ul class="sp-ex">${(s.exerciseIds || []).map(exId => {
        const plan = s.plan?.[exId];
        return `<li><span>${esc(exerciseLabel(exId, program))}</span>${plan ? `<small>${plan.sets} × ${plan.reps}</small>` : ""}</li>`;
      }).join("")}</ul>
    </li>`).join("")}</ol>`;
}

/* ─── La page d'un programme en commun : classement, membres, inviter ─── */
export async function openProgramGroup(id) {
  const { sheet, close } = openSheet();
  let crit = "week";
  let busy = false;
  sheet.innerHTML = `<div class="tl-sheet-inner">${sheetHead(t("grKicker"))}<p class="pt-loading" role="status">${esc(t("potesLoading"))}</p></div>`;
  sheet.querySelector("#tl-sheet-title").focus();
  const localId = SharedPrograms.localIdOf(id);
  const myStats = () => (localId ? Bridge.programStats?.(localId) : null);
  // mes chiffres à jour avant d'afficher le classement
  if (SharedPrograms.competing[id]) await SharedPrograms.pushStats(other => (other === id ? myStats() : null)).catch(() => {});
  let entry = id ? await loadGroup(id, true).catch(() => null) : null;
  if (!sheet.isConnected) return;
  if (!entry?.program) { sheet.innerHTML = `<div class="tl-sheet-inner">${sheetHead(t("grKicker"))}${emptyCard(t("spGone"))}</div>`; return; }

  const draw = () => {
    const program = entry.program;
    const mine = program.owner === Social.uid;
    const competing = !!SharedPrograms.competing[id];
    const joinedEntry = SharedPrograms.joined[id];
    const outdated = joinedEntry && joinedEntry.version < program.version;
    const ranked = ranking(entry.members, crit);
    const people = peopleOf(entry);
    const outside = people.filter(uid => !ranked.some(e => e.uid === uid));
    const owner = mine ? Social.profile : Social.profileOf(program.owner);
    const tabs = `
      <div class="pb-tabs" role="radiogroup" aria-label="${esc(t("pbCriterion"))}">
        ${CP_CRITERIA.map(c => `<button type="button" role="radio" class="pb-tab" aria-checked="${c === crit}" tabindex="${c === crit ? 0 : -1}" data-cp-crit="${c}">${esc(t(`cpCrit.${c}`))}</button>`).join("")}
      </div>
      <p class="pb-period">${esc(t(`cpPeriod.${crit}`))}</p>`;
    const list = ranked.length ? `
      <ol class="pb-list">${ranked.map(e => `
        <li class="pb-row${e.me ? " is-me" : ""}">
          <span class="pb-rank">${e.place}</span>
          ${personAvatar(e.profile, 36)}
          <span class="pb-row-name">${esc(e.me ? t("pbYou") : e.name)}</span>
          <span class="pb-row-value"><b>${e.value}</b> ${esc(cpUnit(crit, e.value))}</span>
        </li>`).join("")}</ol>` : emptyCard(t("cpEmpty"));
    sheet.innerHTML = `
      <div class="tl-sheet-inner">
        ${sheetHead(program.name, t("grKicker"))}
        <div class="sp-owner">${personAvatar(owner, 40)}<span>${esc(mine ? t("grMineLong") : t("spBy", { name: nameOf(owner) }))} · ${esc(tn("grPeople", people.length))}</span></div>
        ${outdated ? `<button type="button" class="btn btn-surface btn-block gr-refresh" data-gr-refresh>${esc(t("spRefreshCopy"))}</button>` : ""}
        <h3 class="gr-sub">${esc(t("grRanking"))}</h3>
        ${tabs}
        ${list}
        ${outside.length ? `<p class="gr-fine">${esc(t("grOutside", { names: outside.map(uid => uid === Social.uid ? t("pbYou") : nameOf(Social.profileOf(uid))).join(", ") }))}</p>` : ""}
        ${competing ? "" : `<div class="card pt-card cp-join"><p class="pt-text"><b>${esc(t("cpNotIn"))}</b> ${esc(t("cpWhat"))}</p>
          <button type="button" class="btn btn-ghost btn-sm" data-cp-join${localId ? "" : " disabled"}>${esc(t("cpJoin"))}</button></div>`}
        <div class="gr-tools">
          ${localId ? `<button type="button" class="btn btn-surface btn-block" data-gr-sessions>${esc(t("grSeeSessions"))}</button>` : ""}
          ${mine ? `<button type="button" class="btn btn-surface btn-block" data-gr-update>${esc(t("spUpdate"))}</button>` : ""}
        </div>
        <div class="gr-leave">
          ${competing ? `<button type="button" class="hero-other" data-cp-leave>${esc(t("cpLeave"))}</button>` : ""}
          ${mine ? `<button type="button" class="text-danger-btn" data-gr-stop>${esc(t("spStop"))}</button>`
            : `<button type="button" class="text-danger-btn" data-gr-unfollow>${esc(t("grLeaveProgram"))}</button>`}
        </div>
      </div>
      <div class="tl-dock"><button type="button" class="btn btn-primary btn-block" data-gr-invite>${esc(t("grInviteFriends"))}</button></div>`;
  };
  draw();

  const refresh = async () => {
    entry = await loadGroup(id, true).catch(() => entry);
    if (sheet.isConnected && entry?.program) draw();
  };

  sheet.addEventListener("keydown", event => {
    const tab = event.target.closest("[data-cp-crit]");
    if (!tab || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const i = CP_CRITERIA.indexOf(crit) + (event.key === "ArrowRight" ? 1 : -1);
    crit = CP_CRITERIA[(i + CP_CRITERIA.length) % CP_CRITERIA.length];
    draw();
    sheet.querySelector(`[data-cp-crit="${crit}"]`)?.focus();
  });

  sheet.addEventListener("click", async event => {
    const tab = event.target.closest("[data-cp-crit]");
    if (tab) { crit = tab.dataset.cpCrit; draw(); sheet.querySelector(`[data-cp-crit="${crit}"]`)?.focus(); return; }
    if (event.target.closest("[data-gr-invite]")) { openInvitePicker(id); return; }
    if (event.target.closest("[data-gr-sessions]")) { close(); Bridge.openProgramDetail?.(localId); return; }
    const btn = event.target.closest("[data-cp-join], [data-cp-leave], [data-gr-update], [data-gr-refresh], [data-gr-stop], [data-gr-unfollow]");
    if (!btn || busy) return;
    busy = true;
    btn.disabled = true;
    try {
      if (btn.matches("[data-cp-join]")) {
        await SharedPrograms.setCompete(id, true, myStats());
        showToast(t("cpJoined"));
      } else if (btn.matches("[data-gr-update]")) {
        const program = Bridge.getPrograms().find(p => p.id === localId);
        if (program) { await SharedPrograms.publish(program, Bridge.getCustomExercises()); showToast(t("spUpdated")); }
      } else if (btn.matches("[data-gr-refresh]")) {
        Bridge.updateProgramCopy(localId, entry.program);
        await SharedPrograms.markUpdated(id, entry.program.version);
        showToast(t("spRefreshed"));
      } else {
        // quitter : confirmation (la feuille de confirmation remplace celle-ci, on la rouvre ensuite si besoin)
        const kind = btn.matches("[data-cp-leave]") ? "leave" : btn.matches("[data-gr-stop]") ? "stop" : "unfollow";
        const texts = {
          leave: { title: t("cpLeaveTitle"), text: t("cpLeaveText"), confirmLabel: t("cpLeave") },
          stop: { title: t("spStopTitle"), text: t("spStopText"), confirmLabel: t("spStop") },
          unfollow: { title: t("grLeaveTitle"), text: t("grLeaveText"), confirmLabel: t("grLeaveProgram") }
        }[kind];
        busy = false;
        const ok = await confirmSheet(texts);
        if (!ok) { openProgramGroup(id); return; }
        if (kind === "leave") { await SharedPrograms.setCompete(id, false); showToast(t("cpLeft")); openProgramGroup(id); }
        else if (kind === "stop") { await SharedPrograms.unpublish(localId); groupCache.delete(id); showToast(t("spStopped")); Bridge.refresh?.(); }
        else { await SharedPrograms.unfollow(id); groupCache.delete(id); showToast(t("spUnfollowed")); Bridge.refresh?.(); }
        return;
      }
      Bridge.refresh?.();
      await refresh();
    } catch (err) {
      console.error("[TrackLift] programme en commun :", err);
      showToast(errorText(err));
    }
    busy = false;
    if (sheet.isConnected) draw();
  });
}

/** Ancien nom (page d'un programme, liens existants) */
export const openProgramCompetition = openProgramGroup;
/** Ancien bouton « partager » d'un programme */
export const openProgramShare = openShareProgram;

/* ─── Exercices de la communauté ───────────────────────── */
const HIDDEN_KEY = "tl-community-hidden";
function hiddenIds() { try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]")); } catch { return new Set(); } }
function hide(id) { try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hiddenIds(), id])); } catch { /* stockage indisponible */ } }

export async function openCommunity() {
  const { sheet } = openSheet();
  let query = "";
  let mode = "list"; // ou "pick" (choisir un exercice perso à proposer)
  sheet.innerHTML = `<div class="tl-sheet-inner">${sheetHead(t("cmTitle"))}<p class="pt-loading" role="status">${esc(t("potesLoading"))}</p></div>`;
  sheet.querySelector("#tl-sheet-title").focus();
  await Community.load();
  if (!sheet.isConnected) return;

  const meta = ex => [Bridge.translate?.("muscle_focus", ex.muscle_focus), Bridge.translate?.("equipment", ex.equipment)].filter(Boolean).join(" · ");
  const inLibrary = ex => Bridge.getCustomExercises().some(c => c.communityId === ex.id);
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const draw = () => {
    const mine = Community.mine();
    if (mode === "pick") {
      const published = new Set(mine.map(ex => norm(ex.name)));
      // seulement tes propres exercices : pas ceux venus de la communauté ou d'un programme partagé
      const candidates = Bridge.getCustomExercises().filter(ex => !ex.communityId && !ex.sharedFrom && !published.has(norm(ex.name_fr || ex.name)));
      sheet.innerHTML = `
        <div class="tl-sheet-inner">
          ${sheetHead(t("cmPickTitle"))}
          <p class="tl-sheet-hand">${esc(t("cmLeft", { count: COMMUNITY_LIMIT - mine.length, limit: COMMUNITY_LIMIT }))}</p>
          ${candidates.length ? `<ul class="cm-list">${candidates.map(ex => `
            <li class="cm-row"><div><b>${esc(ex.name_fr || ex.name)}</b><small>${esc(meta(ex))}</small></div>
              <button type="button" class="btn btn-ghost btn-sm" data-cm-publish="${esc(ex.id)}">${esc(t("cmPublish"))}</button></li>`).join("")}</ul>`
            : `<p class="pt-text">${esc(t("cmNoCustom"))}</p>`}
          <button type="button" class="hero-other" data-cm-back>${esc(t("potesBack"))}</button>
        </div>`;
      return;
    }
    const hidden = hiddenIds();
    const list = Community.list.filter(ex => !hidden.has(ex.id) && (!query || norm(ex.name).includes(norm(query))));
    const focusSearch = document.activeElement?.id === "cm-search";
    sheet.innerHTML = `
      <div class="tl-sheet-inner">
        ${sheetHead(t("cmTitle"))}
        <p class="tl-sheet-hand">${esc(t("cmHand"))}</p>
        <label class="sr-only" for="cm-search">${esc(t("cmSearch"))}</label>
        <input id="cm-search" class="input" type="search" placeholder="${esc(t("cmSearch"))}" value="${esc(query)}" autocomplete="off">
        <div class="cm-mine">
          <span>${esc(t("cmMine", { count: mine.length, limit: COMMUNITY_LIMIT }))}</span>
          <button type="button" class="btn btn-ghost btn-sm" data-cm-pick${mine.length >= COMMUNITY_LIMIT ? " disabled" : ""}>${esc(t("cmPropose"))}</button>
        </div>
        ${Community.error ? `<p class="pt-text">${esc(t("potesErrorText"))}</p>` : list.length ? `<ul class="cm-list">${list.map(ex => {
          const own = Community.key && ex.key === Community.key;
          return `<li class="cm-row">
            <div><b>${esc(ex.name)}</b><small>${esc(meta(ex))}${own ? ` · ${esc(t("cmByYou"))}` : ""}</small></div>
            <div class="cm-actions">
              ${inLibrary(ex) ? `<span class="cm-added">${esc(t("cmAdded"))}</span>` : `<button type="button" class="btn btn-ghost btn-sm" data-cm-add="${esc(ex.id)}">${esc(t("cmAdd"))}</button>`}
              ${own ? `<button type="button" class="hero-other cm-small" data-cm-remove="${esc(ex.id)}">${esc(t("cmRemove"))}</button>`
                : `<button type="button" class="hero-other cm-small" data-cm-hide="${esc(ex.id)}">${esc(t("cmHide"))}</button>`}
            </div>
          </li>`;
        }).join("")}</ul>` : `<div class="card pt-card pt-empty"><img class="pt-mascot pt-mascot-sm" src="${MASCOT}" alt="" width="70" height="184"><p class="pt-text">${esc(t(query ? "cmNoMatch" : "cmEmpty"))}</p></div>`}
      </div>`;
    if (focusSearch) { const input = sheet.querySelector("#cm-search"); input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  };
  draw();

  sheet.addEventListener("input", event => { if (event.target.id === "cm-search") { query = event.target.value; draw(); } });
  sheet.addEventListener("click", async event => {
    if (event.target.closest("[data-cm-pick]")) { mode = "pick"; draw(); sheet.querySelector("#tl-sheet-title").focus(); return; }
    if (event.target.closest("[data-cm-back]")) { mode = "list"; draw(); return; }
    const add = event.target.closest("[data-cm-add]");
    const publish = event.target.closest("[data-cm-publish]");
    const remove = event.target.closest("[data-cm-remove]");
    const hideBtn = event.target.closest("[data-cm-hide]");
    try {
      if (add) {
        const ex = Community.list.find(item => item.id === add.dataset.cmAdd);
        Bridge.addCommunityExercise(ex);
        showToast(t("cmAddedToast", { name: ex.name }));
        draw();
      } else if (publish) {
        publish.disabled = true;
        const ex = Bridge.getCustomExercises().find(item => item.id === publish.dataset.cmPublish);
        await Community.publish(ex);
        showToast(t("cmPublished", { name: ex.name_fr || ex.name }));
        mode = "list"; draw();
      } else if (remove) {
        const ok = await confirmSheet({ title: t("cmRemoveTitle"), text: t("cmRemoveText"), confirmLabel: t("cmRemove") });
        if (!ok) return openCommunity();
        await Community.remove(remove.dataset.cmRemove);
        showToast(t("cmRemoved"));
        openCommunity();
      } else if (hideBtn) {
        hide(hideBtn.dataset.cmHide);
        showToast(t("cmHidden"));
        draw();
      }
    } catch (err) {
      console.error("[TrackLift] communauté :", err);
      showToast(errorText(err));
      if (publish) publish.disabled = false;
    }
  });
}
