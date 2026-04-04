import { uid } from "./utils.js";
import { EXERCISE_SEED } from "./exercises.js";
import { firestore } from "./firebase-config.js";

export const DB = {
  currentUserId: null,
  _cache: null,

  setUser(userId) { this.currentUserId = userId; },

  /** Charge les donnees Firestore dans le cache memoire */
  async initCloud(userId) {
    this.currentUserId = userId;
    const docRef = firestore.collection("users").doc(userId);
    try {
      const doc = await docRef.get();
      if (doc.exists) {
        const raw = doc.data();
        // Ne garder que les champs utiles (exclure exercises stockes par erreur)
        this._cache = {
          profile: raw.profile || null,
          programs: raw.programs || [],
          sessionLogs: raw.sessionLogs || [],
          weightLog: raw.weightLog || [],
          createdAt: raw.createdAt || Date.now()
        };
        // Nettoyer le document Firestore si exercises etait stocke dedans
        if (raw.exercises) {
          console.log("[TrackLift] nettoyage exercises du document Firestore");
          this._saveToCloud();
        }
      } else {
        this._cache = {
          profile: null,
          programs: [],
          sessionLogs: [],
          weightLog: [],
          createdAt: Date.now()
        };
        await docRef.set(this._cache);
      }
    } catch (err) {
      console.error("[TrackLift] Firestore load error:", err);
      this._cache = {
        profile: null,
        programs: [],
        sessionLogs: [],
        weightLog: [],
        createdAt: Date.now()
      };
    }
    // Les exercices viennent toujours du SEED local
    this._cache.exercises = EXERCISE_SEED;
    return this._cache;
  },

  /** Ecrit le cache vers Firestore (fire-and-forget, sans les exercices) */
  _saveToCloud() {
    if (this.currentUserId && this._cache) {
      const { exercises, ...dataToSave } = this._cache;
      firestore.collection("users").doc(this.currentUserId)
        .set(dataToSave)
        .catch(err => console.error("Firestore save error:", err));
    }
  },

  // ─── Lecture (synchrone depuis le cache) ───────────────
  getData()       { return this._cache; },
  getProfile()    { return this._cache?.profile; },
  getPrograms()   { return this._cache?.programs || []; },
  getExercises()  { return this._cache?.exercises || []; },
  getSessionLogs(){ return [...(this._cache?.sessionLogs || [])].sort((a, b) => b.date - a.date); },
  getWeightLog()  { return [...(this._cache?.weightLog || [])].sort((a, b) => a.date - b.date); },

  // ─── Ecriture (cache + Firestore) ─────────────────────
  saveData(data) {
    this._cache = data;
    this._saveToCloud();
  },

  addWeight(weight) {
    const data = this.getData();
    data.weightLog.push({ id: uid(), date: Date.now(), weight });
    this.saveData(data);
    return data.weightLog;
  },

  createProgram({ name, description }) {
    const data = this.getData();
    const program = { id: uid(), name, description, sessions: [], createdAt: Date.now() };
    data.programs.push(program);
    this.saveData(data);
    return program;
  },

  saveSessionLog(log) {
    const data = this.getData();
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
      weightLog: data.weightLog,
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
