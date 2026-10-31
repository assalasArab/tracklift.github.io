/* ═══════════════════════════════════════════════════════════
   Partie Potes : données (Firestore).
   - social/<uid>       réglages privés (avatar, partages, classement, notifs, objectif), soi seul
   - profiles/<uid>     profil public : pseudo + avatar, RIEN d'autre
   - usernames/<pseudo> réservation du pseudo
   - friendRequests, friendships, blocks
   - shared/<uid> (+ items/<élément>) ce que l'on partage, lisible par ses amis
   - activity/<uid>/events, cheers
   users/<uid> (données de l'appli) n'est jamais lu ni modifié ici.
   La sécurité est assurée par firestore.rules, pas par ce fichier.
   ═══════════════════════════════════════════════════════════ */
import { firestore } from "./firebase-config.js?v=20261031b";
import { normalizeAvatar } from "./avatar.js?v=20261031b";
import { SHARE_KEYS, BOARD_KEYS } from "./social-stats.js?v=20261031b";

const RESERVED = ["admin", "administrateur", "tracklift", "support", "moderation", "moderateur", "staff", "officiel", "equipe"];
const ITEM_KEYS = [...SHARE_KEYS, "board", "programs"];
export const NOTIF_TYPES = ["record", "streak", "weekGoal", "request", "accepted", "cheer", "invite"];
const DAY = 86400000;
const EVENT_SHARE = { record: "records", streak: "streak", weekGoal: "sessions" };

/** Vérifie un pseudo saisi. { ok, display, key } ou { ok: false, code, suggestion } */
export function checkUsername(raw) {
  const display = String(raw || "").trim();
  const key = display.toLowerCase();
  if (!display) return { ok: false, code: "empty" };
  if (!/^[A-Za-z0-9_.]+$/.test(display)) {
    const suggestion = suggestUsername(display);
    return { ok: false, code: "chars", suggestion: suggestion !== display && checkUsername(suggestion).ok ? suggestion : "" };
  }
  if (display.length < 3) return { ok: false, code: "short" };
  if (display.length > 20) return { ok: false, code: "long" };
  if (RESERVED.includes(key)) return { ok: false, code: "reserved" };
  return { ok: true, display, key };
}

/** « Léo B! » → « Leo_B » */
export function suggestUsername(raw) {
  return String(raw || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_.]/g, "").slice(0, 20);
}

export function pairId(a, b) { return a < b ? `${a}_${b}` : `${b}_${a}`; }

function fail(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}
const col = path => firestore.collection(path);
const ref = path => firestore.doc(path);

export const Social = {
  uid: null,
  loaded: false,
  loading: false,
  error: null,
  social: null,      // social/<uid>
  profile: null,     // profiles/<uid> (null = pas dans la partie Potes)
  friends: new Map(),   // uid → { uid, profile, since, createdBy, index: [], items: {}, events: [] }
  profiles: new Map(),  // cache uid → profil public
  requestsIn: [],
  requestsOut: [],
  blocks: [],
  myEvents: [],
  cheersIn: [],
  cheersOut: [],
  invitesIn: [],     // invitations reçues à rejoindre un programme partagé
  invitesOut: [],    // invitations que j'ai envoyées
  liveReady: false,
  summaryProvider: null, // () => éléments partagés (calculés par l'appli)
  _listeners: new Set(),
  _unsubs: [],
  _friendUnsubs: new Map(),
  _publishTimer: null,
  _lastPublished: null,

  get joined() { return !!this.profile; },
  get avatar() { return this.profile?.avatar || this.social?.avatar || null; },
  get username() { return this.profile?.username || ""; },
  get share() { return Object.fromEntries(SHARE_KEYS.map(k => [k, this.social?.share?.[k] === true])); },
  get board() { return Object.fromEntries(BOARD_KEYS.map(k => [k, this.social?.board?.[k] === true])); },
  get mute() { return Object.fromEntries(NOTIF_TYPES.map(k => [k, this.social?.mute?.[k] === true])); },
  get weeklyGoal() { return Math.min(7, Math.max(1, Number(this.social?.weeklyGoal) || 3)); },
  get seenAt() { return Number(this.social?.seenAt) || 0; },

  onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); },
  _emit() { this._listeners.forEach(fn => { try { fn(this); } catch (err) { console.error(err); } }); },

  reset() {
    this.stopLive();
    Object.assign(this, { uid: null, loaded: false, loading: false, error: null, social: null, profile: null, _lastPublished: null });
    this._emit();
  },

  /** Lit ses deux documents. Une erreur (hors ligne, règles absentes) ne casse rien. */
  async load(uid) {
    this.uid = uid;
    this.loading = true;
    this._emit();
    try {
      const [social, profile] = await Promise.all([ref(`social/${uid}`).get(), ref(`profiles/${uid}`).get()]);
      if (this.uid !== uid) return;
      this.social = social.exists ? social.data() : null;
      this.profile = profile.exists ? profile.data() : null;
      this.error = null;
    } catch (err) {
      console.warn("[TrackLift] partie Potes indisponible :", err?.code || err);
      this.error = err?.code || "error";
    }
    this.loaded = true;
    this.loading = false;
    if (this.joined) { this.startLive(); this.queuePublish(); this.cleanup(); }
    this._emit();
  },

  /* ─── Pseudo, avatar ─────────────────────────────────── */
  async isFree(key) {
    const snap = await ref(`usernames/${key}`).get();
    return !snap.exists || snap.data().uid === this.uid;
  },

  join({ username, avatar }) { return this._claim(username, avatar, true); },
  rename(username) { return this._claim(username, this.profile?.avatar, false); },

  async _claim(username, avatar, joining) {
    const check = checkUsername(username);
    if (!check.ok) throw fail(check.code);
    if (navigator.onLine === false) throw fail("offline");
    const uid = this.uid;
    const av = normalizeAvatar(avatar);
    const now = Date.now();
    const nameRef = ref(`usernames/${check.key}`);
    const profileRef = ref(`profiles/${uid}`);
    const socialRef = ref(`social/${uid}`);
    const profile = { username: check.display, usernameLower: check.key, avatar: av, updatedAt: now };
    // en arrivant, tout est privé : aucun partage, aucun classement
    const fresh = joining ? {
      joinedAt: now,
      share: Object.fromEntries(SHARE_KEYS.map(k => [k, false])),
      board: Object.fromEntries(BOARD_KEYS.map(k => [k, false])),
      seenAt: now
    } : {};
    await firestore.runTransaction(async tx => {
      const nameSnap = await tx.get(nameRef);
      const profileSnap = await tx.get(profileRef);
      if (nameSnap.exists && nameSnap.data().uid !== uid) throw fail("taken");
      const old = profileSnap.exists ? profileSnap.data().usernameLower : null;
      if (old && old !== check.key) tx.delete(ref(`usernames/${old}`));
      if (!nameSnap.exists) tx.set(nameRef, { uid });
      tx.set(profileRef, profile);
      tx.set(socialRef, { avatar: av, updatedAt: now, ...fresh }, { merge: true });
    });
    this.profile = profile;
    this.social = { ...(this.social || {}), avatar: av, updatedAt: now, ...fresh };
    if (joining) { this.startLive(); this.queuePublish(); }
    this._emit();
    return profile;
  },

  async saveAvatar(avatar) {
    const av = normalizeAvatar(avatar);
    const now = Date.now();
    const batch = firestore.batch();
    batch.set(ref(`social/${this.uid}`), { avatar: av, updatedAt: now }, { merge: true });
    if (this.profile) batch.update(ref(`profiles/${this.uid}`), { avatar: av, updatedAt: now });
    const write = batch.commit();
    this.social = { ...(this.social || {}), avatar: av, updatedAt: now };
    if (this.profile) this.profile = { ...this.profile, avatar: av, updatedAt: now };
    this._emit();
    if (navigator.onLine !== false) await write;
    return av;
  },

  /* ─── Écoute en direct ───────────────────────────────── */
  startLive() {
    if (this._unsubs.length || !this.uid) return;
    const me = this.uid;
    const since = Date.now() - 30 * DAY;
    const onErr = what => err => console.warn(`[TrackLift] écoute ${what} :`, err?.code || err);
    this._unsubs.push(
      col("friendships").where("members", "array-contains", me).onSnapshot(snap => {
        const next = new Map(snap.docs.map(d => {
          const data = d.data();
          const other = data.members.find(m => m !== me);
          return [other, { since: data.createdAt || 0, createdBy: data.createdBy || null }];
        }));
        for (const uid of [...this.friends.keys()]) if (!next.has(uid)) this._dropFriend(uid);
        for (const [uid, info] of next) {
          if (!this.friends.has(uid)) this._addFriend(uid, info);
          else Object.assign(this.friends.get(uid), info);
        }
        this.liveReady = true;
        this._emit();
      }, onErr("amis")),
      col("friendRequests").where("to", "==", me).onSnapshot(snap => {
        this.requestsIn = snap.docs.map(d => d.data()).sort((a, b) => b.createdAt - a.createdAt);
        this._fetchProfiles(this.requestsIn.map(r => r.from));
        this._emit();
      }, onErr("demandes reçues")),
      col("friendRequests").where("from", "==", me).onSnapshot(snap => {
        this.requestsOut = snap.docs.map(d => d.data()).sort((a, b) => b.createdAt - a.createdAt);
        this._fetchProfiles(this.requestsOut.map(r => r.to));
        this._emit();
      }, onErr("demandes envoyées")),
      col("blocks").where("by", "==", me).onSnapshot(snap => {
        this.blocks = snap.docs.map(d => d.data());
        this._fetchProfiles(this.blocks.map(b => b.target));
        this._emit();
      }, onErr("blocages")),
      col("cheers").where("to", "==", me).onSnapshot(snap => {
        this.cheersIn = snap.docs.map(d => d.data()).filter(c => c.createdAt >= since);
        this._emit();
      }, onErr("bravos reçus")),
      col("cheers").where("from", "==", me).onSnapshot(snap => {
        this.cheersOut = snap.docs.map(d => d.data());
        this._emit();
      }, onErr("bravos envoyés")),
      col(`activity/${me}/events`).where("createdAt", ">", since).orderBy("createdAt", "desc").limit(60).onSnapshot(snap => {
        this.myEvents = snap.docs.map(d => ({ id: d.id, author: me, ...d.data() }));
        this._emit();
      }, onErr("mon activité")),
      col("programInvites").where("to", "==", me).onSnapshot(snap => {
        this.invitesIn = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt);
        this._fetchProfiles(this.invitesIn.map(i => i.from));
        this._emit();
      }, onErr("invitations reçues")),
      col("programInvites").where("from", "==", me).onSnapshot(snap => {
        this.invitesOut = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this._emit();
      }, onErr("invitations envoyées"))
    );
  },

  stopLive() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
    for (const uid of [...this.friends.keys()]) this._dropFriend(uid);
    Object.assign(this, { requestsIn: [], requestsOut: [], blocks: [], myEvents: [], cheersIn: [], cheersOut: [], invitesIn: [], invitesOut: [], liveReady: false });
  },

  _addFriend(uid, info) {
    const friend = { uid, profile: this.profiles.get(uid) || null, ...info, index: [], items: {}, events: [], itemsLoaded: false };
    this.friends.set(uid, friend);
    const since = Date.now() - 14 * DAY;
    const unsubs = [
      ref(`profiles/${uid}`).onSnapshot(snap => {
        friend.profile = snap.exists ? snap.data() : null;
        if (friend.profile) this.profiles.set(uid, friend.profile);
        this._emit();
      }, () => {}),
      // la liste de ce qu'il partage ; à chaque changement on relit les éléments
      ref(`shared/${uid}`).onSnapshot(snap => {
        friend.index = snap.exists ? (snap.data().items || []).filter(k => ITEM_KEYS.includes(k)) : [];
        this._loadItems(friend);
      }, () => { friend.index = []; friend.items = {}; friend.itemsLoaded = true; this._emit(); }),
      ref(`activity/${uid}`).collection("events").where("createdAt", ">", since).orderBy("createdAt", "desc").limit(30).onSnapshot(snap => {
        friend.events = snap.docs.map(d => ({ id: d.id, author: uid, ...d.data() }));
        this._emit();
      }, () => { friend.events = []; this._emit(); })
    ];
    this._friendUnsubs.set(uid, unsubs);
  },

  _dropFriend(uid) {
    (this._friendUnsubs.get(uid) || []).forEach(fn => fn());
    this._friendUnsubs.delete(uid);
    this.friends.delete(uid);
  },

  async _loadItems(friend) {
    const keys = [...friend.index];
    const results = await Promise.all(keys.map(key => ref(`shared/${friend.uid}/items/${key}`).get()
      .then(snap => [key, snap.exists ? snap.data() : null])
      .catch(() => [key, null]))); // élément plus partagé : les règles refusent, on l'ignore
    if (!this.friends.has(friend.uid)) return;
    friend.items = Object.fromEntries(results.filter(([, v]) => v));
    friend.itemsLoaded = true;
    this._emit();
  },

  async _fetchProfiles(uids) {
    const missing = [...new Set(uids)].filter(uid => uid && !this.profiles.has(uid));
    if (!missing.length) return;
    await Promise.all(missing.map(uid => ref(`profiles/${uid}`).get()
      .then(snap => { this.profiles.set(uid, snap.exists ? snap.data() : null); })
      .catch(() => { this.profiles.set(uid, null); })));
    this._emit();
  },

  profileOf(uid) { return this.friends.get(uid)?.profile || this.profiles.get(uid) || null; },
  isFriend(uid) { return this.friends.has(uid); },
  isBlocked(uid) { return this.blocks.some(b => b.target === uid); },

  /* ─── Amis ───────────────────────────────────────────── */
  /** Cherche un pseudo exact. null si personne (ou si cette personne nous a bloqués). */
  async lookup(username) {
    const check = checkUsername(username);
    if (!check.ok) return null;
    const snap = await ref(`usernames/${check.key}`).get();
    if (!snap.exists) return null;
    const uid = snap.data().uid;
    if (uid === this.uid) return { uid, self: true, profile: this.profile };
    try {
      const profile = await ref(`profiles/${uid}`).get();
      if (!profile.exists) return null;
      this.profiles.set(uid, profile.data());
      return { uid, profile: profile.data() };
    } catch { return null; }
  },

  /** Envoie une demande (ou accepte directement si l'autre nous l'avait déjà demandé) */
  async sendRequest(uid) {
    if (uid === this.uid) throw fail("self");
    if (this.isFriend(uid)) throw fail("already");
    if (this.isBlocked(uid)) throw fail("blocked");
    if (this.requestsIn.some(r => r.from === uid)) { await this.acceptRequest(uid); return "accepted"; }
    if (this.requestsOut.some(r => r.to === uid)) return "pending";
    if (navigator.onLine === false) throw fail("offline");
    await ref(`friendRequests/${this.uid}_${uid}`).set({ from: this.uid, to: uid, createdAt: Date.now() });
    return "sent";
  },

  async acceptRequest(fromUid) {
    const members = [this.uid, fromUid].sort();
    const batch = firestore.batch();
    batch.set(ref(`friendships/${members.join("_")}`), { members, createdAt: Date.now(), createdBy: this.uid });
    batch.delete(ref(`friendRequests/${fromUid}_${this.uid}`));
    await batch.commit();
  },
  refuseRequest(fromUid) { return ref(`friendRequests/${fromUid}_${this.uid}`).delete(); },
  cancelRequest(toUid) { return ref(`friendRequests/${this.uid}_${toUid}`).delete(); },
  removeFriend(uid) { return ref(`friendships/${pairId(this.uid, uid)}`).delete(); },

  /** Bloquer : plus d'amitié, plus de demandes, et il ne peut plus rien nous demander */
  async block(uid) {
    const batch = firestore.batch();
    batch.set(ref(`blocks/${this.uid}_${uid}`), { by: this.uid, target: uid, createdAt: Date.now() });
    if (this.isFriend(uid)) batch.delete(ref(`friendships/${pairId(this.uid, uid)}`));
    if (this.requestsIn.some(r => r.from === uid)) batch.delete(ref(`friendRequests/${uid}_${this.uid}`));
    if (this.requestsOut.some(r => r.to === uid)) batch.delete(ref(`friendRequests/${this.uid}_${uid}`));
    await batch.commit();
  },
  unblock(uid) { return ref(`blocks/${this.uid}_${uid}`).delete(); },

  /* ─── Réglages et partage ────────────────────────────── */
  /**
   * patch : { share?, board?, mute?, weeklyGoal? }.
   * Couper un partage efface tout de suite l'élément et les anciennes notifs de ce type.
   */
  async updateSettings(patch) {
    const before = { share: this.share, board: this.board };
    const next = { ...(this.social || {}) };
    for (const key of ["share", "board", "mute"]) if (patch[key]) next[key] = { ...(next[key] || {}), ...patch[key] };
    if (patch.weeklyGoal !== undefined) next.weeklyGoal = Math.min(7, Math.max(1, Number(patch.weeklyGoal) || 3));
    const write = {};
    for (const key of ["share", "board", "mute", "weeklyGoal"]) if (patch[key] !== undefined) write[key] = next[key];
    this.social = next;
    const batch = firestore.batch();
    batch.set(ref(`social/${this.uid}`), { ...write, updatedAt: Date.now() }, { merge: true });
    if (this.joined) this._addPublish(batch, true);
    this._emit();
    await batch.commit();
    // anciennes notifs des types coupés
    const turnedOff = Object.entries(EVENT_SHARE).filter(([, shareKey]) => before.share[shareKey] && !this.share[shareKey]).map(([type]) => type);
    if (turnedOff.length) await this._deleteMyEvents(event => turnedOff.includes(event.type));
  },

  /** Ajoute au lot l'écriture du résumé : éléments partagés écrits, les autres effacés */
  _addPublish(batch, force = false) {
    if (!this.summaryProvider) return false;
    const items = this.summaryProvider();
    const signature = JSON.stringify(items);
    if (!force && signature === this._lastPublished) return false;
    this._lastPublished = signature;
    for (const key of ITEM_KEYS) {
      const itemRef = ref(`shared/${this.uid}/items/${key}`);
      if (items[key]) batch.set(itemRef, { ...items[key], updatedAt: Date.now() });
      else batch.delete(itemRef);
    }
    batch.set(ref(`shared/${this.uid}`), { items: Object.keys(items), updatedAt: Date.now() });
    return true;
  },

  /** Réécrit le résumé partagé un peu plus tard (après une séance, une pesée…) */
  queuePublish(delay = 900) {
    if (!this.joined) return;
    clearTimeout(this._publishTimer);
    this._publishTimer = setTimeout(() => this.publishNow().catch(err => console.warn("[TrackLift] partage :", err?.code || err)), delay);
  },

  async publishNow() {
    if (!this.joined) return;
    const batch = firestore.batch();
    if (this._addPublish(batch)) await batch.commit();
  },

  /** Ce que mes potes voient, relu depuis Firestore (exactement ce qui est publié) */
  async readMyShared() {
    await this.publishNow();
    const index = await ref(`shared/${this.uid}`).get();
    const keys = index.exists ? index.data().items || [] : [];
    const entries = await Promise.all(keys.map(key => ref(`shared/${this.uid}/items/${key}`).get().then(s => [key, s.exists ? s.data() : null])));
    return Object.fromEntries(entries.filter(([, v]) => v));
  },

  /* ─── Activité, bravos, notifications ────────────────── */
  async postEvent(type, data) {
    if (!this.joined || !this.share[EVENT_SHARE[type]]) return;
    try {
      await col(`activity/${this.uid}/events`).add({ type, data, createdAt: Date.now() });
    } catch (err) { console.warn("[TrackLift] activité :", err?.code || err); }
  },

  hasCheered(eventId) { return this.cheersOut.some(c => c.eventId === eventId); },

  async cheer(author, eventId) {
    if (this.hasCheered(eventId)) return;
    const cheer = { from: this.uid, to: author, eventId, createdAt: Date.now() };
    this.cheersOut = [...this.cheersOut, cheer];
    this._emit();
    try { await ref(`cheers/${this.uid}_${eventId}`).set(cheer); }
    catch (err) { this.cheersOut = this.cheersOut.filter(c => c !== cheer); this._emit(); throw err; }
  },

  async markSeen() {
    const now = Date.now();
    this.social = { ...(this.social || {}), seenAt: now };
    this._emit();
    try { await ref(`social/${this.uid}`).set({ seenAt: now }, { merge: true }); } catch { /* hors ligne : partira plus tard */ }
  },

  async _deleteMyEvents(filter) {
    const snap = await col(`activity/${this.uid}/events`).get();
    const doomed = snap.docs.filter(d => filter({ id: d.id, ...d.data() }));
    for (let i = 0; i < doomed.length; i += 400) {
      const batch = firestore.batch();
      doomed.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  },

  /** Ménage : mes événements et mes bravos de plus de 30 jours */
  async cleanup() {
    const cutoff = Date.now() - 30 * DAY;
    try {
      const [events, cheers] = await Promise.all([
        col(`activity/${this.uid}/events`).where("createdAt", "<", cutoff).get(),
        col("cheers").where("from", "==", this.uid).get()
      ]);
      const doomed = [...events.docs, ...cheers.docs.filter(d => d.data().createdAt < cutoff)];
      if (!doomed.length) return;
      const batch = firestore.batch();
      doomed.slice(0, 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch { /* sans importance */ }
  },

  /* ─── Quitter ────────────────────────────────────────── */
  /** Supprime le profil public, le pseudo, les partages, les amitiés, les demandes, l'activité et les bravos.
      Les blocages restent, pour te protéger si tu reviens. onLeave() nettoie les programmes et exercices partagés. */
  async leave(onLeave) {
    if (!this.profile) return;
    if (navigator.onLine === false) throw fail("offline");
    const me = this.uid;
    clearTimeout(this._publishTimer);
    if (onLeave) await onLeave();
    const [friendships, reqIn, reqOut, cheersIn, cheersOut, events, items, invitesIn, invitesOut] = await Promise.all([
      col("friendships").where("members", "array-contains", me).get(),
      col("friendRequests").where("to", "==", me).get(),
      col("friendRequests").where("from", "==", me).get(),
      col("cheers").where("to", "==", me).get(),
      col("cheers").where("from", "==", me).get(),
      col(`activity/${me}/events`).get(),
      col(`shared/${me}/items`).get(),
      col("programInvites").where("to", "==", me).get(),
      col("programInvites").where("from", "==", me).get()
    ]);
    const doomed = [friendships, reqIn, reqOut, cheersIn, cheersOut, events, items, invitesIn, invitesOut].flatMap(snap => snap.docs.map(d => d.ref));
    this.stopLive();
    for (let i = 0; i < doomed.length; i += 400) {
      const batch = firestore.batch();
      doomed.slice(i, i + 400).forEach(r => batch.delete(r));
      await batch.commit();
    }
    const batch = firestore.batch();
    batch.delete(ref(`shared/${me}`));
    batch.delete(ref(`profiles/${me}`));
    batch.delete(ref(`usernames/${this.profile.usernameLower}`));
    // on repart à zéro : tout redevient privé
    batch.set(ref(`social/${me}`), {
      joinedAt: null, leftAt: Date.now(),
      share: Object.fromEntries(SHARE_KEYS.map(k => [k, false])),
      board: Object.fromEntries(BOARD_KEYS.map(k => [k, false]))
    }, { merge: true });
    await batch.commit();
    this.profile = null;
    this._lastPublished = null;
    this.social = { ...(this.social || {}), joinedAt: null, share: {}, board: {} };
    this._emit();
  }
};
