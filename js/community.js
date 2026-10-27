/* ═══════════════════════════════════════════════════════════
   Programmes partagés (par lien, que d'autres rejoignent) et
   exercices de la communauté (anonymes, 10 maximum par personne).
   Les correspondances programme local ↔ programme partagé sont gardées
   dans social/<uid> (privé) : users/<uid> garde sa structure.
   ═══════════════════════════════════════════════════════════ */
import { firestore } from "./firebase-config.js?v=20261027b";
import { Social } from "./social.js?v=20261027b";

export const COMMUNITY_LIMIT = 10;
const ref = path => firestore.doc(path);
const col = path => firestore.collection(path);
const clip = (text, n) => String(text || "").slice(0, n);
function fail(code) { const e = new Error(code); e.code = code; return e; }

/** Exercice perso → version partageable (aucune donnée personnelle) */
export function shareableExercise(ex) {
  return {
    id: ex.id,
    name: clip(ex.name_fr || ex.name, 60),
    type: ex.type || "other",
    muscle_focus: ex.muscle_focus || "autre",
    muscle_portion: ex.muscle_portion || null,
    contraction_type: ex.contraction_type || null,
    primary_muscles: (ex.primary_muscles || []).slice(0, 4),
    secondary_muscles: (ex.secondary_muscles || []).slice(0, 8),
    equipment: ex.equipment || "autre",
    bodyweight: !!ex.bodyweight,
    description: clip(ex.description, 400)
  };
}

/* ─── Programmes partagés ──────────────────────────────── */
export const SharedPrograms = {
  /** liens privés : { programmeLocal: idPartagé } et { idPartagé: { localId, version } } */
  get shares() { return Social.social?.progShares || {}; },
  get joined() { return Social.social?.progJoined || {}; },

  link(id) { return `${location.origin}${location.pathname}?programme=${encodeURIComponent(id)}`; },

  /** Publie (ou met à jour) un programme. Les charges ne sont pas partagées, seulement séries et répétitions. */
  async publish(program, customExercises) {
    if (!Social.joined) throw fail("not-joined");
    if (navigator.onLine === false) throw fail("offline");
    const id = this.shares[program.id] || col("sharedPrograms").doc().id;
    const docRef = ref(`sharedPrograms/${id}`);
    let previous = null;
    try { const snap = await docRef.get(); previous = snap.exists ? snap.data() : null; } catch { previous = null; }
    const usedCustom = new Set((program.sessions || []).flatMap(s => s.exerciseIds || []).filter(exId => String(exId).startsWith("custom-")));
    const data = {
      owner: Social.uid,
      name: clip(program.name, 80) || "programme",
      description: clip(program.description, 300),
      sessions: (program.sessions || []).slice(0, 14).map(session => ({
        name: clip(session.name, 40),
        type: session.type || "other",
        exerciseIds: (session.exerciseIds || []).slice(0, 20),
        plan: Object.fromEntries(Object.entries(session.plan || {}).map(([exId, p]) => [exId, {
          sets: Number(p?.sets) || 3,
          reps: Number(p?.reps) || 10,
          ...(Array.isArray(p?.setList) ? { setList: p.setList.slice(0, 12).map(item => ({ reps: Number(item.reps) || 0, kind: item.kind || "work" })) } : {})
        }]))
      })),
      customs: customExercises.filter(ex => usedCustom.has(ex.id)).slice(0, 40).map(shareableExercise),
      version: (previous?.version || 0) + 1,
      createdAt: previous?.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    await docRef.set(data);
    if (!this.shares[program.id]) await this._saveLinks({ progShares: { ...this.shares, [program.id]: id } });
    return { id, ...data };
  },

  /** Arrête de partager : les inscrits gardent leur copie */
  async unpublish(localId) {
    const id = this.shares[localId];
    if (!id) return;
    const members = await col(`sharedPrograms/${id}/members`).get().catch(() => ({ docs: [] }));
    const batch = firestore.batch();
    members.docs.forEach(d => batch.delete(d.ref));
    batch.delete(ref(`sharedPrograms/${id}`));
    await batch.commit();
    const shares = { ...this.shares };
    delete shares[localId];
    await this._saveLinks({ progShares: shares });
  },

  async get(id) {
    try { const snap = await ref(`sharedPrograms/${id}`).get(); return snap.exists ? { id, ...snap.data() } : null; }
    catch { return null; }
  },

  /** uids des inscrits (visible par l'auteur et les inscrits) */
  async members(id) {
    try { return (await col(`sharedPrograms/${id}/members`).get()).docs.map(d => d.id); }
    catch { return null; }
  },

  async join(program, localId) {
    if (!Social.joined) throw fail("not-joined");
    await ref(`sharedPrograms/${program.id}/members/${Social.uid}`).set({ joinedAt: Date.now() });
    await this._saveLinks({ progJoined: { ...this.joined, [program.id]: { localId, version: program.version } } });
  },

  async markUpdated(id, version) {
    const entry = this.joined[id];
    if (entry) await this._saveLinks({ progJoined: { ...this.joined, [id]: { ...entry, version } } });
  },

  async unfollow(id) {
    try { await ref(`sharedPrograms/${id}/members/${Social.uid}`).delete(); } catch { /* programme déjà retiré */ }
    const joined = { ...this.joined };
    delete joined[id];
    await this._saveLinks({ progJoined: joined });
  },

  async _saveLinks(patch) {
    Social.social = { ...(Social.social || {}), ...patch };
    await ref(`social/${Social.uid}`).set(patch, { merge: true });
    Social.queuePublish(200);
    Social._emit();
  },

  /** liste publiée pour les amis (élément « programs » du résumé) */
  publishedList(programs) {
    return Object.entries(this.shares).map(([localId, id]) => ({ id, name: programs.find(p => p.id === localId)?.name || "" })).filter(p => p.name);
  },

  /** au départ de la partie Potes : retire mes programmes partagés et mes inscriptions */
  async removeAll() {
    for (const localId of Object.keys(this.shares)) await this.unpublish(localId).catch(() => {});
    for (const id of Object.keys(this.joined)) await this.unfollow(id).catch(() => {});
  }
};

/* ─── Exercices de la communauté ───────────────────────── */
export const Community = {
  list: [],
  loaded: false,
  error: null,

  get key() { return Social.social?.authorKey || null; },
  mine() { return this.list.filter(ex => this.key && ex.key === this.key); },

  async load() {
    try {
      const snap = await col("communityExercises").orderBy("createdAt", "desc").limit(300).get();
      this.list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      this.error = null;
    } catch (err) { this.error = err?.code || "error"; }
    this.loaded = true;
    return this.list;
  },

  /** clé d'auteur anonyme, créée une fois pour toutes (les règles empêchent de la changer) */
  async ensureKey() {
    if (this.key) return this.key;
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    const key = Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
    await ref(`social/${Social.uid}`).set({ authorKey: key }, { merge: true });
    Social.social = { ...(Social.social || {}), authorKey: key };
    return key;
  },

  async publish(exercise) {
    if (!Social.joined) throw fail("not-joined");
    if (navigator.onLine === false) throw fail("offline");
    const key = await this.ensureKey();
    const taken = new Set((await col("communityExercises").where("key", "==", key).get()).docs.map(d => d.id));
    let slot = 0;
    for (let n = 1; n <= COMMUNITY_LIMIT; n++) if (!taken.has(`${key}_${n}`)) { slot = n; break; }
    if (!slot) throw fail("limit");
    const { id: _localId, ...fields } = shareableExercise(exercise);
    const data = { key, ...fields, createdAt: Date.now() };
    await ref(`communityExercises/${key}_${slot}`).set(data);
    this.list = [{ id: `${key}_${slot}`, ...data }, ...this.list];
    return `${key}_${slot}`;
  },

  async remove(id) {
    await ref(`communityExercises/${id}`).delete();
    this.list = this.list.filter(ex => ex.id !== id);
  },

  async removeAll() {
    if (!this.key) return;
    const snap = await col("communityExercises").where("key", "==", this.key).get().catch(() => null);
    if (!snap?.docs.length) return;
    const batch = firestore.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    this.list = this.list.filter(ex => ex.key !== this.key);
  }
};
