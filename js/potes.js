/* ═══════════════════════════════════════════════════════════
   Partie Potes : la page.
   - pas encore rejoint : présentation + parcours (pseudo → avatar → ce que tes potes voient)
   - rejoint : ton profil public, onglets « Potes » (ajouter, demandes, liste, blocages),
     « Classement » et « Programmes » (programmes en commun, invitations), réglages, quitter.
   ═══════════════════════════════════════════════════════════ */
import { showToast } from "./utils.js?v=20261030a";
import { Social, checkUsername } from "./social.js?v=20261030a";
import { SharedPrograms, Community } from "./community.js?v=20261030a";
import { streakAlive, weekKey } from "./social-stats.js?v=20261030a";
import { avatarSvg, mountAvatarEditor, openAvatarEditor, randomAvatar } from "./avatar.js?v=20261030a";
import { t, tn, esc, openSheet, sheetHead, confirmSheet, personAvatar, nameOf, MASCOT, reducedMotion, shareLink, Bridge } from "./potes-ui.js?v=20261030a";
import { openFriendPage, openMyProfileAsFriend } from "./potes-friend.js?v=20261030a";
import { openSettings } from "./potes-settings.js?v=20261030a";
import { boardHtml, celebrateRank, joinBoard, CRITERIA } from "./potes-board.js?v=20261030a";
import { groupsPanelHtml, handleGroupsClick } from "./potes-programs.js?v=20261030a";

const TABS = ["friends", "board", "programs"];

let root = null;
let unsubscribe = null;
let lastHtml = "";
const view = { tab: "friends", crit: "sessions", query: "", search: null, invite: null };

export function mountPotes(container) {
  root = container;
  unsubscribe?.();
  unsubscribe = Social.onChange(render);
  if (!Social.loaded && !Social.loading && Social.uid) Social.load(Social.uid);
  lastHtml = "";
  render();
}

export function unmountPotes() {
  unsubscribe?.();
  unsubscribe = null;
  root = null;
}

/** Déconnexion : on oublie la recherche et l'invitation (le téléphone peut changer de main) */
export function resetPotesView() {
  Object.assign(view, { tab: "friends", crit: "sessions", query: "", search: null, invite: null });
  lastHtml = "";
}

/** Ouvre la page sur un onglet (« programs » depuis l'onglet Programmes de l'appli) */
export function showPotesTab(tab) {
  if (TABS.includes(tab)) view.tab = tab;
  lastHtml = "";
  render();
}

/** Invitation par lien (?pote=pseudo) : à rejoindre puis à ajouter */
export function setInvite(username) {
  view.invite = username;
  view.tab = "friends";
  view.query = username;
  view.search = null;
  if (Social.joined) runSearch(username);
}

export const inviteLink = () => `${location.origin}${location.pathname}?pote=${encodeURIComponent(Social.username)}`;

/* ─── Page ─────────────────────────────────────────────── */
function render() {
  if (!root) return;
  const head = `
    <div class="page-head">
      <div class="progress-head-row">
        <div>
          <h1 class="page-title">${esc(t("potes"))}</h1>
          <p class="page-subtitle">${esc(t("potesSubtitle"))}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-view-go="home">${esc(t("backButton"))}</button>
      </div>
    </div>`;
  let body;
  if (!Social.loaded) body = `<p class="pt-loading" role="status">${esc(t("potesLoading"))}</p>`;
  else if (Social.error) body = errorHtml();
  else if (!Social.joined) body = joinHtml();
  else body = meHtml() + tabsHtml()
    + (view.tab === "board" ? `<div class="pt-panel" role="tabpanel" id="pt-panel" aria-labelledby="pt-tab-board">${boardHtml(view.crit)}</div>`
      : view.tab === "programs" ? groupsPanelHtml() : friendsPanelHtml())
    + `<button type="button" class="text-danger-btn pt-leave" data-pt-leave>${esc(t("potesLeave"))}</button>`;
  const html = head + (navigator.onLine === false && Social.joined ? `<p class="pt-offline" role="status">${esc(t("potesOfflineNote"))}</p>` : "") + body;
  if (html === lastHtml) return;
  // garde le focus et le texte en cours de saisie à travers le rafraîchissement
  const active = document.activeElement;
  const focusKey = root.contains(active) ? (active.id ? `#${active.id}` : active.dataset?.k ? `[data-k="${active.dataset.k}"]` : null) : null;
  const selection = active?.id === "pq-name" ? [active.selectionStart, active.selectionEnd] : null;
  root.innerHTML = html;
  lastHtml = html;
  if (focusKey) {
    const el = root.querySelector(focusKey);
    el?.focus({ preventScroll: true });
    if (el && selection) el.setSelectionRange(...selection);
  }
  if (Social.joined && view.tab === "board") celebrateRank(root, view.crit);
}

function errorHtml() {
  return `
    <div class="card pt-card pt-empty">
      <img class="pt-mascot pt-mascot-sm" src="${MASCOT}" alt="" width="70" height="184">
      <div>
        <h2 class="pt-card-title">${esc(t("potesErrorTitle"))}</h2>
        <p class="pt-text">${esc(t(navigator.onLine === false ? "potesOfflineText" : "potesErrorText"))}</p>
        <button type="button" class="btn btn-ghost btn-sm" data-pt-retry>${esc(t("potesRetry"))}</button>
      </div>
    </div>`;
}

function joinHtml() {
  return `
    ${view.invite ? `<p class="pt-invite">${esc(t("potesInvited", { name: view.invite }))}</p>` : ""}
    <div class="card pt-card pt-join">
      <div class="pt-join-text">
        <h2 class="pt-card-title">${esc(t("potesJoinTitle"))}</h2>
        <p class="pt-text">${esc(t("potesJoinText"))}</p>
        <ul class="pt-points">
          <li>${esc(t("potesJoinPrivate"))}</li>
          <li>${esc(t("potesJoinNever"))}</li>
        </ul>
      </div>
      <img class="pt-mascot" src="${MASCOT}" alt="" width="84" height="220">
    </div>
    <button type="button" class="btn btn-primary btn-block" data-pt-join>${esc(t("potesJoinBtn"))}</button>`;
}

function meHtml() {
  return `
    <div class="card pt-card pt-me">
      <button type="button" class="pt-me-avatar" data-pt-avatar data-k="me-avatar" aria-label="${esc(t("avatarEdit"))}">
        ${avatarSvg(Social.avatar, { size: 92 })}
        <span class="pt-edit-badge" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg></span>
      </button>
      <div class="pt-me-text">
        <p class="pt-me-label">${esc(t("potesMeLabel"))}</p>
        <p class="pt-me-name">${esc(Social.username)}</p>
        <button type="button" class="hero-other pt-link" data-pt-rename data-k="rename">${esc(t("potesRename"))}</button>
      </div>
    </div>
    <div class="pt-quick">
      <button type="button" class="btn btn-surface" data-pt-settings data-k="settings">${esc(t("psOpen"))}</button>
      <button type="button" class="btn btn-surface" data-pt-preview data-k="preview">${esc(t("psPreview"))}</button>
    </div>`;
}

function tabsHtml() {
  const tab = (key, label) => `<button type="button" role="tab" class="pt-tab" id="pt-tab-${key}" aria-controls="pt-panel" aria-selected="${view.tab === key}" tabindex="${view.tab === key ? 0 : -1}" data-pt-tab="${key}">${esc(label)}</button>`;
  const pending = Social.requestsIn.length;
  const invites = Social.invitesIn.length;
  return `<div class="pt-tabs pt-tabs-3" role="tablist" aria-label="${esc(t("potes"))}">
    ${tab("friends", pending ? `${t("ptTabFriends")} · ${pending}` : t("ptTabFriends"))}
    ${tab("board", t("ptTabBoard"))}
    ${tab("programs", invites ? `${t("ptTabPrograms")} · ${invites}` : t("ptTabPrograms"))}
  </div>`;
}

/* ─── Onglet Potes ─────────────────────────────────────── */
function friendLine(friend) {
  const items = friend.items || {};
  const bits = [];
  if (items.streak) bits.push(t("ptLineStreak", { count: streakAlive(items.streak) }));
  if (items.sessions) bits.push(tn("ptLineSessions", items.sessions.weekKey === weekKey(Date.now()) ? Number(items.sessions.count) || 0 : 0));
  if (!friend.itemsLoaded) return t("potesLoading");
  return bits.length ? bits.join(" · ") : t("ptLineNothing");
}

function searchResultHtml() {
  const s = view.search;
  if (!s) return "";
  if (s.status === "busy") return `<p class="pq-status" role="status">${esc(t("pqSearching"))}</p>`;
  if (s.status !== "found") return `<p class="pq-status is-bad" role="status">${esc(t(`pqStatus.${s.status}`))}</p>`;
  const uid = s.uid;
  const incoming = Social.requestsIn.some(r => r.from === uid);
  const outgoing = Social.requestsOut.some(r => r.to === uid);
  const action = Social.isFriend(uid) ? `<span class="pq-tag">${esc(t("pqAlready"))}</span>`
    : outgoing ? `<span class="pq-tag">${esc(t("pqPending"))}</span>`
    : `<button type="button" class="btn btn-ghost btn-sm" data-pq-send="${esc(uid)}" data-k="send">${esc(t(incoming ? "pqAcceptTheirs" : "pqSend"))}</button>`;
  return `<div class="pq-result" role="status">${personAvatar(s.profile, 44)}<span class="pq-name">${esc(nameOf(s.profile))}</span>${action}</div>`;
}

function friendsPanelHtml() {
  const friends = [...Social.friends.values()].sort((a, b) => nameOf(a.profile).localeCompare(nameOf(b.profile)));
  const requestRow = (uid, actions) => `<li class="pq-row">${personAvatar(Social.profileOf(uid), 40)}<span class="pq-name">${esc(nameOf(Social.profileOf(uid)))}</span><span class="pq-actions">${actions}</span></li>`;
  const add = `
    <section class="card pt-card pq-add" aria-labelledby="pq-add-title">
      <h2 class="pt-card-title" id="pq-add-title">${esc(t("pqAddTitle"))}</h2>
      <form class="pq-form" data-pq-form>
        <label class="label" for="pq-name">${esc(t("pqAddLabel"))}</label>
        <div class="pq-field">
          <input id="pq-name" class="input" type="text" value="${esc(view.query)}" maxlength="24" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search" placeholder="${esc(t("pqAddPlaceholder"))}">
          <button type="submit" class="btn btn-ghost btn-sm" data-k="search">${esc(t("pqAdd"))}</button>
        </div>
      </form>
      ${searchResultHtml()}
      <button type="button" class="hero-other pq-share" data-share-invite data-k="share">${esc(t("pqShareLink"))}</button>
    </section>`;
  const incoming = Social.requestsIn.length ? `
    <h2 class="section-title pt-section">${esc(t("pqIncoming"))}</h2>
    <ul class="pq-list card">${Social.requestsIn.map(r => requestRow(r.from, `
      <button type="button" class="btn btn-ghost btn-sm" data-pq-accept="${esc(r.from)}" data-k="acc-${esc(r.from)}">${esc(t("pqAccept"))}</button>
      <button type="button" class="btn btn-surface btn-sm" data-pq-refuse="${esc(r.from)}" data-k="ref-${esc(r.from)}">${esc(t("pqRefuse"))}</button>
      <button type="button" class="hero-other pq-block" data-pq-block="${esc(r.from)}" data-k="blk-${esc(r.from)}">${esc(t("pfBlock"))}</button>`)).join("")}</ul>` : "";
  const outgoing = Social.requestsOut.length ? `
    <h2 class="section-title pt-section">${esc(t("pqOutgoing"))}</h2>
    <ul class="pq-list card">${Social.requestsOut.map(r => requestRow(r.to, `
      <span class="pq-tag">${esc(t("pqPending"))}</span>
      <button type="button" class="btn btn-surface btn-sm" data-pq-cancel="${esc(r.to)}" data-k="can-${esc(r.to)}">${esc(t("pqCancel"))}</button>`)).join("")}</ul>` : "";
  const list = friends.length ? `
    <ul class="pq-friends">${friends.map(f => `
      <li><button type="button" class="pq-friend" data-pq-open="${esc(f.uid)}" data-k="open-${esc(f.uid)}">
        ${personAvatar(f.profile, 46)}
        <span class="pq-friend-text"><b>${esc(nameOf(f.profile))}</b><small>${esc(friendLine(f))}</small></span>
        <svg class="pl-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
      </button></li>`).join("")}</ul>`
    : `<div class="card pt-card pt-empty"><img class="pt-mascot pt-mascot-sm" src="${MASCOT}" alt="" width="70" height="184"><p class="pt-text">${esc(t("pqNoFriends"))}</p></div>`;
  const blocked = Social.blocks.length ? `
    <details class="pq-blocked">
      <summary>${esc(t("pqBlockedTitle", { count: Social.blocks.length }))}</summary>
      <ul class="pq-list">${Social.blocks.map(b => requestRow(b.target, `<button type="button" class="btn btn-surface btn-sm" data-pq-unblock="${esc(b.target)}" data-k="unb-${esc(b.target)}">${esc(t("pqUnblock"))}</button>`)).join("")}</ul>
    </details>` : "";
  return `<div class="pt-panel" role="tabpanel" id="pt-panel" aria-labelledby="pt-tab-friends">
    ${add}${incoming}${outgoing}
    <h2 class="section-title pt-section">${esc(t("potesFriendsTitle"))}${friends.length ? ` <small class="pt-count">${friends.length}</small>` : ""}</h2>
    ${list}${blocked}
  </div>`;
}

async function runSearch(raw) {
  const value = String(raw || "").trim();
  view.query = value;
  if (!checkUsername(value).ok) { view.search = { status: value ? "invalid" : "empty" }; render(); return; }
  if (navigator.onLine === false) { view.search = { status: "offline" }; render(); return; }
  view.search = { status: "busy" };
  render();
  try {
    const found = await Social.lookup(value);
    if (!found) view.search = { status: "none" };
    else if (found.self) view.search = { status: "self" };
    else if (Social.isBlocked(found.uid)) view.search = { status: "blocked" };
    else view.search = { status: "found", uid: found.uid, profile: found.profile };
  } catch { view.search = { status: "error" }; }
  render();
}

/* ─── Actions ──────────────────────────────────────────── */
export function bindPotes(container) {
  container.addEventListener("submit", event => {
    if (!event.target.closest("[data-pq-form]")) return;
    event.preventDefault();
    runSearch(container.querySelector("#pq-name")?.value);
  });
  container.addEventListener("input", event => {
    if (event.target.id === "pq-name") { view.query = event.target.value; if (view.search && view.search.status !== "busy") { view.search = null; render(); } }
  });
  container.addEventListener("keydown", event => {
    const tab = event.target.closest("[data-pt-tab], [data-board-crit]");
    if (!tab || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    if (tab.dataset.ptTab) {
      const i = TABS.indexOf(view.tab) + (event.key === "ArrowRight" ? 1 : -1);
      view.tab = TABS[(i + TABS.length) % TABS.length];
      render();
      root?.querySelector(`#pt-tab-${view.tab}`)?.focus();
    }
    else {
      const i = CRITERIA.indexOf(view.crit);
      view.crit = CRITERIA[(i + (event.key === "ArrowRight" ? 1 : -1) + CRITERIA.length) % CRITERIA.length];
      render();
      root?.querySelector(`[data-board-crit="${view.crit}"]`)?.focus();
    }
  });
  container.addEventListener("click", async event => {
    const el = selector => event.target.closest(selector);
    if (handleGroupsClick(event)) return;
    if (el("[data-pt-join]")) return openJoinFlow();
    if (el("[data-pt-avatar]")) return editMyAvatar();
    if (el("[data-pt-rename]")) return openRename();
    if (el("[data-pt-leave]")) return confirmLeave();
    if (el("[data-pt-retry]")) return Social.load(Social.uid);
    if (el("[data-pt-settings]")) return openSettings();
    if (el("[data-pt-preview]")) return openMyProfileAsFriend();
    if (el("[data-share-invite]")) {
      const how = await shareLink(inviteLink(), "TrackLift");
      if (how === "copied") showToast(t("potesLinkCopied"));
      return;
    }
    const tab = el("[data-pt-tab]");
    if (tab) { view.tab = tab.dataset.ptTab; return render(); }
    const crit = el("[data-board-crit]");
    if (crit) { view.crit = crit.dataset.boardCrit; return render(); }
    const boardJoin = el("[data-board-join]");
    if (boardJoin) return joinBoard(boardJoin.dataset.boardJoin);
    const open = el("[data-pq-open]");
    if (open) return openFriendPage(open.dataset.pqOpen);

    const btn = el("[data-pq-send], [data-pq-accept], [data-pq-refuse], [data-pq-cancel], [data-pq-block], [data-pq-unblock]");
    if (!btn) return;
    const uid = btn.dataset.pqSend || btn.dataset.pqAccept || btn.dataset.pqRefuse || btn.dataset.pqCancel || btn.dataset.pqBlock || btn.dataset.pqUnblock;
    const name = nameOf(Social.profileOf(uid) || view.search?.profile);
    btn.disabled = true;
    try {
      if (btn.dataset.pqSend) {
        const result = await Social.sendRequest(uid);
        showToast(t(result === "accepted" ? "pqAccepted" : result === "pending" ? "pqPending" : "pqSent", { name }));
        view.search = null; view.query = ""; view.invite = null;
      } else if (btn.dataset.pqAccept) { await Social.acceptRequest(uid); showToast(t("pqAccepted", { name })); }
      else if (btn.dataset.pqRefuse) { await Social.refuseRequest(uid); showToast(t("pqRefused")); }
      else if (btn.dataset.pqCancel) { await Social.cancelRequest(uid); showToast(t("pqCancelled")); }
      else if (btn.dataset.pqUnblock) { await Social.unblock(uid); showToast(t("pqUnblocked", { name })); }
      else if (btn.dataset.pqBlock) {
        const ok = await confirmSheet({ title: t("pfBlockTitle", { name }), text: t("pfBlockText"), confirmLabel: t("pfBlock") });
        if (ok) { await Social.block(uid); showToast(t("pfBlocked", { name })); }
      }
    } catch (err) {
      console.error("[TrackLift] potes :", err);
      showToast(t(err?.code === "offline" || navigator.onLine === false ? "potesNeedOnline" : "pqFailed"));
    }
    btn.disabled = false;
    render();
  });
  window.addEventListener("online", render);
  window.addEventListener("offline", render);
}

/* ─── Avatar ───────────────────────────────────────────── */
export function editMyAvatar() {
  openAvatarEditor({
    initial: Social.avatar,
    title: t(Social.avatar ? "avatarEdit" : "avatarCreate"),
    onSave: async avatar => {
      try {
        await Social.saveAvatar(avatar);
        showToast(t(navigator.onLine === false ? "avatarSavedOffline" : "avatarSaved"));
      } catch (err) {
        console.error("[TrackLift] avatar :", err);
        showToast(t("avatarSaveError"));
        throw err;
      }
    }
  });
}

/* ─── Choix du pseudo (rejoindre ou changer) ───────────── */
function nameFieldHtml(value) {
  return `
    <label class="label" for="pj-name">${esc(t("potesNameLabel"))}</label>
    <input id="pj-name" class="input pj-input" type="text" value="${esc(value)}" maxlength="24"
      autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="next"
      placeholder="${esc(t("potesNamePlaceholder"))}" aria-describedby="pj-name-status pj-name-rule">
    <p id="pj-name-status" class="pj-status" aria-live="polite"></p>
    <p id="pj-name-rule" class="pj-rule">${esc(t("potesNameRule"))}</p>`;
}

function wireNameField(scope, onState) {
  const input = scope.querySelector("#pj-name");
  const status = scope.querySelector("#pj-name-status");
  let timer = null;
  let token = 0;
  const show = (text, tone = "", suggestion = "") => {
    status.className = `pj-status${tone ? ` is-${tone}` : ""}`;
    status.innerHTML = esc(text) + (suggestion
      ? ` <button type="button" class="pj-suggest" data-pj-suggest="${esc(suggestion)}">${esc(t("potesNameTry", { name: suggestion }))}</button>`
      : "");
  };
  async function verify() {
    const mine = ++token;
    const check = checkUsername(input.value);
    onState({ ok: false });
    if (!check.ok) {
      const messages = { empty: "", short: "potesNameShort", long: "potesNameLong", chars: "potesNameChars", reserved: "potesNameReserved" };
      show(messages[check.code] ? t(messages[check.code]) : "", check.code === "empty" ? "" : "bad", check.suggestion);
      return;
    }
    if (check.key === Social.profile?.usernameLower && check.display === Social.profile?.username) {
      show(t("potesNameCurrent"), "");
      return;
    }
    if (navigator.onLine === false) { show(t("potesNameOffline"), "bad"); return; }
    show(t("potesNameChecking"), "wait");
    try {
      const free = await Social.isFree(check.key);
      if (mine !== token) return;
      if (free) { show(t("potesNameFree", { name: check.display }), "good"); onState({ ok: true, ...check }); }
      else show(t("potesNameTaken", { name: check.display }), "bad", altName(check.display));
    } catch {
      if (mine === token) show(t("potesNameError"), "bad");
    }
  }
  input.addEventListener("input", () => {
    clearTimeout(timer);
    onState({ ok: false });
    const check = checkUsername(input.value);
    if (!check.ok) verify(); else { show(t("potesNameChecking"), "wait"); timer = setTimeout(verify, 450); }
  });
  status.addEventListener("click", event => {
    const btn = event.target.closest("[data-pj-suggest]");
    if (!btn) return;
    input.value = btn.dataset.pjSuggest;
    input.focus();
    verify();
  });
  if (input.value) verify();
  return input;
}

function altName(display) {
  const base = display.slice(0, 17);
  const n = 2 + Math.floor(Math.random() * 97);
  return `${base}${base.endsWith("_") ? "" : "_"}${n}`.slice(0, 20);
}

function claimErrorMessage(err) {
  if (err?.code === "taken") return t("potesNameTakenNow");
  if (err?.code === "offline") return t("potesNeedOnline");
  return t("potesJoinError");
}

/* ─── Rejoindre : pseudo → avatar → ce que tes potes voient ── */
function openJoinFlow() {
  const { sheet, close } = openSheet();
  const flow = { step: 0, name: null, typed: "", avatar: Social.avatar || randomAvatar(), busy: false };
  const steps = ["name", "avatar", "see"];
  const stepLabel = () => t("potesStepOf", { n: flow.step + 1, total: steps.length });

  function draw() {
    const step = steps[flow.step];
    if (step === "name") {
      sheet.innerHTML = `
        <div class="tl-sheet-inner">
          ${sheetHead(t("potesNameTitle"), stepLabel())}
          <p class="tl-sheet-hand">${esc(t("potesNameHand"))}</p>
          <div class="pj-field">${nameFieldHtml(flow.typed)}</div>
        </div>
        <div class="tl-dock"><button type="button" class="btn btn-primary btn-block" data-pj-next disabled>${esc(t("potesNext"))}</button></div>`;
      const next = sheet.querySelector("[data-pj-next]");
      const input = wireNameField(sheet, state => { flow.name = state.ok ? state : null; next.disabled = !state.ok; });
      input.addEventListener("input", () => { flow.typed = input.value; });
      input.addEventListener("keydown", event => { if (event.key === "Enter" && !next.disabled) next.click(); });
      setTimeout(() => input.focus(), 50);
    } else if (step === "avatar") {
      sheet.innerHTML = `
        <div class="tl-sheet-inner">
          ${sheetHead(t("potesAvatarTitle"), stepLabel())}
          <p class="tl-sheet-hand">${esc(t("potesAvatarHand"))}</p>
          <div data-pj-editor></div>
        </div>
        <div class="tl-dock tl-dock-2">
          <button type="button" class="btn btn-surface" data-pj-back>${esc(t("potesBack"))}</button>
          <button type="button" class="btn btn-primary btn-grow" data-pj-next>${esc(t("potesNext"))}</button>
        </div>`;
      mountAvatarEditor(sheet.querySelector("[data-pj-editor]"), { initial: flow.avatar, onChange: value => { flow.avatar = value; } });
      sheet.querySelector("#tl-sheet-title").focus();
    } else {
      sheet.innerHTML = `
        <div class="tl-sheet-inner">
          ${sheetHead(t("potesSeeTitle"), stepLabel())}
          <div class="pj-card">
            ${avatarSvg(flow.avatar, { size: 96, className: "pj-card-av" })}
            <p class="pj-card-name">${esc(flow.name.display)}</p>
          </div>
          <ul class="pj-see">
            <li class="is-yes"><span aria-hidden="true">✓</span>${esc(t("potesSeeYes"))}</li>
            <li class="is-no"><span aria-hidden="true">✕</span>${esc(t("potesSeeNever"))}</li>
            <li class="is-no"><span aria-hidden="true">✕</span>${esc(t("potesSeeLater"))}</li>
          </ul>
        </div>
        <div class="tl-dock tl-dock-2">
          <button type="button" class="btn btn-surface" data-pj-back>${esc(t("potesBack"))}</button>
          <button type="button" class="btn btn-primary btn-grow" data-pj-join>${esc(t("potesJoinConfirm"))}</button>
        </div>`;
      sheet.querySelector("#tl-sheet-title").focus();
    }
  }

  sheet.addEventListener("click", async event => {
    if (event.target.closest("[data-pj-back]")) { flow.step = Math.max(0, flow.step - 1); draw(); return; }
    if (event.target.closest("[data-pj-next]")) {
      if (flow.step === 0 && !flow.name) return;
      flow.step += 1;
      draw();
      return;
    }
    const joinBtn = event.target.closest("[data-pj-join]");
    if (joinBtn && !flow.busy) {
      flow.busy = true;
      joinBtn.disabled = true;
      try {
        await Social.join({ username: flow.name.display, avatar: flow.avatar });
        close();
        showToast(t("potesWelcome", { name: flow.name.display }));
        celebrateAvatar();
        if (view.invite) runSearch(view.invite);
      } catch (err) {
        console.error("[TrackLift] rejoindre :", err);
        showToast(claimErrorMessage(err));
        flow.busy = false;
        joinBtn.disabled = false;
        if (err?.code === "taken") { flow.step = 0; flow.name = null; draw(); }
      }
    }
  });
  draw();
}

function celebrateAvatar() {
  if (reducedMotion()) return;
  requestAnimationFrame(() => root?.querySelector(".pt-me-avatar .av")?.classList.add("is-hello"));
}

/* ─── Changer de pseudo ────────────────────────────────── */
function openRename() {
  const { sheet, close } = openSheet();
  let picked = null;
  sheet.innerHTML = `
    <div class="tl-sheet-inner">
      ${sheetHead(t("potesRenameTitle"))}
      <p class="tl-sheet-hand">${esc(t("potesRenameHand"))}</p>
      <div class="pj-field">${nameFieldHtml(Social.username)}</div>
    </div>
    <div class="tl-dock"><button type="button" class="btn btn-primary btn-block" data-pj-save disabled>${esc(t("avatarSave"))}</button></div>`;
  const save = sheet.querySelector("[data-pj-save]");
  const input = wireNameField(sheet, state => { picked = state.ok ? state : null; save.disabled = !state.ok; });
  input.addEventListener("keydown", event => { if (event.key === "Enter" && !save.disabled) save.click(); });
  setTimeout(() => { input.focus(); input.select(); }, 50);
  sheet.addEventListener("click", async event => {
    if (!event.target.closest("[data-pj-save]") || !picked) return;
    save.disabled = true;
    try {
      await Social.rename(picked.display);
      close();
      showToast(t("potesRenamed", { name: picked.display }));
    } catch (err) {
      console.error("[TrackLift] pseudo :", err);
      showToast(claimErrorMessage(err));
      save.disabled = false;
    }
  });
}

/* ─── Quitter ──────────────────────────────────────────── */
async function confirmLeave() {
  const ok = await confirmSheet({ title: t("potesLeaveTitle"), text: t("potesLeaveText"), confirmLabel: t("potesLeaveConfirm") });
  if (!ok) return;
  try {
    await Social.leave(async () => { await SharedPrograms.removeAll(); await Community.removeAll(); });
    showToast(t("potesLeft"));
    Bridge.refresh?.();
  } catch (err) {
    console.error("[TrackLift] quitter :", err);
    showToast(t(err?.code === "offline" ? "potesNeedOnline" : "potesLeaveError"));
  }
}
