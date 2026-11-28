/* ═══════════════════════════════════════════════════════════
   Séances de groupe : un pote propose un jour, invite jusqu'à 5 potes.
   Chacun valide en finissant une vraie séance ce jour-là (3 séries ou plus).
   Bonus : +15 points spé par pote qui a aussi fait la sienne (jusqu'à +45),
   noté dans la liste des achats (group:<id>:<pote>, gift.ps : compté comme gagné).
   Firestore groupSessions/<id> { owner, name, day, members, done { uid: date }, createdAt }
   ═══════════════════════════════════════════════════════════ */
import { firestore } from "./firebase-config.js?v=20261128a";
import { Social } from "./social.js?v=20261128a";
import { DB, localDayKey } from "./db.js?v=20261128a";
import { i18n } from "./i18n.js?v=20261128a";
import { showToast } from "./utils.js?v=20261128a";
import { openSheet, sheetHead, esc, personAvatar, nameOf } from "./potes-ui.js?v=20261128a";

export const GROUP_BONUS = 15;
export const GROUP_MAX_OTHERS = 3;
const MAX_INVITES = 5;
const KEEP_DAYS = 7;

const TEXT = {
  fr: {
    title: "Séances de groupe", create: "Créer",
    intro: "Entraînez-vous le même jour : +{n} points spé pour chaque pote qui fait aussi sa séance (jusqu'à +{max}).",
    none: "Aucune séance de groupe prévue. Lance la première !",
    today: "Aujourd'hui", tomorrow: "Demain", yesterday: "Hier", after: "Après-demain",
    stateTodo: "Fais une séance aujourd'hui (3 séries ou plus) : elle est validée toute seule.",
    stateDone: "Ta séance est validée.", stateBonus: "Ta séance est validée : +{n} points spé.",
    statePlanned: "Prévue {day}.", stateMissed: "Pas faite ce jour-là.",
    leave: "Quitter", remove: "Supprimer", someone: "Un pote", me: "Toi",
    newKicker: "Entre potes", newTitle: "Nouvelle séance de groupe",
    nameLabel: "Nom de la séance", nameDefault: "Séance des potes", dayLabel: "Quel jour ?",
    friendsLabel: "Qui vient ? (jusqu'à {n})", noFriends: "Ajoute d'abord des potes pour t'entraîner avec eux.",
    pickOne: "Choisis au moins un pote.", tooMany: "{n} potes au maximum.",
    submit: "Créer la séance", creating: "Création…", created: "Séance de groupe créée !", error: "Impossible pour l'instant, réessaie.",
    invited: "{name} t'invite à une séance de groupe : {group}", bonusToast: "+{n} points spé : {name} a aussi fait sa séance de groupe !",
    leaveTitle: "Quitter « {group} » ?", removeTitle: "Supprimer « {group} » ?", sure: "Tu pourras en créer une autre quand tu veux.", close: "Fermer"
  },
  en: {
    title: "Group workouts", create: "Create",
    intro: "Train on the same day: +{n} spec points for each friend who also does their workout (up to +{max}).",
    none: "No group workout planned. Start the first one!",
    today: "Today", tomorrow: "Tomorrow", yesterday: "Yesterday", after: "In two days",
    stateTodo: "Do a workout today (3 sets or more): it's validated automatically.",
    stateDone: "Your workout is validated.", stateBonus: "Your workout is validated: +{n} spec points.",
    statePlanned: "Planned {day}.", stateMissed: "Not done that day.",
    leave: "Leave", remove: "Delete", someone: "A friend", me: "You",
    newKicker: "With friends", newTitle: "New group workout",
    nameLabel: "Workout name", nameDefault: "Friends' workout", dayLabel: "Which day?",
    friendsLabel: "Who's coming? (up to {n})", noFriends: "Add friends first to train with them.",
    pickOne: "Pick at least one friend.", tooMany: "{n} friends at most.",
    submit: "Create the workout", creating: "Creating…", created: "Group workout created!", error: "Not possible right now, try again.",
    invited: "{name} invites you to a group workout: {group}", bonusToast: "+{n} spec points: {name} also did the group workout!",
    leaveTitle: "Leave “{group}”?", removeTitle: "Delete “{group}”?", sure: "You can create another one anytime.", close: "Close"
  }
};
const T = () => TEXT[i18n.getLanguage() === "en" ? "en" : "fr"];
const fill = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const dayShift = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return localDayKey(d); };

let list = [];
let unsub = null;
let startedFor = null;
const profiles = new Map();   // membres qui ne sont pas mes potes : leur profil public (pseudo + avatar)
const listeners = new Set();
const emit = () => listeners.forEach(fn => { try { fn(); } catch (err) { console.error(err); } });

const SEEN_KEY = () => `tl-groups-seen-${Social.uid}`;
function seenIds() { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY()) || "[]")); } catch { return new Set(); } }
function saveSeen(ids) { try { localStorage.setItem(SEEN_KEY(), JSON.stringify([...ids].slice(-60))); } catch { /* stockage indisponible */ } }

/** Profil d'un membre : moi, un pote, ou un pote du créateur (profil public lu une fois) */
function profileOf(uid) {
  if (uid === Social.uid) return Social.profile;
  const friend = Social.friends.get(uid);
  if (friend?.profile) return friend.profile;
  if (!profiles.has(uid)) {
    profiles.set(uid, null);
    firestore.doc(`profiles/${uid}`).get().then(snap => { if (snap.exists) { profiles.set(uid, snap.data()); emit(); } }).catch(() => {});
  }
  return profiles.get(uid) || null;
}

/** Potes qui ont aussi validé (dans l'ordre où ils l'ont fait), comptés pour le bonus */
const othersDone = g => (g.members || []).filter(u => u !== Social.uid && Number(g.done?.[u]))
  .sort((a, b) => g.done[a] - g.done[b]).slice(0, GROUP_MAX_OTHERS);
const bonusOf = g => (Number(g.done?.[Social.uid]) ? othersDone(g).length * GROUP_BONUS : 0);

/** Les bonus pas encore notés : un par pote qui a aussi fait sa séance (une seule fois chacun) */
function claimBonuses() {
  const have = new Set(DB.getPurchases().map(p => p.id));
  const add = [];
  for (const g of list) {
    if (!Number(g.done?.[Social.uid])) continue;
    for (const u of othersDone(g)) {
      const id = `group:${g.id}:${u}`;
      if (!have.has(id)) add.push({ id, price: 0, at: Date.now(), gift: { kind: "group", ps: GROUP_BONUS, group: g.id } });
    }
  }
  if (!add.length || !DB.addPurchases(add)) return;
  const first = add[0].id.split(":")[2];
  showToast(fill(T().bonusToast, { n: add.length * GROUP_BONUS, name: nameOf(profileOf(first)) }));
  Groups.onBonus?.(add.length * GROUP_BONUS);
}

/** Nouvelle invitation : une petite annonce, une fois */
function announceInvites() {
  const seen = seenIds();
  let changed = false;
  for (const g of list) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    changed = true;
    if (g.owner !== Social.uid && g.day >= dayShift(0)) showToast(fill(T().invited, { name: nameOf(profileOf(g.owner)), group: g.name }));
  }
  if (changed) saveSeen(seen);
}

/** Le créateur efface ses vieilles séances */
function cleanup() {
  const old = dayShift(-KEEP_DAYS);
  list.filter(g => g.owner === Social.uid && g.day < old).forEach(g => firestore.doc(`groupSessions/${g.id}`).delete().catch(() => {}));
}

export const Groups = {
  onBonus: null,
  get list() { return list; },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /** Écoute mes séances de groupe (dans la partie Potes seulement) */
  start() {
    if (!Social.joined || !Social.uid) { this.stop(); return; }
    if (unsub && startedFor === Social.uid) return;
    this.stop();
    startedFor = Social.uid;
    unsub = firestore.collection("groupSessions").where("members", "array-contains", Social.uid).onSnapshot(snap => {
      list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.day.localeCompare(b.day) || (a.createdAt || 0) - (b.createdAt || 0));
      announceInvites();
      claimBonuses();
      cleanup();
      emit();
    }, err => console.warn("[TrackLift] séances de groupe :", err?.code || err));
  },
  stop() { unsub?.(); unsub = null; startedFor = null; list = []; },

  async create({ name, day, friends }) {
    const members = [Social.uid, ...friends.filter(u => u !== Social.uid)].slice(0, MAX_INVITES + 1);
    await firestore.collection("groupSessions").add({ owner: Social.uid, name: String(name).trim().slice(0, 60) || T().nameDefault, day, members, done: {}, createdAt: Date.now() });
  },
  async leave(id) {
    const g = list.find(x => x.id === id);
    if (!g) return;
    await firestore.doc(`groupSessions/${id}`).update({ members: g.members.filter(u => u !== Social.uid) });
  },
  async remove(id) { await firestore.doc(`groupSessions/${id}`).delete(); },

  /** Fin d'une vraie séance : je valide les séances de groupe de ce jour */
  async markDone(day) {
    if (!Social.joined || !Social.uid) return;
    let groups = list;
    if (!unsub) {
      try { groups = (await firestore.collection("groupSessions").where("members", "array-contains", Social.uid).get()).docs.map(d => ({ id: d.id, ...d.data() })); }
      catch { return; }
    }
    await Promise.all(groups.filter(g => g.day === day && !Number(g.done?.[Social.uid]))
      .map(g => firestore.doc(`groupSessions/${g.id}`).update({ [`done.${Social.uid}`]: Date.now() }).catch(err => console.warn("[TrackLift] séance de groupe :", err?.code || err))));
  }
};

/* ─── La carte dans la page Potes ─── */
function dayLabel(day) {
  const t = T();
  if (day === dayShift(0)) return t.today;
  if (day === dayShift(1)) return t.tomorrow;
  if (day === dayShift(-1)) return t.yesterday;
  if (day === dayShift(2)) return t.after;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString(i18n.getLocale(), { weekday: "long", day: "numeric", month: "long" });
}

function groupHtml(g) {
  const t = T();
  const me = Social.uid;
  const today = dayShift(0);
  const mine = Number(g.done?.[me]);
  const bonus = bonusOf(g);
  const state = g.day > today ? fill(t.statePlanned, { day: dayLabel(g.day).toLowerCase() })
    : mine ? (bonus ? fill(t.stateBonus, { n: bonus }) : t.stateDone)
    : g.day === today ? t.stateTodo : t.stateMissed;
  const members = (g.members || []).map(u => {
    const done = Number(g.done?.[u]);
    const label = u === me ? t.me : nameOf(profileOf(u)) || t.someone;
    return `<li class="gs-member${done ? " is-done" : ""}">${personAvatar(profileOf(u), 34)}<span>${esc(label)}</span>${done ? `<i class="gs-check" aria-hidden="true">✓</i>` : ""}</li>`;
  }).join("");
  const action = g.owner === me
    ? `<button type="button" class="hero-other gs-action" data-gs-remove="${esc(g.id)}">${esc(t.remove)}</button>`
    : `<button type="button" class="hero-other gs-action" data-gs-leave="${esc(g.id)}">${esc(t.leave)}</button>`;
  return `<li class="gs-item${g.day === today ? " is-today" : ""}">
      <div class="gs-top"><b class="gs-name">${esc(g.name)}</b><span class="gs-day">${esc(dayLabel(g.day))}</span></div>
      <ul class="gs-members">${members}</ul>
      <p class="gs-state${mine ? " is-ok" : ""}">${esc(state)}</p>
      ${action}
    </li>`;
}

/** La carte « Séances de groupe » (page Potes, onglet des potes) */
export function groupsCardHtml() {
  const t = T();
  const shown = list.filter(g => g.day >= dayShift(-1));
  return `
    <section class="card pt-card gs-card" aria-labelledby="gs-title">
      <div class="gs-head"><h2 id="gs-title" class="pt-card-title">${esc(t.title)}</h2>
        <button type="button" class="btn btn-ghost btn-sm" data-gs-new data-k="gs-new">${esc(t.create)}</button></div>
      <p class="pt-text">${esc(fill(t.intro, { n: GROUP_BONUS, max: GROUP_BONUS * GROUP_MAX_OTHERS }))}</p>
      ${shown.length ? `<ul class="gs-list">${shown.map(groupHtml).join("")}</ul>` : `<p class="pt-text gs-none">${esc(t.none)}</p>`}
    </section>`;
}

/** Clics de la carte ; renvoie vrai si le clic a été traité */
export async function handleGroupsClick(event, confirmSheet) {
  const t = T();
  if (event.target.closest("[data-gs-new]")) { openCreate(); return true; }
  const leave = event.target.closest("[data-gs-leave]");
  const remove = event.target.closest("[data-gs-remove]");
  if (!leave && !remove) return false;
  const id = (leave || remove).dataset[leave ? "gsLeave" : "gsRemove"];
  const g = list.find(x => x.id === id);
  if (!g) return true;
  const ok = await confirmSheet({ title: fill(leave ? t.leaveTitle : t.removeTitle, { group: g.name }), text: t.sure, confirmLabel: leave ? t.leave : t.remove });
  if (!ok) return true;
  try { await (leave ? Groups.leave(id) : Groups.remove(id)); } catch { showToast(t.error); }
  return true;
}

/* ─── Créer une séance de groupe ─── */
function openCreate() {
  const t = T();
  const friends = [...Social.friends.values()].filter(f => f.profile);
  const { sheet, close } = openSheet();
  const draft = { name: t.nameDefault, day: dayShift(0), picked: new Set(), busy: false, msg: "" };
  const days = [[dayShift(0), t.today], [dayShift(1), t.tomorrow], [dayShift(2), t.after]];
  const draw = () => {
    sheet.innerHTML = `
      <div class="tl-sheet-inner gs-new">
        ${sheetHead(t.newTitle, t.newKicker)}
        <label class="label" for="gs-name">${esc(t.nameLabel)}</label>
        <input id="gs-name" class="input" type="text" maxlength="60" autocomplete="off" value="${esc(draft.name)}">
        <p class="label gs-label">${esc(t.dayLabel)}</p>
        <div class="gs-days" role="radiogroup" aria-label="${esc(t.dayLabel)}">${days.map(([key, label]) => `<button type="button" role="radio" class="weight-chip${draft.day === key ? " active" : ""}" aria-checked="${draft.day === key}" data-gs-day="${key}">${esc(label)}</button>`).join("")}</div>
        <p class="label gs-label">${esc(fill(t.friendsLabel, { n: MAX_INVITES }))}</p>
        ${friends.length ? `<ul class="gs-pick">${friends.map(f => `<li><label class="gs-friend"><input type="checkbox" data-gs-friend="${esc(f.uid)}"${draft.picked.has(f.uid) ? " checked" : ""}>${personAvatar(f.profile, 34)}<span>${esc(nameOf(f.profile))}</span></label></li>`).join("")}</ul>`
          : `<p class="pt-text">${esc(t.noFriends)}</p>`}
        <p class="ib-msg is-error" role="status">${esc(draft.msg)}</p>
        <button type="button" class="btn btn-primary btn-block" data-gs-create${draft.busy || !friends.length ? " disabled" : ""}>${esc(draft.busy ? t.creating : t.submit)}</button>
      </div>`;
  };
  draw();
  sheet.querySelector("#tl-sheet-title")?.focus();
  sheet.addEventListener("input", event => { if (event.target.id === "gs-name") draft.name = event.target.value; });
  sheet.addEventListener("change", event => {
    const box = event.target.closest("[data-gs-friend]");
    if (!box) return;
    if (box.checked && draft.picked.size >= MAX_INVITES) { box.checked = false; draft.msg = fill(t.tooMany, { n: MAX_INVITES }); draw(); return; }
    box.checked ? draft.picked.add(box.dataset.gsFriend) : draft.picked.delete(box.dataset.gsFriend);
    draft.msg = "";
  });
  sheet.addEventListener("click", async event => {
    const day = event.target.closest("[data-gs-day]");
    if (day) { draft.day = day.dataset.gsDay; draw(); sheet.querySelector(`[data-gs-day="${draft.day}"]`)?.focus(); return; }
    if (!event.target.closest("[data-gs-create]") || draft.busy) return;
    if (!draft.picked.size) { draft.msg = t.pickOne; draw(); return; }
    draft.busy = true;
    draw();
    try {
      await Groups.create({ name: draft.name, day: draft.day, friends: [...draft.picked] });
      showToast(t.created);
      close();
    } catch (err) {
      console.warn("[TrackLift] séance de groupe :", err?.code || err);
      draft.busy = false;
      draft.msg = t.error;
      draw();
    }
  });
}
