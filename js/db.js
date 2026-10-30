import { uid } from "./utils.js?v=20261030b";
import { EXERCISE_SEED } from "./exercises.js?v=20261030b";
import { EXTRA_EXERCISES } from "./exercises-extra.js?v=20261030b";
import { firestore } from "./firebase-config.js?v=20261030b";

/* ═══════════════════════════════════════════════════════════
   Données de l'utilisateur.
   - users/<uid> : un document (programmes, séances, nutrition…), gardé en mémoire.
   - users/<uid>/days/<AAAA-MM-JJ> : un petit document par jour (pesée, kcal).
     Une pesée ne peut donc plus être effacée par une autre fenêtre qui réécrit le gros document.
   Protections :
   - chaque fenêtre ouverte écoute le document : un changement fait ailleurs arrive tout seul ;
   - si quelqu'un d'autre a enregistré entre-temps, on garde aussi ce qu'il a ajouté ;
   - si le chargement a échoué, on n'écrit rien (jamais un document vide à la place des données) ;
   - les valeurs « undefined » sont retirées (Firestore refuse tout le document sinon).
   ═══════════════════════════════════════════════════════════ */

const INSTANCE = `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
const LIST_KEYS = ["programs", "sessionLogs", "weightLog", "customExercises", "purchases"];

/** Jour local au format AAAA-MM-JJ */
export function localDayKey(date = Date.now()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const noonOf = key => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d, 12).getTime(); };

/** Retire les undefined (refusés par Firestore) et les nombres impossibles */
function clean(value) {
  if (Array.isArray(value)) return value.map(item => (item === undefined ? null : clean(item)));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) if (item !== undefined) out[key] = clean(item);
    return out;
  }
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}

function fromRaw(raw) {
  return {
    profile: raw.profile || null,
    programs: raw.programs || [],
    sessionLogs: raw.sessionLogs || [],
    weightLog: raw.weightLog || [],
    nutrition: raw.nutrition || null,
    exerciseDb: raw.exerciseDb || null,
    customExercises: raw.customExercises || [],
    notion: raw.notion || null,
    purchases: raw.purchases || [],
    deletedIds: raw.deletedIds || [],
    createdAt: raw.createdAt || Date.now()
  };
}

const emptyData = () => ({ profile: null, programs: [], sessionLogs: [], weightLog: [], customExercises: [], purchases: [], deletedIds: [], createdAt: Date.now() });

/* Supprimés (séance, programme, exercice perso) : gardés quelques mois pour qu'une fusion ne les fasse pas revenir */
function tombstones(...docs) {
  const map = new Map();
  for (const doc of docs) for (const item of doc?.deletedIds || []) {
    if (item?.id) map.set(item.id, Math.max(map.get(item.id) || 0, Number(item.at) || 0));
  }
  return map;
}
function pruneTombstones(map) {
  const limit = Date.now() - 120 * 86400000;
  return [...map.entries()].filter(([, at]) => at >= limit).sort((a, b) => a[1] - b[1]).slice(-300).map(([id, at]) => ({ id, at }));
}
const idsOf = list => new Set((list || []).map(item => item?.id).filter(Boolean));

/**
 * Fusion de deux versions du document : rien d'ajouté n'est perdu, rien de supprimé ne revient.
 * « primary » gagne pour un même élément et pour le reste (profil, nutrition…).
 */
function mergeDocs(primary, secondary, extraDeleted = new Set()) {
  const tomb = tombstones(primary, secondary);
  extraDeleted.forEach(id => { if (!tomb.has(id)) tomb.set(id, Date.now()); });
  const out = { ...primary };
  for (const key of LIST_KEYS) {
    const own = primary[key] || [];
    const seen = new Set();
    const list = [];
    for (const item of [...own, ...(secondary[key] || [])]) {
      const id = item?.id;
      if (id) {
        if (tomb.has(id) || seen.has(id)) continue;
        seen.add(id);
      } else if (!own.includes(item)) continue; // sans identifiant : seulement ceux de la version principale
      list.push(item);
    }
    out[key] = list;
  }
  out.deletedIds = pruneTombstones(tomb);
  return out;
}

const RETRYABLE = new Set(["unavailable", "failed-precondition", "deadline-exceeded", "aborted"]);

export const DB = {
  currentUserId: null,
  _cache: null,
  _days: new Map(),       // AAAA-MM-JJ → { date, weight, kcal, weighedAt, updatedAt }
  loadFailed: false,
  _baseSavedAt: 0,        // version du document sur laquelle repose la mémoire
  _deleted: new Set(),    // supprimés pendant cette visite (à ne pas faire revenir en fusionnant)
  _saving: false,
  _dirty: false,
  _unsubs: [],
  saveError: null,
  onRemoteChange: null,   // (kind) => …  appelé quand une autre fenêtre / un autre appareil a changé les données
  onSaveState: null,      // (state, error) => …  "ok" | "error" | "blocked"

  setUser(userId) { this.currentUserId = userId; },

  _doc() { return firestore.collection("users").doc(this.currentUserId); },
  _daysCol() { return this._doc().collection("days"); },

  /** Charge les données Firestore dans le cache mémoire */
  async initCloud(userId) {
    this.stopListening();
    this.currentUserId = userId;
    this._days = new Map();
    this._deleted = new Set();
    this.loadFailed = false;
    this.saveError = null;
    this._baseSavedAt = 0;
    const docRef = this._doc();
    try {
      const doc = await docRef.get();
      if (doc.exists) {
        const raw = doc.data();
        // Ne garder que les champs utiles (exclure exercises stockes par erreur)
        this._cache = fromRaw(raw);
        this._baseSavedAt = raw.savedAt || 0;
        // Nettoyer le document Firestore si exercises etait stocke dedans
        if (raw.exercises) {
          console.log("[TrackLift] nettoyage exercises du document Firestore");
          this._saveToCloud();
        }
      } else {
        this._cache = emptyData();
        const savedAt = Date.now();
        await docRef.set({ ...this._cache, savedAt, savedBy: INSTANCE });
        this._baseSavedAt = savedAt;
      }
    } catch (err) {
      // chargement impossible : on travaille sur une copie vide MAIS on n'écrit rien
      console.error("[TrackLift] Firestore load error:", err);
      this.loadFailed = true;
      this._cache = emptyData();
    }
    try {
      const days = await this._daysCol().get();
      days.forEach(snap => this._days.set(snap.id, snap.data()));
    } catch (err) {
      console.warn("[TrackLift] jours (pesées, kcal) indisponibles :", err?.code || err);
    }
    // Les exercices viennent toujours du SEED local
    this._cache.exercises = [...EXERCISE_SEED, ...EXTRA_EXERCISES];
    return this._cache;
  },

  /** Écoute en direct : les changements faits dans une autre fenêtre ou sur un autre appareil arrivent ici */
  listen(onRemoteChange) {
    this.stopListening();
    if (!this.currentUserId) return;
    this.onRemoteChange = onRemoteChange;
    this._unsubs.push(this._doc().onSnapshot(snap => {
      if (!snap.exists || snap.metadata.hasPendingWrites) return;
      const raw = snap.data();
      if (raw.savedBy === INSTANCE || (raw.savedAt || 0) === this._baseSavedAt) return;
      const remote = fromRaw(raw);
      const exercises = this._cache?.exercises || [...EXERCISE_SEED, ...EXTRA_EXERCISES];
      const recovered = this.loadFailed;
      // la version reçue gagne (c'est la plus récente), sauf si un enregistrement de notre part est en route ;
      // dans tous les cas, ce que nous avons et qu'elle n'a pas est gardé
      const pending = this._saving || this._dirty;
      const merged = recovered ? remote : pending ? mergeDocs(this._cache, remote, this._deleted) : mergeDocs(remote, this._cache, this._deleted);
      this._cache = { ...merged, exercises };
      this._baseSavedAt = raw.savedAt || 0;
      this.loadFailed = false;
      if (recovered) this.onSaveState?.("ok");
      this.onRemoteChange?.("main");
      // une vieille fenêtre a écrit sans nos derniers ajouts (ou avec des supprimés) : on corrige Firestore
      const differs = key => {
        const a = idsOf(merged[key]), b = idsOf(remote[key]);
        return a.size !== b.size || [...a].some(id => !b.has(id));
      };
      if (!recovered && LIST_KEYS.some(differs)) this._saveToCloud();
    }, err => console.warn("[TrackLift] écoute des données :", err?.code || err)));
    this._unsubs.push(this._daysCol().onSnapshot(snap => {
      let changed = false;
      snap.docChanges().forEach(change => {
        const before = JSON.stringify(this._days.get(change.doc.id) || null);
        if (change.type === "removed") this._days.delete(change.doc.id);
        else this._days.set(change.doc.id, change.doc.data());
        if (JSON.stringify(this._days.get(change.doc.id) || null) !== before) changed = true;
      });
      if (changed) this.onRemoteChange?.("days");
    }, err => console.warn("[TrackLift] écoute des jours :", err?.code || err)));
    // anciennes pesées (dans le gros document) recopiées une fois en documents du jour
    this._copyLegacyWeights();
  },

  stopListening() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
  },

  /** Écrit le cache vers Firestore (en arrière-plan, sans les exercices) */
  _saveToCloud() {
    if (!this.currentUserId || !this._cache) return;
    if (this.loadFailed) { this.onSaveState?.("blocked"); return; }
    this._dirty = true;
    if (!this._saving) this._flush();
  },

  /** Un enregistrement à la fois ; ceux demandés pendant ce temps sont regroupés */
  async _flush() {
    this._saving = true;
    while (this._dirty) {
      this._dirty = false;
      try {
        await this._write();
        if (this.saveError) { this.saveError = null; this.onSaveState?.("ok"); }
      } catch (err) {
        console.error("Firestore save error:", err);
        this.saveError = err;
        this.onSaveState?.("error", err);
        break;
      }
    }
    this._saving = false;
  },

  async _write() {
    const docRef = this._doc();
    const savedAt = Date.now();
    const payload = () => {
      const { exercises, ...data } = this._cache;
      return clean({ ...data, savedAt, savedBy: INSTANCE });
    };
    // hors ligne : l'écriture attend dans le téléphone et partira toute seule au retour du réseau
    if (navigator.onLine === false) {
      docRef.set(payload()).catch(err => console.error("Firestore save error:", err));
      this._baseSavedAt = savedAt;
      return;
    }
    let merged = false;
    try {
      await firestore.runTransaction(async tx => {
        const snap = await tx.get(docRef);
        const server = snap.exists ? snap.data() : null;
        if (server && (server.savedAt || 0) !== this._baseSavedAt && server.savedBy !== INSTANCE) {
          // quelqu'un d'autre a enregistré depuis : on garde aussi ce qu'il a ajouté
          this._cache = { ...mergeDocs(this._cache, fromRaw(server), this._deleted), exercises: this._cache.exercises };
          merged = true;
        }
        tx.set(docRef, payload());
      });
    } catch (err) {
      if (!RETRYABLE.has(err?.code)) throw err;
      // réseau capricieux : écriture simple, elle partira dès que possible
      docRef.set(payload()).catch(e => console.error("Firestore save error:", e));
    }
    this._baseSavedAt = savedAt;
    if (merged) this.onRemoteChange?.("main");
  },

  /** À appeler quand on retire un élément d'une liste (pour qu'une fusion ne le fasse pas revenir) */
  markDeleted(id) {
    if (!id || !this._cache) return;
    this._deleted.add(id);
    const list = (this._cache.deletedIds || []).filter(item => item.id !== id);
    list.push({ id, at: Date.now() });
    this._cache.deletedIds = list.slice(-300);
  },

  /** Élément remis (annulation d'une suppression) */
  unmarkDeleted(id) {
    this._deleted.delete(id);
    if (this._cache?.deletedIds) this._cache.deletedIds = this._cache.deletedIds.filter(item => item.id !== id);
  },

  // ─── Lecture (synchrone depuis le cache) ───────────────
  getData()       { return this._cache; },
  getProfile()    { return this._cache?.profile; },
  getPrograms()   { return this._cache?.programs || []; },
  getExercises()  { return [...(this._cache?.customExercises || []), ...(this._cache?.exercises || [])]; },
  getCustomExercises() { return this._cache?.customExercises || []; },
  getSessionLogs(){ return [...(this._cache?.sessionLogs || [])].sort((a, b) => b.date - a.date); },
  getNutrition()  { return this._cache?.nutrition || null; },
  getNotion()     { return this._cache?.notion || null; },
  /** Pièces débloquées dans la boutique : [{ id: "hair:c6", price, at }] */
  getPurchases()  { return this._cache?.purchases || []; },

  /** Pesées, une par jour : documents du jour, complétés par les anciennes pesées du gros document */
  getWeightLog() {
    const byDay = new Map();
    for (const item of this._cache?.weightLog || []) {
      if (!item || !Number(item.weight)) continue;
      const key = localDayKey(item.date);
      const previous = byDay.get(key);
      if (!previous || item.date > previous.date) byDay.set(key, { id: item.id, date: item.date, weight: item.weight });
    }
    for (const [key, day] of this._days) {
      if (day?.weight == null) continue;
      byDay.set(key, { id: `day-${key}`, date: day.weighedAt || noonOf(key), weight: day.weight });
    }
    return [...byDay.values()].sort((a, b) => a.date - b.date);
  },

  /** Données d'un jour : { weight, kcal } (null si rien) */
  getDay(key = localDayKey()) { return this._days.get(key) || null; },

  /** Les derniers jours renseignés (pesée ou kcal), du plus récent au plus ancien */
  getRecentDays(count = 14) {
    const keys = new Set([...this._days.keys(), ...this.getWeightLog().map(item => localDayKey(item.date))]);
    const weights = new Map(this.getWeightLog().map(item => [localDayKey(item.date), item.weight]));
    return [...keys].sort().reverse().slice(0, count).map(key => ({
      key, weight: weights.get(key) ?? null, kcal: this._days.get(key)?.kcal ?? null
    })).filter(day => day.weight != null || day.kcal != null);
  },

  /** Enregistre la pesée et / ou les kcal d'un jour (un petit document, jamais écrasé par une autre fenêtre) */
  setDay(key, patch) {
    const next = clean({ ...(this._days.get(key) || {}), ...patch, date: key, updatedAt: Date.now() });
    this._days.set(key, next);
    if (!this.currentUserId) return next;
    this._daysCol().doc(key).set(next, { merge: true }).catch(err => {
      console.error("[TrackLift] jour non enregistré :", err);
      // règles pas encore mises à jour : la pesée part quand même, dans l'ancien format
      if (err?.code === "permission-denied" && patch.weight != null && this._cache) {
        const list = (this._cache.weightLog || []).filter(item => localDayKey(item.date) !== key);
        list.push({ id: `w-${key}`, date: next.weighedAt || Date.now(), weight: Number(patch.weight) });
        this._cache.weightLog = list;
        this._saveToCloud();
        return;
      }
      this.onSaveState?.("error", err);
    });
    return next;
  },

  /** Recopie les pesées de l'ancien format vers les documents du jour (une seule fois par jour manquant) */
  _copyLegacyWeights() {
    if (this.loadFailed || !this.currentUserId) return;
    const missing = new Map();
    for (const item of this._cache?.weightLog || []) {
      if (!item || !Number(item.weight)) continue;
      const key = localDayKey(item.date);
      if (this._days.has(key)) continue;
      const previous = missing.get(key);
      if (!previous || item.date > previous.weighedAt) missing.set(key, { date: key, weight: Number(item.weight), weighedAt: item.date, updatedAt: Date.now() });
    }
    const entries = [...missing.entries()];
    for (let i = 0; i < entries.length; i += 400) {
      const batch = firestore.batch();
      entries.slice(i, i + 400).forEach(([key, day]) => {
        this._days.set(key, day);
        batch.set(this._daysCol().doc(key), day, { merge: true });
      });
      batch.commit().catch(err => console.warn("[TrackLift] recopie des pesées :", err?.code || err));
    }
  },

  // ─── Ecriture (cache + Firestore) ─────────────────────
  saveData(data) {
    this._cache = data;
    this._saveToCloud();
  },

  /** Une seule pesée par jour : remplace celle du jour si elle existe déjà */
  setDayWeight(weight) {
    this.setDay(localDayKey(), { weight: Number(weight), weighedAt: Date.now() });
    return this.getWeightLog();
  },

  addWeight(weight) { return this.setDayWeight(weight); },

  /** Kcal mangées aujourd'hui (null pour effacer) */
  setDayKcal(kcal, key = localDayKey()) {
    this.setDay(key, { kcal: kcal == null ? null : Math.round(Number(kcal)) });
  },

  /** Débloque une pièce (une seule fois par pièce) */
  addPurchase(item) {
    const data = this.getData();
    if (!data || (data.purchases || []).some(p => p.id === item.id)) return false;
    data.purchases = [...(data.purchases || []), item];
    this.saveData(data);
    return true;
  },

  /** Connexion Notion de l'utilisateur (jeton OAuth) ; null = déconnecté. Exclue de l'export JSON. */
  setNotion(connection) {
    const data = this.getData();
    if (!data) return;
    data.notion = connection || null;
    this.saveData(data);
  },

  saveNutrition(profile) {
    const data = this.getData();
    if (!data) return;
    data.nutrition = profile || null;
    this.saveData(data);
  },

  /** Ajoute ou remplace un exercice personnel */
  saveCustomExercise(exercise) {
    const data = this.getData();
    const list = (data.customExercises || []).filter(item => item.id !== exercise.id);
    data.customExercises = [exercise, ...list];
    this.saveData(data);
    return exercise;
  },

  /** Supprime un exercice personnel et le retire des séances de programme */
  deleteCustomExercise(id) {
    const data = this.getData();
    this.markDeleted(id);
    data.customExercises = (data.customExercises || []).filter(item => item.id !== id);
    (data.programs || []).forEach(program => (program.sessions || []).forEach(session => {
      session.exerciseIds = (session.exerciseIds || []).filter(item => item !== id);
      if (session.plan) delete session.plan[id];
    }));
    this.saveData(data);
  },

  createProgram({ name, description }) {
    const data = this.getData();
    const program = { id: uid(), name, description, sessions: [], createdAt: Date.now() };
    data.programs.push(program);
    this.saveData(data);
    return program;
  },

  addProgram(program) {
    const data = this.getData();
    data.programs.push(program);
    this.saveData(data);
    return program;
  },

  /** Supprime un programme */
  deleteProgram(id) {
    const data = this.getData();
    this.markDeleted(id);
    data.programs = (data.programs || []).filter(program => program.id !== id);
    this.saveData(data);
  },

  addSessionLogs(logs) {
    const data = this.getData();
    data.sessionLogs.push(...logs);
    this.saveData(data);
    return logs.length;
  },

  updateProfile(patch) {
    const data = this.getData();
    data.profile = { ...(data.profile || {}), ...patch };
    this.saveData(data);
    return data.profile;
  },

  /** Retire une séance de l'historique et la renvoie (pour pouvoir l'annuler) */
  deleteSessionLog(id) {
    const data = this.getData();
    const index = data.sessionLogs.findIndex(log => log.id === id);
    if (index < 0) return null;
    const [removed] = data.sessionLogs.splice(index, 1);
    this.markDeleted(id);
    this.saveData(data);
    return removed;
  },

  saveSessionLog(log) {
    const data = this.getData();
    this.unmarkDeleted(log.id); // séance remise (annulation) : elle peut revenir
    data.sessionLogs.push(log);
    this.saveData(data);
    return log;
  },

  exportCurrentData() {
    const data = this.getData();
    return {
      profile: data.profile,
      programs: data.programs,
      sessionLogs: data.sessionLogs,
      weightLog: this.getWeightLog(),
      days: [...this._days.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))),
      nutrition: data.nutrition || null,
      customExercises: data.customExercises || [],
      exportDate: new Date().toISOString()
    };
  },

  // ─── Migration localStorage → Firestore ───────────────
  async migrateFromLocal() {
    let migrated = false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("tracklift_data_")) continue;
      try {
        const localData = JSON.parse(localStorage.getItem(key));
        if (!localData) continue;
        const data = this.getData();
        if (localData.programs?.length)    data.programs    = [...data.programs, ...localData.programs];
        if (localData.sessionLogs?.length) data.sessionLogs = [...data.sessionLogs, ...localData.sessionLogs];
        if (localData.weightLog?.length)   data.weightLog   = [...data.weightLog, ...localData.weightLog];
        this.saveData(data);
        localStorage.removeItem(key);
        migrated = true;
      } catch { /* ignore corrupt entries */ }
    }
    localStorage.removeItem("tracklift_users");
    localStorage.removeItem("tracklift_session");
    return migrated;
  }
};
