/* ═══════════════════════════════════════════════════════════
   Écrans des perfs entre potes :
   - page d'un pote : demander à voir ses perfs, le laisser voir les miennes ;
   - programme en commun : les perfs du groupe exercice par exercice ;
   - défis sur un exercice : lancer, inviter, classement.
   Données : js/perfs.js ; sécurité : firestore.rules.
   ═══════════════════════════════════════════════════════════ */
import { showToast } from "./utils.js?v=20261104g";
import { i18n } from "./i18n.js?v=20261104g";
import { Social } from "./social.js?v=20261104g";
import { Perfs, perfsOf, challengeResult, challengeRanking } from "./perfs.js?v=20261104g";
import { esc, openSheet, sheetHead, confirmSheet, personAvatar, nameOf, MASCOT, Bridge } from "./potes-ui.js?v=20261104g";

const DAY = 86400000;
const TEXT = {
  fr: {
    section: "Perfs (charges et répétitions)",
    see: "Voir ses perfs",
    ask: "Demander à voir ses perfs",
    asked: "Demande envoyée",
    cancel: "Annuler",
    askedToast: "Demande envoyée à {name}.",
    askedMe: "{name} demande à voir tes perfs.",
    accept: "Accepter",
    refuse: "Refuser",
    letSee: "Laisser {name} voir mes perfs",
    letSeeHint: "Ta meilleure série et ta dernière série sur chaque exercice. Tu peux retirer l'accès quand tu veux.",
    granted: "{name} peut voir tes perfs.",
    revoked: "{name} ne voit plus tes perfs.",
    refused: "Demande refusée.",
    theirTitle: "Perfs de {name}",
    best: "Meilleure série",
    last: "Dernière fois",
    times: "{n} séance",
    timesMany: "{n} séances",
    search: "Chercher un exercice",
    empty: "Aucune perf pour l'instant.",
    unavailable: "Ces perfs ne sont plus visibles.",
    stopViewing: "Ne plus voir ses perfs",
    reps: "{n} rép.",
    // programme
    progBtn: "Perfs du groupe",
    progTitle: "Perfs du groupe",
    progWhat: "Montre tes perfs sur les exercices de ce programme pour voir celles des autres membres. Seuls les membres qui montrent les leurs les voient.",
    progShow: "Montrer mes perfs",
    progHide: "Ne plus montrer mes perfs",
    progShown: "Tes perfs sont visibles dans ce programme.",
    progHidden: "Tes perfs ne sont plus visibles dans ce programme.",
    progNone: "Personne n'a encore de perf sur cet exercice.",
    progNobody: "Aucun membre ne montre encore ses perfs.",
    you: "Toi",
    // défis
    chTitle: "Défis",
    chHand: "Un exercice, tes potes, la meilleure série gagne.",
    chCreate: "Lancer un défi",
    chEmpty: "Aucun défi pour l'instant.",
    chInvitedBy: "{name} te lance un défi : {exercise}",
    chJoin: "Relever le défi",
    chJoined: "Défi relevé !",
    chDeclined: "Défi refusé.",
    chPickTitle: "Lancer un défi",
    chPickHelp: "Choisis l'exercice du défi.",
    chYours: "Tes exercices",
    chAll: "Tous les exercices",
    chMetric: "Ce qui compte",
    chWeight: "Charge max",
    chReps: "Répétitions max",
    chDays: "Durée",
    chDaysN: "{n} jours",
    chOpenEnded: "Sans fin",
    chStart: "Lancer le défi",
    chStarted: "Défi lancé : invite tes potes.",
    chUntil: "Jusqu'au {date}",
    chEnded: "Terminé le {date}",
    chForever: "Sans date de fin",
    chSince: "Les séries comptent depuis le {date}",
    chNoResult: "pas encore de série",
    chInvite: "Inviter des potes",
    chInviteTitle: "Inviter au défi",
    chInviteBtn: "Inviter",
    chInvited: "invité",
    chInside: "dans le défi",
    chInvitedToast: "{name} est invité.",
    chNoFriends: "Ajoute d'abord des potes pour les défier.",
    chLeave: "Quitter le défi",
    chDelete: "Supprimer le défi",
    chLeaveTitle: "Quitter le défi ?",
    chLeaveText: "Ton résultat sera retiré du classement.",
    chDeleteTitle: "Supprimer le défi ?",
    chDeleteText: "Le défi disparaît pour tout le monde.",
    chLeft: "Tu as quitté le défi.",
    chDeleted: "Défi supprimé.",
    chGone: "Ce défi n'existe plus.",
    chDone: "Terminé",
    chPeople: "{n} participant",
    chPeopleMany: "{n} participants",
    loading: "Chargement…",
    error: "Ça n'a pas marché : vérifie ta connexion."
  },
  en: {
    section: "Performance (weights and reps)",
    see: "See their performance",
    ask: "Ask to see their performance",
    asked: "Request sent",
    cancel: "Cancel",
    askedToast: "Request sent to {name}.",
    askedMe: "{name} wants to see your performance.",
    accept: "Accept",
    refuse: "Decline",
    letSee: "Let {name} see my performance",
    letSeeHint: "Your best set and your last set on each exercise. You can remove access anytime.",
    granted: "{name} can see your performance.",
    revoked: "{name} can no longer see your performance.",
    refused: "Request declined.",
    theirTitle: "{name}'s performance",
    best: "Best set",
    last: "Last time",
    times: "{n} workout",
    timesMany: "{n} workouts",
    search: "Search an exercise",
    empty: "No performance yet.",
    unavailable: "This performance is no longer visible.",
    stopViewing: "Stop seeing their performance",
    reps: "{n} reps",
    progBtn: "Group performance",
    progTitle: "Group performance",
    progWhat: "Show your performance on this program's exercises to see the other members'. Only members who show theirs can see them.",
    progShow: "Show my performance",
    progHide: "Stop showing my performance",
    progShown: "Your performance is visible in this program.",
    progHidden: "Your performance is no longer visible in this program.",
    progNone: "Nobody has a set on this exercise yet.",
    progNobody: "No member shows their performance yet.",
    you: "You",
    chTitle: "Challenges",
    chHand: "One exercise, your friends, the best set wins.",
    chCreate: "Start a challenge",
    chEmpty: "No challenge yet.",
    chInvitedBy: "{name} challenges you: {exercise}",
    chJoin: "Accept the challenge",
    chJoined: "Challenge accepted!",
    chDeclined: "Challenge declined.",
    chPickTitle: "Start a challenge",
    chPickHelp: "Choose the challenge exercise.",
    chYours: "Your exercises",
    chAll: "All exercises",
    chMetric: "What counts",
    chWeight: "Max weight",
    chReps: "Max reps",
    chDays: "Duration",
    chDaysN: "{n} days",
    chOpenEnded: "No end",
    chStart: "Start the challenge",
    chStarted: "Challenge started: invite your friends.",
    chUntil: "Until {date}",
    chEnded: "Ended on {date}",
    chForever: "No end date",
    chSince: "Sets count from {date}.",
    chNoResult: "no set yet",
    chInvite: "Invite friends",
    chInviteTitle: "Invite to the challenge",
    chInviteBtn: "Invite",
    chInvited: "invited",
    chInside: "in the challenge",
    chInvitedToast: "{name} is invited.",
    chNoFriends: "Add friends first to challenge them.",
    chLeave: "Leave the challenge",
    chDelete: "Delete the challenge",
    chLeaveTitle: "Leave the challenge?",
    chLeaveText: "Your result will be removed from the ranking.",
    chDeleteTitle: "Delete the challenge?",
    chDeleteText: "The challenge disappears for everyone.",
    chLeft: "You left the challenge.",
    chDeleted: "Challenge deleted.",
    chGone: "This challenge no longer exists.",
    chDone: "Ended",
    chPeople: "{n} participant",
    chPeopleMany: "{n} participants",
    loading: "Loading…",
    error: "That didn't work: check your connection."
  }
};
const lang = () => (i18n.getLanguage() === "en" ? "en" : "fr");
export const pt = (key, vars = {}) => String(TEXT[lang()][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const num = n => Number(n).toLocaleString(i18n.getLocale(), { maximumFractionDigits: 1 });
const dateOf = ts => new Date(ts).toLocaleDateString(i18n.getLocale(), { day: "numeric", month: "short" });
const setText = (kgValue, reps) => (kgValue > 0 ? `${num(kgValue)} kg × ${reps}` : pt("reps", { n: reps }));
const emptyCard = text => `<div class="card pt-card pt-empty"><img class="pt-mascot pt-mascot-sm" src="${MASCOT}" alt="" width="70" height="184"><p class="pt-text">${esc(text)}</p></div>`;
const errorToast = () => showToast(pt("error"));

/** Mes perfs (calculées depuis mes séances) */
const myPerfs = ids => perfsOf(Bridge.getLogs?.() || [], { ids, nameOf: id => Bridge.nameOf?.(id) || id });
/** Publie mes perfs pour les potes autorisés (force : même si personne encore, ex. juste avant d'accorder) */
export const publishMyPerfs = (force = false) => Perfs.publishMine(myPerfs(null), force);

/* ─── 1. Page d'un pote ────────────────────────────────── */
/** Signature de l'état des perfs avec ce pote (pour redessiner sa page) */
export const friendPerfsSignature = uid => [Perfs.canSee(uid), Perfs.asked(uid), Perfs.askedMe(uid), Perfs.sees(uid)].join("");

export function friendPerfsHtml(uid) {
  const name = nameOf(Social.profileOf(uid));
  const theirs = Perfs.canSee(uid)
    ? `<button type="button" class="btn btn-ghost btn-sm" data-pp-see="${esc(uid)}">${esc(pt("see"))}</button>`
    : Perfs.asked(uid)
      ? `<span class="pq-tag">${esc(pt("asked"))}</span> <button type="button" class="hero-other" data-pp-unask="${esc(uid)}">${esc(pt("cancel"))}</button>`
      : `<button type="button" class="btn btn-surface btn-sm" data-pp-ask="${esc(uid)}">${esc(pt("ask"))}</button>`;
  const request = Perfs.askedMe(uid) ? `
    <div class="pp-request">
      <p class="pt-text">${esc(pt("askedMe", { name }))}</p>
      <div class="gr-actions">
        <button type="button" class="btn btn-primary btn-sm" data-pp-accept="${esc(uid)}">${esc(pt("accept"))}</button>
        <button type="button" class="btn btn-surface btn-sm" data-pp-refuse="${esc(uid)}">${esc(pt("refuse"))}</button>
      </div>
    </div>` : "";
  return `
    <section class="pf-card pf-perfs">
      <h3 class="pf-title">${esc(pt("section"))}</h3>
      <div class="pp-theirs">${theirs}</div>
      ${request}
      <div class="ps-row">
        <label class="ps-label" for="pp-let-${esc(uid)}"><span class="ps-name">${esc(pt("letSee", { name }))}</span><span class="ps-hint">${esc(pt("letSeeHint"))}</span></label>
        <input type="checkbox" role="switch" class="ps-switch" id="pp-let-${esc(uid)}" data-pp-let="${esc(uid)}"${Perfs.sees(uid) ? " checked" : ""}>
      </div>
    </section>`;
}

/** Boutons de la section ; renvoie vrai si le clic est traité ici */
export function handleFriendPerfsClick(event) {
  const el = s => event.target.closest(s);
  const see = el("[data-pp-see]");
  if (see) { openFriendPerfs(see.dataset.ppSee); return true; }
  const act = el("[data-pp-ask], [data-pp-unask], [data-pp-accept], [data-pp-refuse]");
  if (!act) return false;
  const uid = act.dataset.ppAsk || act.dataset.ppUnask || act.dataset.ppAccept || act.dataset.ppRefuse;
  const name = nameOf(Social.profileOf(uid));
  act.disabled = true;
  (async () => {
    try {
      if (act.matches("[data-pp-ask]")) { await Perfs.request(uid); showToast(pt("askedToast", { name })); }
      else if (act.matches("[data-pp-unask]")) await Perfs.cancelRequest(uid);
      else if (act.matches("[data-pp-accept]")) { await Perfs.grant(uid, publishMyPerfs); showToast(pt("granted", { name })); }
      else { await Perfs.refuse(uid); showToast(pt("refused")); }
    } catch (err) { console.error("[TrackLift] perfs :", err); act.disabled = false; errorToast(); }
  })();
  return true;
}

/** Interrupteur « laisser voir mes perfs » */
export function handleFriendPerfsChange(event) {
  const input = event.target.closest("[data-pp-let]");
  if (!input) return false;
  const uid = input.dataset.ppLet;
  const name = nameOf(Social.profileOf(uid));
  input.disabled = true;
  (async () => {
    try {
      if (input.checked) { await Perfs.grant(uid, publishMyPerfs); showToast(pt("granted", { name })); }
      else { await Perfs.revoke(uid); showToast(pt("revoked", { name })); }
    } catch (err) { console.error("[TrackLift] perfs :", err); input.checked = !input.checked; errorToast(); }
    input.disabled = false;
  })();
  return true;
}

/** Accepter / refuser depuis les notifications */
export async function acceptPerfRequest(uid) {
  try { await Perfs.grant(uid, publishMyPerfs); showToast(pt("granted", { name: nameOf(Social.profileOf(uid)) })); }
  catch (err) { console.error("[TrackLift] perfs :", err); errorToast(); }
}
export async function refusePerfRequest(uid) {
  try { await Perfs.refuse(uid); showToast(pt("refused")); } catch { errorToast(); }
}

/** Liste de perfs (exercice, meilleure série, dernière fois) */
function perfRowsHtml(list, filter = "") {
  const q = filter.trim().toLowerCase();
  const rows = Object.entries(list || {})
    .filter(([, p]) => !q || String(p.n || "").toLowerCase().includes(q))
    .sort((a, b) => (b[1].c || 0) - (a[1].c || 0))
    .map(([, p]) => `
      <li class="pp-row">
        <span class="pp-name"><b>${esc(p.n || "")}</b><small>${esc(pt((p.c || 0) > 1 ? "timesMany" : "times", { n: p.c || 0 }))}</small></span>
        <span class="pp-cell"><small>${esc(pt("best"))}</small><b>${esc(setText(p.kg, p.r))}</b><small>${esc(dateOf(p.t))}</small></span>
        <span class="pp-cell"><small>${esc(pt("last"))}</small><b>${esc(setText(p.lkg, p.lr))}</b><small>${esc(dateOf(p.lt))}</small></span>
      </li>`).join("");
  return rows ? `<ul class="pp-list">${rows}</ul>` : `<p class="pt-text">${esc(pt("empty"))}</p>`;
}

export async function openFriendPerfs(uid) {
  const name = nameOf(Social.profileOf(uid));
  const { sheet, close } = openSheet();
  sheet.innerHTML = `<div class="tl-sheet-inner">${sheetHead(pt("theirTitle", { name }))}<p class="pt-loading" role="status">${esc(pt("loading"))}</p></div>`;
  sheet.querySelector("#tl-sheet-title").focus();
  let data = null;
  try { data = await Perfs.read(uid); } catch { data = null; }
  if (!sheet.isConnected) return;
  const list = data?.list || null;
  const many = Object.keys(list || {}).length > 10;
  sheet.innerHTML = `
    <div class="tl-sheet-inner">
      ${sheetHead(pt("theirTitle", { name }))}
      <div class="pf-head">${personAvatar(Social.profileOf(uid), 64)}</div>
      ${list ? `${many ? `<input class="input pp-search" type="search" placeholder="${esc(pt("search"))}" aria-label="${esc(pt("search"))}" data-pp-search>` : ""}
        <div data-pp-rows>${perfRowsHtml(list)}</div>` : emptyCard(pt("unavailable"))}
      <button type="button" class="hero-other pp-stop" data-pp-stop>${esc(pt("stopViewing"))}</button>
    </div>`;
  sheet.querySelector("#tl-sheet-title").focus();
  sheet.addEventListener("input", event => {
    if (event.target.matches("[data-pp-search]")) sheet.querySelector("[data-pp-rows]").innerHTML = perfRowsHtml(list, event.target.value);
  });
  sheet.addEventListener("click", async event => {
    if (!event.target.closest("[data-pp-stop]")) return;
    try { await Perfs.stopViewing(uid); close(); } catch { errorToast(); }
  });
}

/* ─── 2. Perfs du groupe dans un programme en commun ──── */
/** exerciseIds : exercices du programme ; ma liste ne garde que ceux-là */
export async function openProgramPerfs(programId, programName, exerciseIds) {
  const { sheet } = openSheet();
  let selected = null;
  let members = null;
  let busy = false;
  const ids = [...new Set(exerciseIds || [])];

  const load = async () => {
    if (!Perfs.showing(programId)) { members = null; return; }
    try { members = await Perfs.programPerfs(programId); } catch { members = []; }
    await Social._fetchProfiles(members.map(m => m.uid));
  };

  const draw = () => {
    if (!Perfs.showing(programId)) {
      sheet.innerHTML = `
        <div class="tl-sheet-inner">
          ${sheetHead(pt("progTitle"), programName)}
          <div class="card pt-card"><p class="pt-text">${esc(pt("progWhat"))}</p>
            <button type="button" class="btn btn-primary btn-sm" data-pp-prog-on>${esc(pt("progShow"))}</button></div>
        </div>`;
      return;
    }
    const withData = ids.filter(id => (members || []).some(m => m.list?.[id]));
    if (!selected || !withData.includes(selected)) selected = withData[0] || null;
    const chips = withData.map(id => {
      const label = (members || []).map(m => m.list?.[id]?.n).find(Boolean) || Bridge.nameOf?.(id) || id;
      return `<button type="button" class="pb-tab" role="radio" aria-checked="${id === selected}" data-pp-ex="${esc(id)}">${esc(label)}</button>`;
    }).join("");
    const rows = selected ? (members || [])
      .filter(m => m.list?.[selected])
      .map(m => ({ m, p: m.list[selected] }))
      .sort((a, b) => b.p.kg - a.p.kg || b.p.r - a.p.r)
      .map(({ m, p }, i) => {
        const me = m.uid === Social.uid;
        const profile = me ? Social.profile : Social.profileOf(m.uid);
        return `<li class="pb-row${me ? " is-me" : ""}">
          <span class="pb-rank">${i + 1}</span>
          ${personAvatar(profile, 36)}
          <span class="pb-row-name">${esc(me ? pt("you") : nameOf(profile))}<small class="pp-sub">${esc(pt("last"))} : ${esc(setText(p.lkg, p.lr))} · ${esc(dateOf(p.lt))}</small></span>
          <span class="pb-row-value"><b>${esc(setText(p.kg, p.r))}</b></span>
        </li>`;
      }).join("") : "";
    sheet.innerHTML = `
      <div class="tl-sheet-inner">
        ${sheetHead(pt("progTitle"), programName)}
        ${withData.length ? `<div class="pb-tabs pp-chips" role="radiogroup">${chips}</div>
          <ol class="pb-list">${rows}</ol>` : emptyCard(pt("progNobody"))}
        <button type="button" class="hero-other pp-stop" data-pp-prog-off>${esc(pt("progHide"))}</button>
      </div>`;
  };

  sheet.innerHTML = `<div class="tl-sheet-inner">${sheetHead(pt("progTitle"), programName)}<p class="pt-loading" role="status">${esc(pt("loading"))}</p></div>`;
  sheet.querySelector("#tl-sheet-title").focus();
  await load();
  if (!sheet.isConnected) return;
  draw();
  sheet.querySelector("#tl-sheet-title")?.focus();

  sheet.addEventListener("click", async event => {
    const chip = event.target.closest("[data-pp-ex]");
    if (chip) { selected = chip.dataset.ppEx; draw(); sheet.querySelector(`[data-pp-ex="${CSS.escape(selected)}"]`)?.focus(); return; }
    const on = event.target.closest("[data-pp-prog-on]");
    const off = event.target.closest("[data-pp-prog-off]");
    if ((!on && !off) || busy) return;
    busy = true;
    try {
      await Perfs.setProgram(programId, !!on, on ? myPerfs(ids) : null);
      showToast(pt(on ? "progShown" : "progHidden"));
      await load();
      if (sheet.isConnected) draw();
    } catch (err) { console.error("[TrackLift] perfs du programme :", err); errorToast(); }
    busy = false;
  });
}

/* ─── 3. Défis ─────────────────────────────────────────── */
const resultFor = challenge => challengeResult(Bridge.getLogs?.() || [], challenge);
const periodText = c => (c.endsAt ? (c.endsAt < Date.now() ? pt("chEnded", { date: dateOf(c.endsAt) }) : pt("chUntil", { date: dateOf(c.endsAt) })) : pt("chForever"));

/** Section « Défis » de l'onglet Programmes de la page Potes */
export function challengesPanelHtml() {
  const invites = Social.challengeInvitesIn.map(inv => {
    const name = nameOf(Social.profileOf(inv.from));
    return `
      <li class="card pt-card gr-invite">
        <div class="gr-invite-head">${personAvatar(Social.profileOf(inv.from), 40)}<p class="pt-text">${esc(pt("chInvitedBy", { name, exercise: inv.name }))}</p></div>
        <div class="gr-actions">
          <button type="button" class="btn btn-primary btn-sm" data-ch-accept="${esc(inv.id)}" data-k="cha-${esc(inv.id)}">${esc(pt("chJoin"))}</button>
          <button type="button" class="btn btn-surface btn-sm" data-ch-decline="${esc(inv.id)}" data-k="chd-${esc(inv.id)}">${esc(pt("refuse"))}</button>
        </div>
      </li>`;
  }).join("");
  const mine = Object.entries(Perfs.challenges).sort((a, b) => (b[1].startsAt || 0) - (a[1].startsAt || 0)).map(([id, c]) => `
    <li><button type="button" class="card gr-row" data-ch-open="${esc(id)}" data-k="cho-${esc(id)}">
      <span class="gr-row-text"><b>${esc(c.name)}</b><small>${esc(pt(c.metric === "reps" ? "chReps" : "chWeight"))} · ${esc(periodText(c))}</small></span>
      <svg class="gr-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button></li>`).join("");
  return `
    <h2 class="section-title pt-section">${esc(pt("chTitle"))}</h2>
    <p class="gr-fine">${esc(pt("chHand"))}</p>
    ${invites ? `<ul class="gr-invites">${invites}</ul>` : ""}
    ${mine ? `<ul class="gr-list">${mine}</ul>` : ""}
    <button type="button" class="btn btn-surface btn-block gr-create" data-ch-create data-k="ch-create">${esc(pt("chCreate"))}</button>`;
}

/** Clics de la section ; renvoie vrai si traité */
export function handleChallengesClick(event) {
  const el = s => event.target.closest(s);
  const accept = el("[data-ch-accept]");
  if (accept) { accept.disabled = true; acceptChallengeInvite(accept.dataset.chAccept); return true; }
  const decline = el("[data-ch-decline]");
  if (decline) { decline.disabled = true; declineChallengeInvite(decline.dataset.chDecline); return true; }
  const open = el("[data-ch-open]");
  if (open) { openChallenge(open.dataset.chOpen); return true; }
  if (el("[data-ch-create]")) { openCreateChallenge(); return true; }
  return false;
}

export async function acceptChallengeInvite(inviteId) {
  const invite = Social.challengeInvitesIn.find(i => i.id === inviteId);
  if (!invite) return;
  try { const challenge = await Perfs.accept(invite, resultFor); showToast(pt("chJoined")); openChallenge(challenge.id); }
  catch (err) { console.error("[TrackLift] défi :", err); showToast(err?.code === "gone" ? pt("chGone") : pt("error")); }
}
export async function declineChallengeInvite(inviteId) {
  const invite = Social.challengeInvitesIn.find(i => i.id === inviteId);
  if (!invite) return;
  try { await Perfs.decline(invite); showToast(pt("chDeclined")); } catch { errorToast(); }
}

/** Créer un défi : exercice, ce qui compte, durée */
export function openCreateChallenge() {
  const { sheet } = openSheet();
  const mineList = perfsOf(Bridge.getLogs?.() || [], { nameOf: id => Bridge.nameOf?.(id) || id, limit: 12 });
  const all = Bridge.allExercises?.() || [];
  let query = "";
  let picked = null; // { id, name, bodyweight }
  let metric = "weight";
  let days = 30;
  let busy = false;

  const exerciseRow = ex => `<li><button type="button" class="pp-pick${picked?.id === ex.id ? " is-on" : ""}" data-ch-ex="${esc(ex.id)}" aria-pressed="${picked?.id === ex.id}">${esc(ex.name)}</button></li>`;
  const draw = () => {
    const q = query.trim().toLowerCase();
    const yours = Object.entries(mineList).map(([id, p]) => ({ id, name: p.n, bodyweight: !(p.kg > 0) }));
    const results = q ? all.filter(ex => ex.name.toLowerCase().includes(q)).slice(0, 30) : [];
    const options = picked ? `
      <h3 class="bl-label">${esc(pt("chMetric"))}</h3>
      <div class="pb-tabs" role="radiogroup">
        ${["weight", "reps"].map(m => `<button type="button" class="pb-tab" role="radio" aria-checked="${metric === m}" data-ch-metric="${m}">${esc(pt(m === "reps" ? "chReps" : "chWeight"))}</button>`).join("")}
      </div>
      <h3 class="bl-label">${esc(pt("chDays"))}</h3>
      <div class="pb-tabs" role="radiogroup">
        ${[7, 14, 30, 0].map(d => `<button type="button" class="pb-tab" role="radio" aria-checked="${days === d}" data-ch-days="${d}">${esc(d ? pt("chDaysN", { n: d }) : pt("chOpenEnded"))}</button>`).join("")}
      </div>` : "";
    sheet.innerHTML = `
      <div class="tl-sheet-inner">
        ${sheetHead(pt("chPickTitle"))}
        <p class="bl-text">${esc(pt("chPickHelp"))}</p>
        <input class="input pp-search" type="search" placeholder="${esc(pt("search"))}" aria-label="${esc(pt("search"))}" value="${esc(query)}" data-ch-search>
        ${q ? `<h3 class="bl-label">${esc(pt("chAll"))}</h3><ul class="pp-picks">${results.map(exerciseRow).join("") || `<li class="pt-text">${esc(pt("empty"))}</li>`}</ul>`
          : yours.length ? `<h3 class="bl-label">${esc(pt("chYours"))}</h3><ul class="pp-picks">${yours.map(exerciseRow).join("")}</ul>` : ""}
        ${picked ? `<p class="pp-picked"><b>${esc(picked.name)}</b></p>` : ""}
        ${options}
      </div>
      <div class="tl-dock"><button type="button" class="btn btn-primary btn-block" data-ch-go${picked ? "" : " disabled"}>${esc(pt("chStart"))}</button></div>`;
  };
  draw();
  sheet.querySelector("#tl-sheet-title")?.focus();

  sheet.addEventListener("input", event => {
    if (!event.target.matches("[data-ch-search]")) return;
    query = event.target.value;
    const pos = event.target.selectionStart;
    draw();
    const input = sheet.querySelector("[data-ch-search]");
    input.focus();
    input.setSelectionRange(pos, pos);
  });
  sheet.addEventListener("click", async event => {
    const ex = event.target.closest("[data-ch-ex]");
    if (ex) {
      const id = ex.dataset.chEx;
      const fromMine = mineList[id];
      const fromAll = all.find(e => e.id === id);
      picked = { id, name: fromMine?.n || fromAll?.name || id, bodyweight: fromMine ? !(fromMine.kg > 0) : !!fromAll?.bodyweight };
      metric = picked.bodyweight ? "reps" : "weight";
      draw();
      sheet.querySelector("[data-ch-go]")?.scrollIntoView({ block: "nearest" });
      return;
    }
    const m = event.target.closest("[data-ch-metric]");
    if (m) { metric = m.dataset.chMetric; draw(); return; }
    const d = event.target.closest("[data-ch-days]");
    if (d) { days = Number(d.dataset.chDays); draw(); return; }
    if (!event.target.closest("[data-ch-go]") || !picked || busy) return;
    busy = true;
    try {
      const challenge = await Perfs.createChallenge({ exerciseId: picked.id, name: picked.name, metric, days }, resultFor);
      showToast(pt("chStarted"));
      openChallengeInvites(challenge.id, challenge.name);
    } catch (err) { console.error("[TrackLift] défi :", err); errorToast(); busy = false; }
  });
}

/** Un défi : classement et actions */
export async function openChallenge(id) {
  const { sheet, close } = openSheet();
  sheet.innerHTML = `<div class="tl-sheet-inner">${sheetHead(pt("chTitle"))}<p class="pt-loading" role="status">${esc(pt("loading"))}</p></div>`;
  sheet.querySelector("#tl-sheet-title").focus();
  // mon résultat à jour d'abord
  await Perfs.pushChallenges(resultFor).catch(() => {});
  const [challenge, members] = await Promise.all([Perfs.getChallenge(id), Perfs.challengeMembers(id)]);
  if (!sheet.isConnected) return;
  if (!challenge) {
    if (Perfs.challenges[id]) Perfs.forget(id).catch(() => {});
    sheet.innerHTML = `<div class="tl-sheet-inner">${sheetHead(pt("chTitle"))}${emptyCard(pt("chGone"))}</div>`;
    return;
  }
  await Social._fetchProfiles((members || []).map(m => m.uid));
  if (!sheet.isConnected) return;
  const ranked = challengeRanking(members || [], challenge.metric);
  const waiting = (members || []).filter(m => !Number.isFinite(m.value));
  const valueText = m => (challenge.metric === "reps" ? `${pt("reps", { n: m.r })}${m.kg > 0 ? ` · ${num(m.kg)} kg` : ""}` : setText(m.kg, m.r));
  const row = (m, place) => {
    const me = m.uid === Social.uid;
    const profile = me ? Social.profile : Social.profileOf(m.uid);
    return `<li class="pb-row${me ? " is-me" : ""}">
      <span class="pb-rank">${place ?? "–"}</span>
      ${personAvatar(profile, 36)}
      <span class="pb-row-name">${esc(me ? pt("you") : nameOf(profile))}${m.t ? `<small class="pp-sub">${esc(dateOf(m.t))}</small>` : ""}</span>
      <span class="pb-row-value">${place ? `<b>${esc(valueText(m))}</b>` : `<small>${esc(pt("chNoResult"))}</small>`}</span>
    </li>`;
  };
  const mine = challenge.owner === Social.uid;
  const count = (members || []).length;
  sheet.innerHTML = `
    <div class="tl-sheet-inner">
      ${sheetHead(challenge.name, pt("chTitle"))}
      <p class="bl-muted">${esc(pt(challenge.metric === "reps" ? "chReps" : "chWeight"))} · ${esc(periodText(challenge))} · ${esc(pt(count > 1 ? "chPeopleMany" : "chPeople", { n: count }))}</p>
      <p class="bl-muted">${esc(pt("chSince", { date: dateOf(challenge.startsAt) }))}</p>
      <ol class="pb-list">${ranked.map(m => row(m, m.place)).join("")}${waiting.map(m => row(m, null)).join("")}</ol>
      <div class="gr-leave"><button type="button" class="text-danger-btn" data-ch-leave>${esc(pt(mine ? "chDelete" : "chLeave"))}</button></div>
    </div>
    <div class="tl-dock"><button type="button" class="btn btn-primary btn-block" data-ch-invite>${esc(pt("chInvite"))}</button></div>`;
  sheet.querySelector("#tl-sheet-title").focus();
  sheet.addEventListener("click", async event => {
    if (event.target.closest("[data-ch-invite]")) { openChallengeInvites(id, challenge.name); return; }
    if (!event.target.closest("[data-ch-leave]")) return;
    const ok = await confirmSheet({ title: pt(mine ? "chDeleteTitle" : "chLeaveTitle"), text: pt(mine ? "chDeleteText" : "chLeaveText"), confirmLabel: pt(mine ? "chDelete" : "chLeave") });
    if (!ok) { openChallenge(id); return; }
    try { await Perfs.leave(challenge); showToast(pt(mine ? "chDeleted" : "chLeft")); Bridge.goPotes?.("programs"); }
    catch (err) { console.error("[TrackLift] défi :", err); errorToast(); }
  });
  void close;
}

/** Inviter ses potes à un défi */
export async function openChallengeInvites(id, name) {
  let off = null;
  const { sheet } = openSheet({ onClose: () => off?.() });
  const members = new Set(((await Perfs.challengeMembers(id)) || []).map(m => m.uid));
  if (!sheet.isConnected) return;
  let first = true;
  const draw = () => {
    const friends = [...Social.friends.values()].sort((a, b) => nameOf(a.profile).localeCompare(nameOf(b.profile)));
    const rows = friends.map(f => {
      const fname = nameOf(f.profile);
      let action;
      if (members.has(f.uid)) action = `<span class="pq-tag">${esc(pt("chInside"))}</span>`;
      else if (Perfs.isInvited(id, f.uid)) action = `<span class="pq-tag">${esc(pt("chInvited"))}</span><button type="button" class="hero-other gr-undo" data-ch-uninvite="${esc(f.uid)}">${esc(pt("cancel"))}</button>`;
      else action = `<button type="button" class="btn btn-ghost btn-sm" data-ch-invite-friend="${esc(f.uid)}" aria-label="${esc(`${pt("chInviteBtn")} ${fname}`)}">${esc(pt("chInviteBtn"))}</button>`;
      return `<li class="pq-row">${personAvatar(f.profile, 40)}<span class="pq-name">${esc(fname)}</span><span class="pq-actions">${action}</span></li>`;
    }).join("");
    sheet.innerHTML = `
      <div class="tl-sheet-inner">
        ${sheetHead(pt("chInviteTitle"), name)}
        ${rows ? `<ul class="pq-list card gr-picker">${rows}</ul>` : emptyCard(pt("chNoFriends"))}
      </div>
      <div class="tl-dock"><button type="button" class="btn btn-primary btn-block" data-ch-done>${esc(pt("chTitle"))} : ${esc(name)}</button></div>`;
    if (first) { sheet.querySelector("#tl-sheet-title").focus(); first = false; }
  };
  draw();
  off = Social.onChange(draw);
  sheet.addEventListener("click", async event => {
    if (event.target.closest("[data-ch-done]")) { openChallenge(id); return; }
    const invite = event.target.closest("[data-ch-invite-friend]");
    const undo = event.target.closest("[data-ch-uninvite]");
    if (!invite && !undo) return;
    const uid = invite?.dataset.chInviteFriend || undo.dataset.chUninvite;
    (invite || undo).disabled = true;
    try {
      if (invite) { await Perfs.invite(id, name, uid); showToast(pt("chInvitedToast", { name: nameOf(Social.profileOf(uid)) })); }
      else await Perfs.cancelInvite(id, uid);
    } catch (err) { console.error("[TrackLift] invitation au défi :", err); (invite || undo).disabled = false; errorToast(); }
  });
}

/** Après une séance : mes perfs, mes perfs de programme et mes résultats de défis à jour */
export function pushAllPerfs(programExercises) {
  if (!Social.joined) return;
  publishMyPerfs().catch(err => console.warn("[TrackLift] perfs :", err?.code || err));
  Perfs.pushPrograms(programId => { const ids = programExercises(programId); return ids ? myPerfs(ids) : null; }).catch(() => {});
  Perfs.pushChallenges(resultFor).catch(() => {});
}
export { DAY as PERF_DAY };
