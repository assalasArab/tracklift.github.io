/* ═══════════════════════════════════════════════════════════
   Programmes partagés (partager, voir, rejoindre, mettre à jour)
   et exercices de la communauté (ajouter, proposer, 10 maximum).
   ═══════════════════════════════════════════════════════════ */
import { showToast } from "./utils.js?v=20261028a";
import { i18n } from "./i18n.js?v=20261028a";
import { Social } from "./social.js?v=20261028a";
import { rankEntries, competitionValue } from "./social-stats.js?v=20261028a";
import { SharedPrograms, Community, COMMUNITY_LIMIT } from "./community.js?v=20261028a";
import { t, tn, esc, openSheet, sheetHead, confirmSheet, personAvatar, nameOf, MASCOT, Bridge, shareLink } from "./potes-ui.js?v=20261028a";

const errorText = err => t(err?.code === "offline" ? "potesNeedOnline" : err?.code === "limit" ? "cmLimit" : "potesJoinError", { limit: COMMUNITY_LIMIT });

/* ─── Partager un de mes programmes ────────────────────── */
export function openProgramShare(localId) {
  const { sheet, close } = openSheet();
  let members = null;
  const draw = () => {
    const program = Bridge.getPrograms().find(p => p.id === localId);
    if (!program) { close(); return; }
    const shareId = SharedPrograms.shares[localId];
    const body = !shareId ? `
        <p class="pt-text">${esc(t("spIntro"))}</p>
        <ul class="pj-see">
          <li class="is-yes"><span aria-hidden="true">✓</span>${esc(t("spWhatYes"))}</li>
          <li class="is-no"><span aria-hidden="true">✕</span>${esc(t("spWhatNo"))}</li>
        </ul>`
      : `
        <p class="pt-text">${esc(t("spShared"))}</p>
        <div class="sp-link"><code>${esc(SharedPrograms.link(shareId))}</code></div>
        <p class="sp-members">${esc(members === null ? t("potesLoading") : members.length ? tn("spMembers", members.length) : t("spNoMembers"))}</p>
        ${members?.length ? `<div class="sp-faces">${members.slice(0, 8).map(uid => personAvatar(Social.profileOf(uid), 34)).join("")}</div>` : ""}
        <button type="button" class="btn btn-surface btn-block" data-sp-compete>${esc(t("cpOpen"))}</button>
        <button type="button" class="btn btn-surface btn-block" data-sp-update>${esc(t("spUpdate"))}</button>
        <button type="button" class="text-danger-btn" data-sp-stop>${esc(t("spStop"))}</button>`;
    sheet.innerHTML = `
      <div class="tl-sheet-inner">
        ${sheetHead(t("spTitle", { name: program.name }))}
        ${body}
      </div>
      <div class="tl-dock"><button type="button" class="btn btn-primary btn-block" data-sp-send>${esc(t(shareId ? "spSend" : "spShare"))}</button></div>`;
  };
  draw();
  sheet.querySelector("#tl-sheet-title")?.focus();
  const loadMembers = async () => {
    const id = SharedPrograms.shares[localId];
    if (!id) return;
    members = ((await SharedPrograms.members(id)) || []).filter(uid => uid !== Social.uid);
    await Social._fetchProfiles(members);
    draw();
  };
  loadMembers();

  sheet.addEventListener("click", async event => {
    const program = Bridge.getPrograms().find(p => p.id === localId);
    if (event.target.closest("[data-sp-compete]")) { openProgramCompetition(SharedPrograms.shares[localId]); return; }
    const btn = event.target.closest("[data-sp-send], [data-sp-update], [data-sp-stop]");
    if (!btn || !program) return;
    btn.disabled = true;
    try {
      if (btn.matches("[data-sp-send]")) {
        let id = SharedPrograms.shares[localId];
        if (!id) { id = (await SharedPrograms.publish(program, Bridge.getCustomExercises())).id; showToast(t("spDone")); }
        const how = await shareLink(SharedPrograms.link(id), program.name);
        if (how === "copied") showToast(t("potesLinkCopied"));
        draw(); loadMembers();
      } else if (btn.matches("[data-sp-update]")) {
        await SharedPrograms.publish(program, Bridge.getCustomExercises());
        showToast(t("spUpdated"));
      } else {
        const ok = await confirmSheet({ title: t("spStopTitle"), text: t("spStopText"), confirmLabel: t("spStop") });
        if (ok) { await SharedPrograms.unpublish(localId); showToast(t("spStopped")); Bridge.refresh?.(); }
        return;
      }
    } catch (err) { console.error("[TrackLift] partage de programme :", err); showToast(errorText(err)); }
    btn.disabled = false;
    Bridge.refresh?.();
  });
}

/* ─── Voir un programme partagé, le rejoindre ──────────── */
function exerciseLabel(exId, program) {
  const custom = (program.customs || []).find(c => c.id === exId);
  return custom ? custom.name : Bridge.nameOf(exId);
}

export async function openProgramPreview(id) {
  const { sheet, close } = openSheet();
  sheet.innerHTML = `<div class="tl-sheet-inner">${sheetHead(t("spPreviewTitle"))}<p class="pt-loading" role="status">${esc(t("potesLoading"))}</p></div>`;
  sheet.querySelector("#tl-sheet-title").focus();
  const program = await SharedPrograms.get(id);
  if (!sheet.isConnected) return;
  if (!program) {
    sheet.innerHTML = `<div class="tl-sheet-inner">${sheetHead(t("spPreviewTitle"))}<div class="card pt-card pt-empty"><img class="pt-mascot pt-mascot-sm" src="${MASCOT}" alt="" width="70" height="184"><p class="pt-text">${esc(t("spGone"))}</p></div></div>`;
    return;
  }
  await Social._fetchProfiles([program.owner]);
  const members = Social.joined ? ((await SharedPrograms.members(id)) || []).filter(uid => uid !== program.owner) : null;
  if (members) await Social._fetchProfiles(members);

  const draw = () => {
    const owner = program.owner === Social.uid ? Social.profile : Social.profileOf(program.owner);
    const mine = program.owner === Social.uid;
    const joined = SharedPrograms.joined[id];
    const outdated = joined && joined.version < program.version;
    let action;
    if (mine) action = `<p class="sp-note">${esc(t("spIsMine"))}</p><button type="button" class="btn btn-surface btn-block" data-sp-compete>${esc(t("cpOpen"))}</button>`;
    else if (!Social.joined) action = `<button type="button" class="btn btn-primary btn-block" data-sp-need-join>${esc(t("spNeedJoin"))}</button>`;
    else if (joined) action = `
      <p class="sp-note">${esc(t("spFollowing"))}</p>
      <button type="button" class="btn btn-surface btn-block" data-sp-compete>${esc(t("cpOpen"))}</button>
      ${outdated ? `<button type="button" class="btn btn-primary btn-block" data-sp-refresh>${esc(t("spRefreshCopy"))}</button>` : ""}
      <button type="button" class="hero-other" data-sp-unfollow>${esc(t("spUnfollow"))}</button>`;
    else action = `<button type="button" class="btn btn-primary btn-block" data-sp-join>${esc(t("spJoin"))}</button>`;
    sheet.innerHTML = `
      <div class="tl-sheet-inner">
        ${sheetHead(program.name)}
        <div class="sp-owner">${personAvatar(owner, 40)}<span>${esc(t("spBy", { name: nameOf(owner) }))}</span></div>
        ${program.description ? `<p class="pt-text">${esc(program.description)}</p>` : ""}
        ${members?.length ? `<p class="sp-members">${esc(tn("spMembers", members.length))}</p><div class="sp-faces">${members.slice(0, 8).map(uid => personAvatar(Social.profileOf(uid), 34)).join("")}</div>` : ""}
        <ol class="sp-sessions">${(program.sessions || []).map(s => `
          <li class="card pt-card">
            <h3 class="sp-session-name">${esc(s.name)} <span class="badge">${esc(Bridge.sessionTypeLabel?.(s.type) || s.type)}</span></h3>
            <ul class="sp-ex">${(s.exerciseIds || []).map(exId => {
              const plan = s.plan?.[exId];
              return `<li><span>${esc(exerciseLabel(exId, program))}</span>${plan ? `<small>${plan.sets} × ${plan.reps}</small>` : ""}</li>`;
            }).join("")}</ul>
          </li>`).join("")}</ol>
      </div>
      <div class="tl-dock sp-dock">${action}</div>`;
  };
  draw();

  sheet.addEventListener("click", async event => {
    if (event.target.closest("[data-sp-need-join]")) { close(); Bridge.goPotes?.(); return; }
    if (event.target.closest("[data-sp-compete]")) { openProgramCompetition(id); return; }
    const btn = event.target.closest("[data-sp-join], [data-sp-refresh], [data-sp-unfollow]");
    if (!btn) return;
    btn.disabled = true;
    try {
      if (btn.matches("[data-sp-join]")) {
        const localId = Bridge.joinProgram(program);
        await SharedPrograms.join(program, localId);
        showToast(t("spJoined", { name: program.name }));
      } else if (btn.matches("[data-sp-refresh]")) {
        Bridge.updateProgramCopy(SharedPrograms.joined[id].localId, program);
        await SharedPrograms.markUpdated(id, program.version);
        showToast(t("spRefreshed"));
      } else {
        await SharedPrograms.unfollow(id);
        showToast(t("spUnfollowed"));
      }
      Bridge.refresh?.();
      draw();
    } catch (err) { console.error("[TrackLift] programme partagé :", err); showToast(errorText(err)); btn.disabled = false; }
  });
}

/* ─── Compétition entre les membres d'un programme ─────────
   Chacun choisit d'y entrer. On compare des nombres faits avec CE programme :
   séances de la semaine, séances au total, records du mois. Jamais de charge. */
const CP_CRITERIA = ["week", "total", "records"];
const cpUnit = (criterion, value) => t(`pbUnit.${criterion === "records" ? "records" : "sessions"}${(i18n.getLanguage() === "en" ? value !== 1 : value > 1) ? "Many" : ""}`);

export async function openProgramCompetition(id) {
  const { sheet } = openSheet();
  let crit = "week";
  let busy = false;
  sheet.innerHTML = `<div class="tl-sheet-inner">${sheetHead(t("cpTitle"))}<p class="pt-loading" role="status">${esc(t("potesLoading"))}</p></div>`;
  sheet.querySelector("#tl-sheet-title").focus();
  const program = id ? await SharedPrograms.get(id) : null;
  if (!sheet.isConnected) return;
  if (!program) {
    sheet.innerHTML = `<div class="tl-sheet-inner">${sheetHead(t("cpTitle"))}<div class="card pt-card pt-empty"><img class="pt-mascot pt-mascot-sm" src="${MASCOT}" alt="" width="70" height="184"><p class="pt-text">${esc(t("spGone"))}</p></div></div>`;
    return;
  }
  const localId = SharedPrograms.localIdOf(id);
  const myStats = () => (localId ? Bridge.programStats?.(localId) : null);
  // mes chiffres à jour avant d'afficher le classement
  if (SharedPrograms.competing[id]) await SharedPrograms.pushStats(other => (other === id ? myStats() : null));
  let members = (await SharedPrograms.membersData(id)) || [];
  await Social._fetchProfiles([...members.map(m => m.uid), program.owner]);
  if (!sheet.isConnected) return;

  const draw = () => {
    const competing = !!SharedPrograms.competing[id];
    const now = Date.now();
    const ranked = rankEntries(members.filter(m => m.compete).map(m => {
      const me = m.uid === Social.uid;
      const profile = me ? Social.profile : Social.profileOf(m.uid);
      return { uid: m.uid, me, profile, name: me ? Social.username : nameOf(profile), value: competitionValue(crit, m, now) };
    }));
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
        </li>`).join("")}</ol>`
      : `<div class="card pt-card pt-empty"><img class="pt-mascot pt-mascot-sm" src="${MASCOT}" alt="" width="70" height="184"><p class="pt-text">${esc(t("cpEmpty"))}</p></div>`;
    const status = competing
      ? `<p class="cp-note">${esc(t("cpYouAreIn"))}</p>`
      : `<div class="card pt-card cp-join"><p class="pt-text"><b>${esc(t("cpNotIn"))}</b> ${esc(t("cpWhat"))}</p></div>`;
    sheet.innerHTML = `
      <div class="tl-sheet-inner">
        ${sheetHead(t("cpTitle"), program.name)}
        ${status}
        ${tabs}
        ${list}
        <p class="pb-note">${esc(t("cpNote"))}</p>
        ${competing ? `<button type="button" class="hero-other cp-leave" data-cp-leave>${esc(t("cpLeave"))}</button>` : ""}
      </div>
      <div class="tl-dock">
        ${competing
          ? `<button type="button" class="btn btn-primary btn-block" data-cp-invite>${esc(t("cpInvite"))}</button>`
          : `<button type="button" class="btn btn-primary btn-block" data-cp-join${localId ? "" : " disabled"}>${esc(t("cpJoin"))}</button>`}
      </div>`;
  };
  draw();

  const refresh = async () => {
    members = (await SharedPrograms.membersData(id)) || members;
    await Social._fetchProfiles(members.map(m => m.uid));
    if (sheet.isConnected) draw();
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
    if (event.target.closest("[data-cp-invite]")) {
      const how = await shareLink(SharedPrograms.link(id), program.name);
      if (how === "copied") showToast(t("potesLinkCopied"));
      return;
    }
    const btn = event.target.closest("[data-cp-join], [data-cp-leave]");
    if (!btn || busy) return;
    busy = true;
    btn.disabled = true;
    try {
      if (btn.matches("[data-cp-join]")) {
        await SharedPrograms.setCompete(id, true, myStats());
        showToast(t("cpJoined"));
      } else {
        const ok = await confirmSheet({ title: t("cpLeaveTitle"), text: t("cpLeaveText"), confirmLabel: t("cpLeave") });
        if (!ok) { busy = false; openProgramCompetition(id); return; }
        await SharedPrograms.setCompete(id, false);
        showToast(t("cpLeft"));
        busy = false;
        openProgramCompetition(id);
        return;
      }
      await refresh();
    } catch (err) {
      console.error("[TrackLift] compétition :", err);
      showToast(errorText(err));
    }
    busy = false;
    if (sheet.isConnected) draw();
  });
}

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
