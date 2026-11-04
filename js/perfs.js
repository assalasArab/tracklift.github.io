/* ═══════════════════════════════════════════════════════════
   Perfs entre potes (charges et répétitions) :
   1. sur demande : un pote demande, tu acceptes (ou tu l'autorises de toi-même) ;
   2. dans un programme en commun : chacun choisit de montrer ses perfs
      sur les exercices du programme, et voit celles des autres s'il montre les siennes ;
   3. défis sur un exercice : la meilleure série de chacun depuis le début du défi.
   Rien n'est partagé tant que l'utilisateur ne l'a pas choisi.
   La sécurité est assurée par firestore.rules.
   ═══════════════════════════════════════════════════════════ */
import { firestore } from "./firebase-config.js?v=20261104f";
import { Social } from "./social.js?v=20261104f";

const ref = path => firestore.doc(path);
const col = path => firestore.collection(path);
const clip = (text, n) => String(text || "").slice(0, n);
const DAY = 86400000;
const MAX_EXERCISES = 80;
function fail(code) { const e = new Error(code); e.code = code; return e; }

/* ─── Calculs (purs) ───────────────────────────────────── */
const workSets = ex => (ex?.sets || []).filter(s => s && s.status === "done" && s.kind !== "warmup" && s.kind !== "drop" && Number(s.reps) > 0)
  .map(s => ({ kg: Math.max(0, Number(s.weight) || 0), r: Math.round(Number(s.reps)) }));
const better = (a, b) => !b || a.kg > b.kg || (a.kg === b.kg && a.r > b.r);

/**
 * Perfs par exercice : meilleure série (charge la plus lourde, puis le plus de répétitions)
 * et la meilleure série de la dernière séance. ids : limiter à ces exercices.
 * → { idExercice: { n, kg, r, t, lkg, lr, lt, c } }
 */
export function perfsOf(logs, { ids = null, nameOf = id => id, limit = MAX_EXERCISES } = {}) {
  const wanted = ids ? new Set(ids) : null;
  const map = new Map();
  for (const log of [...(logs || [])].sort((a, b) => a.date - b.date)) {
    for (const ex of log.exercises || []) {
      if (!ex?.exerciseId || (wanted && !wanted.has(ex.exerciseId))) continue;
      const sets = workSets(ex);
      if (!sets.length) continue;
      const top = sets.reduce((best, s) => (better(s, best) ? s : best), null);
      const entry = map.get(ex.exerciseId) || { best: null, bestT: 0, last: null, lastT: 0, count: 0 };
      if (better(top, entry.best)) { entry.best = top; entry.bestT = log.date; }
      entry.last = top;
      entry.lastT = log.date;
      entry.count += 1;
      map.set(ex.exerciseId, entry);
    }
  }
  const sorted = [...map.entries()].sort((a, b) => b[1].count - a[1].count || b[1].lastT - a[1].lastT).slice(0, limit);
  return Object.fromEntries(sorted.map(([id, e]) => [id, {
    n: clip(nameOf(id), 60), kg: e.best.kg, r: e.best.r, t: e.bestT, lkg: e.last.kg, lr: e.last.r, lt: e.lastT, c: e.count
  }]));
}

/** Résultat d'un défi : meilleure série sur l'exercice entre le début et la fin du défi */
export function challengeResult(logs, challenge) {
  let best = null;
  let at = 0;
  for (const log of logs || []) {
    if (log.date < challenge.startsAt || (challenge.endsAt && log.date > challenge.endsAt)) continue;
    for (const ex of log.exercises || []) {
      if (ex.exerciseId !== challenge.exerciseId) continue;
      for (const s of workSets(ex)) {
        const wins = challenge.metric === "reps" ? (!best || s.r > best.r || (s.r === best.r && s.kg > best.kg)) : better(s, best);
        if (wins) { best = s; at = log.date; }
      }
    }
  }
  if (!best) return null;
  return { value: challenge.metric === "reps" ? best.r : best.kg, kg: Math.min(1000, best.kg), r: Math.min(1000, best.r), t: at };
}

/** Classement d'un défi : meilleur d'abord (à égalité, le plus de répétitions ou la plus lourde, puis le plus tôt) */
export function challengeRanking(members, metric) {
  const done = members.filter(m => Number.isFinite(m.value));
  const key = m => (metric === "reps" ? [m.value, m.kg || 0] : [m.value, m.r || 0]);
  done.sort((a, b) => key(b)[0] - key(a)[0] || key(b)[1] - key(a)[1] || (a.t || 0) - (b.t || 0));
  return done.map((m, i) => ({ ...m, place: 1 + done.slice(0, i).filter(o => key(o)[0] > key(m)[0] || (key(o)[0] === key(m)[0] && key(o)[1] > key(m)[1])).length }));
}

/* ─── 1. Perfs sur demande ─────────────────────────────── */
export const Perfs = {
  /** uids qui voient mes perfs / dont je vois les perfs / demandes reçues et envoyées (écoute en direct dans social.js) */
  get viewers() { return Social.perfViewers; },
  get visible() { return Social.perfVisible; },
  get requestsIn() { return Social.perfReqIn; },
  get requestsOut() { return Social.perfReqOut; },
  canSee(uid) { return this.visible.includes(uid); },
  sees(uid) { return this.viewers.includes(uid); },
  asked(uid) { return this.requestsOut.some(r => r.to === uid); },
  askedMe(uid) { return this.requestsIn.some(r => r.from === uid); },

  async request(uid) {
    if (navigator.onLine === false) throw fail("offline");
    await ref(`perfRequests/${Social.uid}_${uid}`).set({ from: Social.uid, to: uid, createdAt: Date.now() });
  },
  cancelRequest(uid) { return ref(`perfRequests/${Social.uid}_${uid}`).delete(); },
  refuse(fromUid) { return ref(`perfRequests/${fromUid}_${Social.uid}`).delete(); },

  /** Autoriser un pote (en réponse à sa demande ou de soi-même) ; mes perfs partent tout de suite */
  async grant(uid, publish) {
    if (navigator.onLine === false) throw fail("offline");
    await publish?.(true);
    await ref(`perfAccess/${Social.uid}_${uid}`).set({ owner: Social.uid, viewer: uid, createdAt: Date.now() });
    if (this.askedMe(uid)) await this.refuse(uid).catch(() => {});
  },
  /** Retirer l'autorisation ; plus personne : mes perfs sont effacées */
  async revoke(uid) {
    await ref(`perfAccess/${Social.uid}_${uid}`).delete();
    if (!this.viewers.filter(v => v !== uid).length) await ref(`perfs/${Social.uid}`).delete().catch(() => {});
  },
  /** Ne plus suivre les perfs d'un pote */
  stopViewing(ownerUid) { return ref(`perfAccess/${ownerUid}_${Social.uid}`).delete(); },

  _lastMine: null,
  /** Écrit mes perfs si quelqu'un a le droit de les voir (force : même sans changement) */
  async publishMine(list, force = false) {
    if (!Social.joined) return;
    if (!force && !this.viewers.length) return;
    const signature = JSON.stringify(list);
    if (!force && signature === this._lastMine) return;
    await ref(`perfs/${Social.uid}`).set({ list, updatedAt: Date.now() });
    this._lastMine = signature;
  },

  async read(ownerUid) {
    const snap = await ref(`perfs/${ownerUid}`).get();
    return snap.exists ? snap.data() : null;
  },

  /* ─── 2. Perfs dans un programme en commun ─── */
  /** programmes où je montre mes perfs : { idPartagé: true } (privé, dans social/<uid>) */
  get programs() { return Social.social?.progPerfs || {}; },
  showing(programId) { return !!this.programs[programId]; },
  _lastProgram: {},

  async setProgram(programId, on, list) {
    if (navigator.onLine === false) throw fail("offline");
    const docRef = ref(`sharedPrograms/${programId}/perfs/${Social.uid}`);
    if (on) { await docRef.set({ list: list || {}, updatedAt: Date.now() }); this._lastProgram[programId] = JSON.stringify(list || {}); }
    else { await docRef.delete().catch(() => {}); delete this._lastProgram[programId]; }
    const next = { ...this.programs };
    if (on) next[programId] = true;
    else delete next[programId];
    await this._saveIndex({ progPerfs: next });
  },

  /** Après une séance : mes perfs à jour dans chaque programme où je les montre */
  async pushPrograms(listOf) {
    if (!Social.joined || navigator.onLine === false) return;
    for (const programId of Object.keys(this.programs)) {
      const list = listOf(programId);
      if (!list) continue;
      const signature = JSON.stringify(list);
      if (this._lastProgram[programId] === signature) continue;
      try {
        await ref(`sharedPrograms/${programId}/perfs/${Social.uid}`).set({ list, updatedAt: Date.now() });
        this._lastProgram[programId] = signature;
      } catch (err) { console.warn("[TrackLift] perfs du programme :", err?.code || err); }
    }
  },

  /** Perfs des membres (lisibles seulement si je montre les miennes) */
  async programPerfs(programId) {
    const snap = await col(`sharedPrograms/${programId}/perfs`).get();
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  },

  async _saveIndex(patch) {
    Social.social = { ...(Social.social || {}), ...patch };
    await ref(`social/${Social.uid}`).set(patch, { mergeFields: Object.keys(patch) });
    Social._emit();
  },

  /* ─── 3. Défis ─── */
  /** mes défis : { idDéfi: { name, exerciseId, metric, endsAt } } (privé, dans social/<uid>) */
  get challenges() { return Social.social?.challenges || {}; },

  async createChallenge({ exerciseId, name, metric, days }, resultOf) {
    if (!Social.joined) throw fail("not-joined");
    if (navigator.onLine === false) throw fail("offline");
    const id = col("challenges").doc().id;
    const now = Date.now();
    const challenge = {
      owner: Social.uid, exerciseId: clip(exerciseId, 80), name: clip(name, 60) || "exercice",
      metric: metric === "reps" ? "reps" : "weight", days: [7, 14, 30].includes(days) ? days : 0,
      startsAt: now, endsAt: [7, 14, 30].includes(days) ? now + days * DAY : null, createdAt: now
    };
    await ref(`challenges/${id}`).set(challenge);
    await ref(`challenges/${id}/members/${Social.uid}`).set({ joinedAt: now, ...(resultOf({ id, ...challenge }) || {}), updatedAt: now });
    await this._saveIndex({ challenges: { ...this.challenges, [id]: { name: challenge.name, exerciseId: challenge.exerciseId, metric: challenge.metric, startsAt: challenge.startsAt, endsAt: challenge.endsAt } } });
    return { id, ...challenge };
  },

  async getChallenge(id) {
    try { const snap = await ref(`challenges/${id}`).get(); return snap.exists ? { id, ...snap.data() } : null; }
    catch { return null; }
  },
  async challengeMembers(id) {
    try { return (await col(`challenges/${id}/members`).get()).docs.map(d => ({ uid: d.id, ...d.data() })); }
    catch { return null; }
  },

  isInvited(challengeId, uid) { return Social.challengeInvitesOut.some(inv => inv.challengeId === challengeId && inv.to === uid); },
  async invite(challengeId, name, uid) {
    if (navigator.onLine === false) throw fail("offline");
    await ref(`challengeInvites/${challengeId}_${uid}`).set({ challengeId, name: clip(name, 60), from: Social.uid, to: uid, createdAt: Date.now() });
  },
  cancelInvite(challengeId, uid) { return ref(`challengeInvites/${challengeId}_${uid}`).delete(); },
  decline(invite) { return ref(`challengeInvites/${invite.id}`).delete(); },

  /** Accepter : j'entre dans le défi avec mon résultat, puis l'invitation est retirée */
  async accept(invite, resultOf) {
    if (navigator.onLine === false) throw fail("offline");
    const challenge = await this.getChallenge(invite.challengeId);
    if (!challenge) { await this.decline(invite).catch(() => {}); throw fail("gone"); }
    const now = Date.now();
    await ref(`challenges/${challenge.id}/members/${Social.uid}`).set({ joinedAt: now, ...(resultOf(challenge) || {}), updatedAt: now });
    await this.decline(invite).catch(() => {});
    await this._saveIndex({ challenges: { ...this.challenges, [challenge.id]: { name: challenge.name, exerciseId: challenge.exerciseId, metric: challenge.metric, startsAt: challenge.startsAt, endsAt: challenge.endsAt } } });
    return challenge;
  },

  /** Quitter un défi (l'auteur le supprime pour tout le monde) */
  async leave(challenge) {
    if (challenge.owner === Social.uid) {
      const members = await col(`challenges/${challenge.id}/members`).get().catch(() => ({ docs: [] }));
      const batch = firestore.batch();
      members.docs.forEach(d => batch.delete(d.ref));
      batch.delete(ref(`challenges/${challenge.id}`));
      await batch.commit();
    } else {
      await ref(`challenges/${challenge.id}/members/${Social.uid}`).delete().catch(() => {});
    }
    const next = { ...this.challenges };
    delete next[challenge.id];
    await this._saveIndex({ challenges: next });
  },
  /** Défi disparu (supprimé par son auteur) : on l'oublie */
  async forget(id) {
    const next = { ...this.challenges };
    delete next[id];
    await this._saveIndex({ challenges: next });
  },

  _lastResult: {},
  /** Après une séance : mon résultat à jour dans chaque défi en cours */
  async pushChallenges(resultOf) {
    if (!Social.joined || navigator.onLine === false) return;
    for (const [id, info] of Object.entries(this.challenges)) {
      if (info.endsAt && info.endsAt < Date.now() - DAY) continue; // défi terminé : le résultat ne bouge plus
      const result = resultOf({ id, ...info });
      if (!result) continue;
      const signature = JSON.stringify(result);
      if (this._lastResult[id] === signature) continue;
      try {
        await ref(`challenges/${id}/members/${Social.uid}`).update({ ...result, updatedAt: Date.now() });
        this._lastResult[id] = signature;
      } catch (err) { console.warn("[TrackLift] défi :", err?.code || err); }
    }
  },

  /* ─── Départ de la partie Potes : tout est retiré ─── */
  async removeAll() {
    const me = Social.uid;
    const [reqIn, reqOut, accOwner, accViewer, invIn, invOut] = await Promise.all([
      col("perfRequests").where("to", "==", me).get(),
      col("perfRequests").where("from", "==", me).get(),
      col("perfAccess").where("owner", "==", me).get(),
      col("perfAccess").where("viewer", "==", me).get(),
      col("challengeInvites").where("to", "==", me).get(),
      col("challengeInvites").where("from", "==", me).get()
    ].map(p => p.catch(() => ({ docs: [] }))));
    const doomed = [reqIn, reqOut, accOwner, accViewer, invIn, invOut].flatMap(s => s.docs.map(d => d.ref));
    for (let i = 0; i < doomed.length; i += 400) {
      const batch = firestore.batch();
      doomed.slice(i, i + 400).forEach(r => batch.delete(r));
      await batch.commit();
    }
    await ref(`perfs/${me}`).delete().catch(() => {});
    for (const programId of Object.keys(this.programs)) await ref(`sharedPrograms/${programId}/perfs/${me}`).delete().catch(() => {});
    for (const id of Object.keys(this.challenges)) {
      const challenge = await this.getChallenge(id);
      if (challenge) await this.leave(challenge).catch(() => {});
    }
    await this._saveIndex({ progPerfs: {}, challenges: {} });
  }
};
