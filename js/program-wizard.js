/* ═══════════════════════════════════════════════════════════
   Assistant programme — questionnaire de départ + générateur.
   Pose quelques questions (objectif, niveau, fréquence, split,
   matériel, durée, charges de référence) puis construit un
   programme complet avec séries, répétitions et charges de départ.
   ═══════════════════════════════════════════════════════════ */
import { illu } from "./illustrations.js?v=20261030b";
import { showToast } from "./utils.js?v=20261030b";

/* ---------- bibliothèque de mouvements ----------
   gym / db / bw : exercice pour salle complète, haltères seuls, poids du corps (null = pas d'équivalent)
   ref / ratio   : charge = mouvement de référence × ratio (par haltère pour les variantes db)
   dbRatio       : ratio spécifique à la variante haltères */
const SLOTS = {
  bench:    { gym: "bench-press", db: "db-bench-press", bw: "push-up", ref: "bench", ratio: 1, dbRatio: 0.38 },
  incline:  { gym: "incline-db-press", db: "incline-db-press", bw: "decline-push-up", ref: "bench", ratio: 0.32, dbRatio: 0.32 },
  ohp:      { gym: "ohp", db: "dumbbell-shoulder-press", bw: "pike-push-ups", ref: "ohp", ratio: 1, dbRatio: 0.4 },
  lateral:  { gym: "lateral-raise", db: "lateral-raise", bw: null, ref: "ohp", ratio: 0.18, dbRatio: 0.18 },
  fly:      { gym: "cable-fly", db: "db-fly", bw: null, ref: "bench", ratio: 0.2, dbRatio: 0.14 },
  pushdown: { gym: "tricep-pushdown", db: "dumbbell-tricep-extension", bw: "bench-dips", ref: "bench", ratio: 0.35, dbRatio: 0.12 },
  overhead: { gym: "cable-overhead-tricep-extension", db: "overhead-tricep-extension", bw: "diamond-push-ups", ref: "bench", ratio: 0.28, dbRatio: 0.12 },
  dips:     { gym: "dips", db: "bench-dips", bw: "bench-dips", ref: null },
  squat:    { gym: "squat", db: "goblet-squat", bw: "bodyweight-squat", ref: "squat", ratio: 1, dbRatio: 0.3 },
  rdl:      { gym: "romanian-deadlift", db: "dumbbell-romanian-deadlift", bw: "single-leg-glute-bridge", ref: "deadlift", ratio: 0.6, dbRatio: 0.25 },
  deadlift: { gym: "deadlift", db: "dumbbell-deadlift", bw: "single-leg-glute-bridge", ref: "deadlift", ratio: 1, dbRatio: 0.25 },
  legpress: { gym: "leg-press", db: "db-lunge", bw: "walking-lunge", ref: "squat", ratio: 1.6, dbRatio: 0.18 },
  lunge:    { gym: "dumbbell-split-squat", db: "dumbbell-split-squat", bw: "split-squat", ref: "squat", ratio: 0.2, dbRatio: 0.2 },
  legcurl:  { gym: "leg-curl", db: "single-leg-romanian-deadlift", bw: "nordic-hamstring-curl", ref: "squat", ratio: 0.35, dbRatio: 0.2 },
  legext:   { gym: "leg-extension", db: null, bw: null, ref: "squat", ratio: 0.4 },
  calf:     { gym: "standing-calf-raise", db: "dumbbell-calf-raise", bw: "single-leg-calf-raise", ref: "squat", ratio: 0.6, dbRatio: 0.2 },
  hipthrust:{ gym: "hip-thrust", db: "dumbbell-hip-thrust", bw: "single-leg-glute-bridge", ref: "squat", ratio: 0.9, dbRatio: 0.3 },
  row:      { gym: "barbell-row", db: "single-arm-db-row", bw: "inverted-row", ref: "bench", ratio: 0.8, dbRatio: 0.35 },
  pulldown: { gym: "lat-pulldown", db: "pull-up", bw: "pull-up", ref: "bench", ratio: 0.7 },
  pullup:   { gym: "pull-up", db: "pull-up", bw: "pull-up", ref: null },
  cablerow: { gym: "seated-cable-row", db: "bent-over-db-row", bw: "inverted-row", ref: "bench", ratio: 0.7, dbRatio: 0.28 },
  facepull: { gym: "face-pull", db: "rear-delt-fly", bw: "superman", ref: "bench", ratio: 0.25, dbRatio: 0.08 },
  curl:     { gym: "barbell-curl", db: "bicep-curl", bw: "chin-ups", ref: "bench", ratio: 0.35, dbRatio: 0.15 },
  hammer:   { gym: "hammer-curl", db: "hammer-curl", bw: null, ref: "bench", ratio: 0.16, dbRatio: 0.16 },
  shrug:    { gym: "shrug", db: "db-shrug", bw: null, ref: "deadlift", ratio: 0.6, dbRatio: 0.25 },
  abs:      { gym: "hanging-leg-raise", db: "plank", bw: "plank", ref: null },
  crunch:   { gym: "cable-crunch", db: "plank", bw: "mountain-climbers", ref: null, cable: 0.3 }
};

const BODYWEIGHT_IDS = new Set(["push-up", "pull-up", "chin-ups", "inverted-row", "bench-dips", "dips", "diamond-push-ups",
  "plank", "hanging-leg-raise", "mountain-climbers", "decline-push-up", "pike-push-ups", "bodyweight-squat", "split-squat",
  "walking-lunge", "single-leg-glute-bridge", "nordic-hamstring-curl", "single-leg-calf-raise", "superman", "weighted-pull-up", "weighted-dips"]);

/* ---------- séances types (ordre = priorité ; on garde les N premiers selon la durée) ---------- */
const DAYS = {
  push:   { name: "Push", type: "push", slots: ["bench", "ohp", "incline", "lateral", "pushdown", "fly", "overhead"] },
  pull:   { name: "Pull", type: "pull", slots: ["row", "pulldown", "cablerow", "facepull", "curl", "hammer", "shrug"] },
  legs:   { name: "Legs", type: "legs", slots: ["squat", "rdl", "legpress", "legcurl", "calf", "legext", "abs"] },
  upperA: { name: "Haut A", type: "full", slots: ["bench", "row", "ohp", "pulldown", "lateral", "curl", "pushdown"] },
  lowerA: { name: "Bas A", type: "legs", slots: ["squat", "rdl", "lunge", "legcurl", "calf", "abs", "legext"] },
  upperB: { name: "Haut B", type: "full", slots: ["incline", "cablerow", "ohp", "pullup", "fly", "hammer", "overhead"] },
  lowerB: { name: "Bas B", type: "legs", slots: ["deadlift", "legpress", "hipthrust", "legext", "calf", "crunch", "legcurl"] },
  fullA:  { name: "Full body A", type: "full", slots: ["squat", "bench", "row", "ohp", "curl", "abs", "calf"] },
  fullB:  { name: "Full body B", type: "full", slots: ["deadlift", "incline", "pulldown", "lunge", "lateral", "pushdown", "crunch"] },
  fullC:  { name: "Full body C", type: "full", slots: ["legpress", "ohp", "cablerow", "rdl", "fly", "hammer", "abs"] },
  chest:  { name: "Pectoraux", type: "push", slots: ["bench", "incline", "fly", "dips", "pushdown", "overhead", "crunch"] },
  back:   { name: "Dos", type: "pull", slots: ["deadlift", "pulldown", "row", "cablerow", "shrug", "facepull", "abs"] },
  shoulders: { name: "Épaules", type: "push", slots: ["ohp", "lateral", "facepull", "shrug", "incline", "crunch", "abs"] },
  arms:   { name: "Bras", type: "full", slots: ["curl", "pushdown", "hammer", "overhead", "dips", "abs", "crunch"] }
};

const SPLITS = {
  full: { label: "Full body", sessions: days => days <= 2 ? ["fullA", "fullB"] : ["fullA", "fullB", "fullC"] },
  upper_lower: { label: "Haut / Bas", sessions: days => days <= 3 ? ["upperA", "lowerA"] : ["upperA", "lowerA", "upperB", "lowerB"] },
  ppl: { label: "Push / Pull / Legs", sessions: () => ["push", "pull", "legs"] },
  bro: { label: "Un groupe par séance", sessions: () => ["chest", "back", "legs", "shoulders", "arms"] }
};

function autoSplit(days) {
  if (days <= 3) return "full";
  if (days === 4) return "upper_lower";
  return "ppl";
}

/* séries × répétitions selon l'objectif ; f = facteur de charge par rapport à la charge "8 reps" */
const SCHEMES = {
  force:  { c: { sets: 5, reps: 5, f: 1.1 }, a: { sets: 3, reps: 8, f: 1 } },
  muscle: { c: { sets: 4, reps: 8, f: 1 }, a: { sets: 3, reps: 12, f: 0.85 } },
  seche:  { c: { sets: 4, reps: 8, f: 0.95 }, a: { sets: 3, reps: 12, f: 0.85 } },
  forme:  { c: { sets: 3, reps: 10, f: 0.9 }, a: { sets: 3, reps: 12, f: 0.8 } }
};

/* estimation d'une charge "8 répétitions" à partir du poids de corps quand l'utilisateur ne sait pas */
const BW_FACTORS = {
  debutant:      { bench: 0.55, squat: 0.75, deadlift: 0.95, ohp: 0.35 },
  intermediaire: { bench: 0.85, squat: 1.1, deadlift: 1.35, ohp: 0.55 },
  avance:        { bench: 1.15, squat: 1.45, deadlift: 1.8, ohp: 0.7 }
};

const EXERCISE_COUNT = { 45: 4, 60: 5, 75: 6, 90: 7 };

function roundLoad(kg) {
  if (kg <= 0) return 0;
  return kg < 20 ? Math.max(1, Math.round(kg)) : Math.round(kg / 2.5) * 2.5;
}

function referenceLoads(answers) {
  const bw = Number(answers.bodyweight) || 75;
  const f = BW_FACTORS[answers.level] || BW_FACTORS.intermediaire;
  const ref = { bench: 0, squat: 0, deadlift: 0, ohp: 0 };
  Object.keys(ref).forEach(k => { ref[k] = barbellEquivalent(answers, k); });
  if (!ref.ohp && ref.bench) ref.ohp = ref.bench * 0.62;
  if (!ref.deadlift && ref.squat) ref.deadlift = ref.squat * 1.2;
  if (!ref.squat && ref.deadlift) ref.squat = ref.deadlift * 0.82;
  Object.keys(ref).forEach(k => { if (!ref[k]) ref[k] = bw * f[k]; });
  return ref;
}

/* ═══════════ Mouvements de référence et leurs variantes ═══════════
   [identifiant, nom, précision de la charge] — la charge saisie est convertie
   en équivalent barre grâce aux ratios de LEVEL_REFS. */
const LIFT_ALTS = {
  bench: { label: "Poussée (pecs)", options: [
    ["bench-press", "Développé couché à la barre"],
    ["db-bench-press", "Développé couché aux haltères", "poids d'un haltère"],
    ["smith-machine-bench-press", "Développé couché à la Smith"],
    ["chest-press-machine", "Presse pectoraux à la machine"],
    ["incline-bench-press", "Développé incliné à la barre"],
    ["incline-db-press", "Développé incliné aux haltères", "poids d'un haltère"]] },
  squat: { label: "Jambes", options: [
    ["squat", "Squat à la barre"],
    ["smith-machine-squat", "Squat à la Smith"],
    ["hack-squat", "Hack squat"],
    ["leg-press", "Presse à cuisses"],
    ["front-squat", "Squat avant"],
    ["goblet-squat", "Goblet squat", "poids de l'haltère"]] },
  deadlift: { label: "Chaîne arrière", options: [
    ["deadlift", "Soulevé de terre"],
    ["sumo-deadlift", "Soulevé de terre sumo"],
    ["hex-bar-deadlift", "Soulevé de terre à la hex bar"],
    ["romanian-deadlift", "Soulevé de terre roumain à la barre"],
    ["dumbbell-romanian-deadlift", "Soulevé de terre roumain aux haltères", "poids d'un haltère"]] },
  ohp: { label: "Épaules", options: [
    ["ohp", "Développé militaire à la barre"],
    ["dumbbell-shoulder-press", "Développé épaules aux haltères", "poids d'un haltère"],
    ["machine-shoulder-press", "Développé épaules à la machine"],
    ["smith-machine-shoulder-press", "Développé épaules à la Smith"]] },
  pull: { label: "Tirage (dos)", options: [
    ["pull-up", "Tractions", "lest ajouté (0 au poids du corps)"],
    ["lat-pulldown", "Tirage vertical à la poulie"],
    ["barbell-row", "Rowing à la barre"],
    ["seated-cable-row", "Rowing assis à la poulie"],
    ["single-arm-db-row", "Rowing à un bras à l'haltère", "poids de l'haltère"]] }
};
const LIFT_DEFAULTS = {
  gym: { bench: "bench-press", squat: "squat", deadlift: "deadlift", ohp: "ohp", pull: "pull-up" },
  dumbbells: { bench: "db-bench-press", squat: "goblet-squat", deadlift: "dumbbell-romanian-deadlift", ohp: "dumbbell-shoulder-press", pull: "single-arm-db-row" }
};

function liftAlt(answers, key) {
  const chosen = answers.liftAlt && answers.liftAlt[key];
  if (chosen && LIFT_ALTS[key].options.some(o => o[0] === chosen)) return chosen;
  return (LIFT_DEFAULTS[answers.equipment] || LIFT_DEFAULTS.gym)[key];
}
function liftReps(answers, key) {
  return Math.max(1, Math.min(20, Number(answers.liftReps && answers.liftReps[key]) || 8));
}
/** Charge à la barre équivalente pour ~8 répétitions (0 si rien de saisi) */
function barbellEquivalent(answers, key) {
  const weight = Number(answers.lifts && answers.lifts[key]) || 0;
  const ref = LEVEL_REFS[liftAlt(answers, key)];
  if (!weight || !ref || ref.reps) return 0;
  return estimate1RM(weight, liftReps(answers, key)) / ref.ratio / (1 + 8 / 30);
}
/** Séries saisies, au format attendu par assessLevel */
function liftEntries(answers) {
  return Object.keys(LIFT_ALTS).map(key => {
    const id = liftAlt(answers, key);
    const raw = answers.lifts && answers.lifts[key];
    const weight = Number(raw) || 0;
    const repsGiven = Number(answers.liftReps && answers.liftReps[key]) || 0;
    const ref = LEVEL_REFS[id];
    if (ref && ref.reps) return repsGiven > 0 || weight > 0 ? { id, weight, reps: liftReps(answers, key) } : null;
    return weight > 0 ? { id, weight, reps: liftReps(answers, key) } : null;
  }).filter(Boolean);
}

export function resolveSplit(answers) {
  return answers.split && answers.split !== "auto" ? answers.split : autoSplit(Number(answers.days) || 3);
}

/** Construit le programme : { name, description, sessions:[{ name, type, exerciseIds, plan }] } */
export function generateProgram(answers, exercises) {
  const known = new Set((exercises || []).map(ex => ex.id));
  const split = resolveSplit(answers);
  const days = Number(answers.days) || 3;
  const equipment = answers.equipment || "gym";
  const scheme = SCHEMES[answers.goal] || SCHEMES.muscle;
  const count = EXERCISE_COUNT[answers.duration] || 5;
  const refs = referenceLoads(answers);
  const setDelta = answers.level === "debutant" ? -1 : 0;

  const sessions = SPLITS[split].sessions(days).map(dayKey => {
    const day = DAYS[dayKey];
    const exerciseIds = [];
    const plan = {};
    for (const slotKey of day.slots) {
      if (exerciseIds.length >= count) break;
      const slot = SLOTS[slotKey];
      const variant = equipment === "gym" ? "gym" : equipment === "dumbbells" ? "db" : "bw";
      const id = slot[variant] || (variant === "db" ? slot.bw : null);
      if (!id || !known.has(id) || exerciseIds.includes(id)) continue;

      const compound = exerciseIds.length < 2;
      const s = compound ? scheme.c : scheme.a;
      let weight = 0;
      if (!BODYWEIGHT_IDS.has(id) && slot.ref) {
        const ratio = variant === "db" && slot.dbRatio ? slot.dbRatio : slot.ratio;
        weight = roundLoad(refs[slot.ref] * ratio * s.f);
      } else if (slot.cable) {
        weight = roundLoad(refs.bench * slot.cable);
      }
      const reps = id === "plank" ? 45 : s.reps;
      exerciseIds.push(id);
      plan[id] = { sets: Math.max(2, s.sets + setDelta), reps, weight };
    }
    return { name: day.name, type: day.type, exerciseIds, plan };
  });

  const goalLabel = { force: "force", muscle: "prise de muscle", seche: "sèche", forme: "remise en forme" }[answers.goal] || "";
  return {
    name: `${SPLITS[split].label} · ${days} j/sem`,
    description: `Programme guidé — ${goalLabel}, ${answers.duration || 60} min par séance`,
    split,
    sessions
  };
}


/* ═══════════════════ Évaluation du niveau ═══════════════════
   Chaque mouvement de référence donne un 1RM estimé (Epley), ramené au poids de corps
   et comparé à des standards (seuils novice / intermédiaire / avancé / élite). */
export const LEVEL_NAMES = ["Débutant", "Novice", "Intermédiaire", "Avancé", "Élite"];

const LIFT_LABELS = {
  bench: "Poussée",
  squat: "Jambes",
  deadlift: "Chaîne arrière",
  ohp: "Épaules",
  pull: "Tirage"
};

/* seuils en multiple du poids de corps (1RM), ou en répétitions pour les tractions */
const STANDARDS = {
  male: {
    bench: [0.75, 1.1, 1.5, 1.9], squat: [1, 1.4, 1.9, 2.4], deadlift: [1.25, 1.7, 2.2, 2.8],
    ohp: [0.5, 0.7, 0.9, 1.15], pull: [0.6, 0.85, 1.15, 1.45], pullReps: [3, 8, 14, 20]
  },
  female: {
    bench: [0.45, 0.65, 0.9, 1.15], squat: [0.75, 1.05, 1.4, 1.8], deadlift: [0.95, 1.3, 1.65, 2.1],
    ohp: [0.3, 0.42, 0.55, 0.7], pull: [0.36, 0.5, 0.7, 0.9], pullReps: [1, 3, 7, 12]
  }
};

/* exercice → mouvement de référence ; ratio = charge de l'exercice / charge du mouvement de référence */
const LEVEL_REFS = {
  "bench-press": { lift: "bench", ratio: 1 },
  "paused-bench-press": { lift: "bench", ratio: 0.95 },
  "smith-machine-bench-press": { lift: "bench", ratio: 1 },
  "close-grip-bench-press": { lift: "bench", ratio: 0.9 },
  "incline-bench-press": { lift: "bench", ratio: 0.8 },
  "db-bench-press": { lift: "bench", ratio: 0.38 },
  "chest-press-machine": { lift: "bench", ratio: 0.9 },
  "incline-db-press": { lift: "bench", ratio: 0.32 },
  "squat": { lift: "squat", ratio: 1 },
  "pause-squat": { lift: "squat", ratio: 0.9 },
  "smith-machine-squat": { lift: "squat", ratio: 1 },
  "front-squat": { lift: "squat", ratio: 0.8 },
  "goblet-squat": { lift: "squat", ratio: 0.3 },
  "hack-squat": { lift: "squat", ratio: 1.2 },
  "leg-press": { lift: "squat", ratio: 1.8 },
  "deadlift": { lift: "deadlift", ratio: 1 },
  "sumo-deadlift": { lift: "deadlift", ratio: 1 },
  "hex-bar-deadlift": { lift: "deadlift", ratio: 1.05 },
  "romanian-deadlift": { lift: "deadlift", ratio: 0.7 },
  "dumbbell-romanian-deadlift": { lift: "deadlift", ratio: 0.25 },
  "ohp": { lift: "ohp", ratio: 1 },
  "seated-barbell-overhead-press": { lift: "ohp", ratio: 0.95 },
  "dumbbell-shoulder-press": { lift: "ohp", ratio: 0.4 },
  "seated-db-press": { lift: "ohp", ratio: 0.4 },
  "machine-shoulder-press": { lift: "ohp", ratio: 0.85 },
  "smith-machine-shoulder-press": { lift: "ohp", ratio: 0.95 },
  "barbell-row": { lift: "pull", ratio: 1 },
  "pendlay-row": { lift: "pull", ratio: 0.95 },
  "t-bar-row": { lift: "pull", ratio: 1 },
  "lat-pulldown": { lift: "pull", ratio: 1 },
  "seated-cable-row": { lift: "pull", ratio: 1 },
  "single-arm-db-row": { lift: "pull", ratio: 0.45 },
  "pull-up": { lift: "pull", reps: true },
  "chin-ups": { lift: "pull", reps: true },
  "weighted-pull-up": { lift: "pull", reps: true }
};

function estimate1RM(weight, reps) {
  const r = Math.min(Math.max(1, reps), 20);
  return r === 1 ? weight : weight * (1 + r / 30);
}

/* score continu de 0 à 5 : partie entière = index du niveau */
function scoreAgainst(value, thresholds) {
  const [a, b, c, d] = thresholds;
  if (value < a) return Math.max(0, value / a);
  if (value < b) return 1 + (value - a) / (b - a);
  if (value < c) return 2 + (value - b) / (c - b);
  if (value < d) return 3 + (value - c) / (d - c);
  return Math.min(4.99, 4 + (value - d) / (d - c));
}

/**
 * entries: [{ id, weight, reps }] — retourne null si aucun mouvement de référence.
 * { score, index, label, percent, lifts: [{ lift, label, exerciseId, e1rm, ratio, reps, index, levelLabel }] }
 */
export function assessLevel(entries, bodyweight, sex = "male") {
  const bw = Number(bodyweight) || 75;
  const std = STANDARDS[sex] || STANDARDS.male;
  const best = {};
  for (const entry of entries || []) {
    const ref = LEVEL_REFS[entry.id];
    const reps = Number(entry.reps) || 0;
    const weight = Number(entry.weight) || 0;
    if (!ref || reps <= 0) continue;
    let score, detail;
    if (ref.reps) {
      // tractions : le lest est converti en répétitions équivalentes au poids du corps
      const equivReps = weight > 0 ? 30 * (estimate1RM(bw + weight, reps) / bw - 1) : reps;
      score = scoreAgainst(equivReps, std.pullReps);
      detail = { reps: Math.round(equivReps) };
    } else {
      if (weight <= 0) continue;
      const refMax = estimate1RM(weight, reps) / ref.ratio;
      score = scoreAgainst(refMax / bw, std[ref.lift]);
      detail = { e1rm: Math.round(refMax), ratio: refMax / bw };
    }
    if (!best[ref.lift] || score > best[ref.lift].score) {
      best[ref.lift] = { lift: ref.lift, label: LIFT_LABELS[ref.lift], exerciseId: entry.id, score, ...detail };
    }
  }
  const lifts = Object.values(best);
  if (!lifts.length) return null;
  lifts.forEach(item => {
    item.index = Math.min(4, Math.floor(item.score));
    item.levelLabel = LEVEL_NAMES[item.index];
  });
  const score = lifts.reduce((sum, item) => sum + item.score, 0) / lifts.length;
  const index = Math.min(4, Math.floor(score));
  return { score, index, label: LEVEL_NAMES[index], percent: Math.round(score / 5 * 100), lifts };
}

/* niveau détaillé → niveau utilisé par le générateur */
function levelKey(index) {
  return index <= 1 ? "debutant" : index === 2 ? "intermediaire" : "avance";
}

/* ═══════════════════ Questionnaire (feuille modale) ═══════════════════ */
const GENERATE_STEPS = [
  { key: "goal", kind: "options", q: "Quel est ton objectif principal ?", options: [
    ["muscle", "Prendre du muscle", "Hypertrophie, 8 à 12 répétitions"],
    ["force", "Gagner en force", "Charges lourdes, 5 répétitions sur les gros mouvements"],
    ["seche", "Sécher", "Garder le muscle en perdant du gras"],
    ["forme", "Me remettre en forme", "Bouger régulièrement, sans pression"]] },
  { key: "level", kind: "options", q: "Depuis combien de temps tu t'entraînes ?", options: [
    ["debutant", "Moins d'un an", "Débutant"],
    ["intermediaire", "1 à 3 ans", "Intermédiaire"],
    ["avance", "Plus de 3 ans", "Avancé"]] },
  { key: "days", kind: "chips", q: "Combien de séances par semaine ?", chips: [2, 3, 4, 5, 6] },
  { key: "split", kind: "options", q: "Comment tu veux organiser tes séances ?", options: null },
  { key: "equipment", kind: "options", q: "Avec quel matériel ?", options: [
    ["gym", "Salle complète", "Barres, machines, poulies"],
    ["dumbbells", "Haltères seulement", "À la maison ou en salle basique"],
    ["bodyweight", "Poids du corps", "Sans matériel, une barre de traction au mieux"]] },
  { key: "duration", kind: "chips", q: "Combien de temps par séance ?", chips: [45, 60, 75, 90], unit: "min" },
  { key: "lifts", kind: "lifts", q: "Combien tu soulèves ?" },
  { key: "recap", kind: "recap", q: "Ton programme" }
];

const MODE_STEP = { key: "mode", kind: "options", q: "Comment tu veux commencer ?", options: [
  ["generate", "Génère-moi un programme", "Quelques questions et l'appli construit tout, charges comprises"],
  ["custom", "J'ai déjà mon programme", "Tu remplis ta semaine type, tes exos et tes charges : l'appli calcule ton niveau"],
  ["notion", "Il est dans Notion", "Connecte ton compte Notion : l'appli reprend tes séances, tes exos et tes charges"]] };

const CUSTOM_GOAL_STEP = { ...GENERATE_STEPS[0], q: "Ton objectif en ce moment ?" };


/* semaines types : [nom, type, séance de suggestions] */
const WEEK_PRESETS = {
  ppl_upper: { label: "Push · Pull · Legs · Upper", sessions: [["Push", "push", "push"], ["Pull", "pull", "pull"], ["Legs", "legs", "legs"], ["Upper", "full", "upperA"]] },
  ppl: { label: "Push · Pull · Legs", sessions: [["Push", "push", "push"], ["Pull", "pull", "pull"], ["Legs", "legs", "legs"]] },
  ppl2: { label: "PPL × 2", sessions: [["Push A", "push", "push"], ["Pull A", "pull", "pull"], ["Legs A", "legs", "legs"], ["Push B", "push", "chest"], ["Pull B", "pull", "back"], ["Legs B", "legs", "lowerB"]] },
  upper_lower: { label: "Haut / Bas", sessions: [["Haut A", "full", "upperA"], ["Bas A", "legs", "lowerA"], ["Haut B", "full", "upperB"], ["Bas B", "legs", "lowerB"]] },
  full: { label: "Full body × 3", sessions: [["Full body A", "full", "fullA"], ["Full body B", "full", "fullB"], ["Full body C", "full", "fullC"]] },
  bro: { label: "Un muscle par jour", sessions: [["Pectoraux", "push", "chest"], ["Dos", "pull", "back"], ["Jambes", "legs", "legs"], ["Épaules", "push", "shoulders"], ["Bras", "full", "arms"]] },
  empty: { label: "Partir de zéro", sessions: [["Séance 1", "full", null]] }
};
const TYPE_DAY = { push: "push", pull: "pull", legs: "legs", full: "fullA" };
const SESSION_TYPES = [["push", "Push"], ["pull", "Pull"], ["legs", "Legs"], ["full", "Full / Upper"], ["other", "Autre"]];

let wiz = null;

/* note manuscrite, explication et dessin de chaque étape (clé d'étape, ou type pour les séances) */
const WZ_META = {
  mode: { img: "prog-01-depart.png", hand: "Tu pourras tout modifier ensuite",
    x: "Pas encore de programme ? L'appli en construit un pour toi. Tu en as déjà un ? Remplis-le ici ou importe-le depuis Notion." },
  goal: { img: "prog-02-objectif.png", hand: "Ça change tes séries et tes reps",
    x: "Pour le muscle : 8 à 12 répétitions. Pour la force : moins de répétitions, plus lourd. En sèche, on garde des charges lourdes pour conserver ton muscle." },
  level: { img: "prog-03-experience.png", hand: "Sois honnête, personne ne regarde",
    x: "Un débutant progresse vite avec peu de volume. Plus tu es avancé, plus il faut de séries et de variété pour continuer à progresser." },
  days: { img: "prog-04-seances.png", hand: "3 séances tenues valent mieux que 5 ratées",
    x: "Choisis un nombre que tu peux tenir toute l'année. La régularité compte plus que le nombre de séances." },
  split: { img: "prog-05-organisation.png", hand: "Dans le doute, laisse-nous choisir",
    x: "C'est la façon de répartir les muscles sur la semaine. « Choisis pour moi » prend l'organisation la plus adaptée à ton nombre de séances." },
  equipment: { img: "prog-06-materiel.png", hand: "Salle, maison ou rien du tout",
    x: "L'appli ne choisit que des exercices faisables avec ton matériel." },
  duration: { img: "prog-07-duree.png", hand: "Échauffement compris",
    x: "Le nombre d'exercices et de séries s'adapte pour tenir dans ce temps." },
  lifts: { img: "prog-08-charges.png", hand: "Laisse vide si tu ne sais pas",
    x: "" },
  recap: { img: "prog-09-programme.png", hand: "Prêt à soulever ?", x: "" },
  week: { img: "prog-10-semaine-type.png", hand: "Renomme, ajoute, retire",
    x: "" },
  build: { img: "prog-11-seance.png", hand: "Cherche, ajoute, remplis",
    x: "" },
  body: { img: "prog-12-gabarit.png", hand: "Pour te comparer à toi-même",
    x: "" },
  levelRecap: { img: "prog-13-niveau.png", hand: "Et ça ne fera que monter", x: "" }
};
function metaHtml(step) {
  const m = WZ_META[step.kind === "build" ? "build" : step.key === "level" && step.kind === "levelRecap" ? "levelRecap" : step.key] || WZ_META[step.kind];
  if (!m) return "";
  return `${m.hand ? `<p class="wz-hand">${m.hand}</p>` : ""}${illu(m.img, "wz-illu")}${m.x ? `<p class="wz-expl">${m.x}</p>` : ""}`;
}

function splitOptions(days) {
  const rec = autoSplit(days);
  return [
    ["auto", `Choisis pour moi`, `Recommandé pour ${days} séance${days > 1 ? "s" : ""} : ${SPLITS[rec].label}`],
    ["ppl", "Push / Pull / Legs", "Poussée, tirage, jambes"],
    ["upper_lower", "Haut / Bas", "Haut du corps, bas du corps en alternance"],
    ["full", "Full body", "Tout le corps à chaque séance"],
    ["bro", "Un groupe par séance", "Pecs, dos, jambes, épaules, bras"]
  ];
}

function visibleSteps() {
  const a = wiz.answers;
  if (a.mode === "custom") {
    return [
      MODE_STEP,
      CUSTOM_GOAL_STEP,
      { key: "week", kind: "week", q: "Ta semaine type" },
      ...wiz.custom.sessions.map((session, index) => ({ key: `build${index}`, kind: "build", session: index, q: session.name || `Séance ${index + 1}` })),
      { key: "body", kind: "body", q: "Ton gabarit" },
      { key: "level", kind: "levelRecap", q: "Ton niveau" }
    ];
  }
  const steps = GENERATE_STEPS.filter(step => !(step.kind === "lifts" && a.equipment === "bodyweight"));
  return [MODE_STEP, ...steps];
}

function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function fmt(value, digits = 0) {
  return Number(value).toLocaleString("fr-FR", { maximumFractionDigits: digits });
}

function exerciseName(id) {
  const ex = wiz.exercises.find(e => e.id === id);
  return wiz.nameOf(ex) || ex?.name || id;
}

/* ---------- constructeur de programme ---------- */
function applyPreset(key) {
  const preset = WEEK_PRESETS[key];
  wiz.custom.preset = key;
  wiz.custom.sessions = preset.sessions.map(([name, type, dayKey]) => ({ name, type, dayKey, items: [] }));
}

function suggestItems(session) {
  const dayKey = session.dayKey || TYPE_DAY[session.type];
  const day = DAYS[dayKey];
  if (!day) return;
  const known = new Set(wiz.exercises.map(ex => ex.id));
  const scheme = SCHEMES[wiz.answers.goal] || SCHEMES.muscle;
  for (const slotKey of day.slots.slice(0, 5)) {
    const id = SLOTS[slotKey].gym;
    if (!known.has(id) || session.items.some(item => item.id === id)) continue;
    const s = session.items.length < 2 ? scheme.c : scheme.a;
    session.items.push({ id, sets: s.sets, reps: id === "plank" ? 45 : s.reps, weight: "" });
  }
}

/* les mouvements classiques remontent en tête des résultats */
const POPULAR_IDS = new Set([...Object.values(SLOTS).flatMap(slot => [slot.gym, slot.db, slot.bw]).filter(Boolean), ...Object.keys(LEVEL_REFS)]);

function searchExercises(query, excluded) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const results = [];
  for (const ex of wiz.exercises) {
    if (excluded.has(ex.id)) continue;
    const label = normalize(wiz.nameOf(ex));
    const hay = `${label} ${normalize(ex.name)} ${ex.id.replace(/_/g, " ")} ${normalize(ex.muscle_focus)}`;
    if (!tokens.every(token => hay.includes(token))) continue;
    const rank = (label.startsWith(tokens[0]) ? 0 : label.includes(tokens[0]) ? 1 : 2) - (POPULAR_IDS.has(ex.id) ? 1.5 : 0);
    results.push({ ex, rank, len: label.length });
  }
  return results.sort((a, b) => a.rank - b.rank || a.len - b.len).slice(0, 8).map(item => item.ex);
}

function renderSearchResults(query) {
  const box = wiz.el.querySelector(".wz-results");
  if (!box) return;
  const session = wiz.custom.sessions[visibleSteps()[wiz.index].session];
  const list = searchExercises(query, new Set(session.items.map(item => item.id)));
  const name = ex => wiz.nameOf(ex) || ex.name;
  box.innerHTML = list.length ? list.map(ex => `
    <div class="wz-result-row">
      <button type="button" class="wz-result" data-act="add-ex" data-id="${esc(ex.id)}">
        <span>+ ${esc(name(ex))}</span><small>${esc(String(ex.muscle_focus || "").replace(/_/g, " "))}</small>
      </button>
      ${wiz.showDetails ? `<button type="button" class="wz-info" data-act="info" data-id="${esc(ex.id)}" aria-label="Détails : ${esc(name(ex))}">i</button>` : ""}
    </div>`).join("")
    : query.trim() ? `<div class="wz-noresult">Aucun exercice trouvé</div>` : "";
  if (query.trim() && wiz.createExercise) {
    box.insertAdjacentHTML("beforeend", `<button type="button" class="wz-result wz-create" data-act="create-ex" data-name="${esc(query.trim())}"><span>+ Créer « ${esc(query.trim())} »</span><small>exercice perso</small></button>`);
  }
}

function weekBody() {
  const c = wiz.custom;
  return `
    <p class="wz-help">Choisis un modèle puis ajuste : renomme, change le type, ajoute ou retire des séances.</p>
    <div class="wz-presets">${Object.entries(WEEK_PRESETS).map(([k, p]) => `
      <button type="button" class="wz-preset${c.preset === k ? " on" : ""}" data-act="preset" data-preset="${k}">${p.label}</button>`).join("")}
    </div>
    <label class="wz-field"><span>Nom du programme</span><input type="text" data-pname value="${esc(c.name)}" placeholder="Ma semaine" maxlength="40"></label>
    <div class="wz-week">${c.sessions.map((s, i) => `
      <div class="wz-day">
        <span class="wz-day-n">J${i + 1}</span>
        <input type="text" class="wz-day-name" data-sname="${i}" value="${esc(s.name)}" placeholder="Séance ${i + 1}" maxlength="30">
        <select class="wz-day-type" data-stype="${i}">${SESSION_TYPES.map(([v, l]) => `<option value="${v}"${s.type === v ? " selected" : ""}>${l}</option>`).join("")}</select>
        <button type="button" class="wz-x" data-act="del-session" data-i="${i}" aria-label="retirer la séance">✕</button>
      </div>`).join("")}
    </div>
    ${c.sessions.length < 7 ? `<button type="button" class="wz-add" data-act="add-session">+ Ajouter une séance</button>` : ""}
    <p class="wz-help wz-help-sm">${c.sessions.length} séance${c.sessions.length > 1 ? "s" : ""} par semaine.</p>`;
}

function buildBody(step) {
  const session = wiz.custom.sessions[step.session];
  const total = wiz.custom.sessions.length;
  const count = session.items.length;
  const items = session.items.map((item, i) => {
    const bodyweight = BODYWEIGHT_IDS.has(item.id);
    const name = esc(exerciseName(item.id));
    return `
      <div class="wz-item${wiz.flash === item.id ? " is-new" : ""}" data-item="${esc(item.id)}">
        <div class="wz-item-h">
          <span class="wz-item-n">${i + 1}</span>
          <span class="wz-item-name">${name}</span>
          <span class="wz-item-tools">
            ${wiz.showDetails ? `<button type="button" class="wz-tool" data-act="info" data-id="${esc(item.id)}" aria-label="Détails : ${name}">i</button>` : ""}
            <button type="button" class="wz-tool" data-act="up" data-i="${i}" aria-label="Monter ${name}"${i === 0 ? " disabled" : ""}>↑</button>
            <button type="button" class="wz-tool" data-act="down" data-i="${i}" aria-label="Descendre ${name}"${i === count - 1 ? " disabled" : ""}>↓</button>
            <button type="button" class="wz-tool wz-tool-x" data-act="del-ex" data-i="${i}" aria-label="Retirer ${name}">✕</button>
          </span>
        </div>
        <div class="wz-item-f">
          <label><em>Séries</em><input type="number" inputmode="numeric" data-field="sets" data-i="${i}" value="${esc(item.sets)}" min="1" max="10"></label>
          <label><em>${item.id === "plank" ? "Secondes" : "Reps"}</em><input type="number" inputmode="numeric" data-field="reps" data-i="${i}" value="${esc(item.reps)}" min="1" max="100"></label>
          <label><em>${bodyweight ? "Lest (kg)" : "Poids (kg)"}</em><input type="number" inputmode="decimal" data-field="weight" data-i="${i}" value="${esc(item.weight)}" placeholder="${bodyweight ? "0" : "—"}" min="0" max="500" step="0.5"></label>
        </div>
      </div>`;
  }).join("");
  return `
    <div class="wz-build-sub">Séance ${step.session + 1} sur ${total} · ${session.items.length} exercice${session.items.length > 1 ? "s" : ""}</div>
    <div class="wz-items">${items || `<div class="wz-empty">Aucun exercice pour l'instant : cherche-en un juste en dessous.</div>`}</div>
    <div class="wz-search">
      <label class="wz-search-label" for="wz-search">Ajouter un exercice</label>
      <input type="search" id="wz-search" data-search placeholder="ex : développé, squat, curl…" autocomplete="off" enterkeyhint="done">
      <div class="wz-results"></div>
    </div>
    ${session.items.length < 3 ? `<button type="button" class="wz-add" data-act="suggest">✨ Suggère-moi des exercices</button>` : ""}
    <p class="wz-help wz-help-sm">Mets les charges et reps que tu fais <b>actuellement</b> : elles servent de point de départ et à calculer ton niveau.</p>`;
}

function bodyBody() {
  const a = wiz.answers;
  return `
    <p class="wz-help">Ton niveau se calcule par rapport à ton poids de corps.</p>
    <div class="wz-lifts">
      <label class="wz-lift"><span>Poids de corps</span><input type="number" inputmode="decimal" data-lift="bodyweight" value="${esc(a.bodyweight)}" placeholder="75" min="30" max="250" step="0.1"><em>kg</em></label>
    </div>
    <div class="wz-seg">
      <button type="button" class="wz-seg-b${a.sex !== "female" ? " on" : ""}" data-sex="male">Homme</button>
      <button type="button" class="wz-seg-b${a.sex === "female" ? " on" : ""}" data-sex="female">Femme</button>
    </div>
    <p class="wz-help wz-help-sm">Ton poids sera aussi enregistré comme premier jour de ta flamme 🔥.</p>`;
}

function levelHtml(level) {
  if (!level) {
    return `<div class="wz-level wz-level-none">
      <b>Niveau non évalué</b>
      <span>Ajoute un mouvement de référence avec sa charge (développé couché, squat, soulevé de terre, développé militaire, rowing ou tractions) pour obtenir ton niveau.</span>
    </div>`;
  }
  const segs = LEVEL_NAMES.map((name, i) => `<div class="wz-gauge-seg${i <= level.index ? " on" : ""}"><span>${name}</span></div>`).join("");
  const rows = level.lifts.map(item => `
    <div class="wz-lvl-row">
      <div><b>${item.label}</b><small>${esc(exerciseName(item.exerciseId))}</small></div>
      <div class="wz-lvl-val">${item.e1rm ? `${fmt(item.e1rm)} kg <small>1RM · ${fmt(item.ratio, 2)}× PDC</small>` : `${item.reps} reps`}</div>
      <span class="wz-lvl-tag l${item.index}">${item.levelLabel}</span>
    </div>`).join("");
  const missing = ["bench", "squat", "deadlift", "ohp", "pull"].filter(k => !level.lifts.some(item => item.lift === k)).map(k => LIFT_LABELS[k].toLowerCase());
  return `
    <div class="wz-level">
      <div class="wz-level-top"><span>Ton niveau</span><b>${level.label}</b><em>${level.percent}/100</em></div>
      <div class="wz-gauge">${segs}</div>
      <div class="wz-lvl-rows">${rows}</div>
      ${missing.length ? `<p class="wz-help wz-help-sm">Pas encore évalué : ${missing.join(", ")}.</p>` : ""}
    </div>`;
}

function customEntries() {
  return wiz.custom.sessions.flatMap(s => s.items.map(item => ({ id: item.id, weight: item.weight, reps: item.reps })));
}

function buildCustomProgram() {
  const c = wiz.custom;
  const sessions = c.sessions.filter(s => s.items.length).map((s, i) => {
    const plan = {};
    s.items.forEach(item => {
      plan[item.id] = { sets: Math.max(1, Number(item.sets) || 3), reps: Math.max(1, Number(item.reps) || 10), weight: Number(item.weight) || 0 };
    });
    return { name: s.name.trim() || `Séance ${i + 1}`, type: s.type, exerciseIds: s.items.map(item => item.id), plan };
  });
  return {
    name: c.name.trim() || sessions.map(s => s.name).join(" · ") || "Mon programme",
    description: `Mon programme — ${sessions.length} séance${sessions.length > 1 ? "s" : ""} par semaine`,
    split: "custom",
    sessions
  };
}

function sessionsHtml(program) {
  return `<div class="wz-sessions">${program.sessions.map(s => `
    <div class="wz-session">
      <div class="wz-session-h">${esc(s.name)}<span>${s.exerciseIds.length} exercice${s.exerciseIds.length > 1 ? "s" : ""}</span></div>
      ${s.exerciseIds.map(id => {
        const p = s.plan[id];
        return `<div class="wz-ex"><span>${esc(exerciseName(id))}</span><b>${p.sets}×${p.reps}${id === "plank" ? " s" : ""}${p.weight ? ` · ${String(p.weight).replace(".", ",")} kg` : ""}</b></div>`;
      }).join("")}
    </div>`).join("")}
  </div>`;
}

function canContinue(step) {
  const a = wiz.answers;
  if (step.kind === "week") return wiz.custom.sessions.length > 0;
  if (step.kind === "build") return wiz.custom.sessions[step.session].items.length > 0;
  if (step.kind === "levelRecap") return wiz.custom.sessions.some(s => s.items.length);
  if (["recap", "lifts", "body"].includes(step.kind)) return true;
  return a[step.key] !== undefined;
}

function renderStep(keepScroll = false) {
  const steps = visibleSteps();
  wiz.index = Math.min(wiz.index, steps.length - 1);
  const step = steps[wiz.index];
  const a = wiz.answers;
  const progress = ((wiz.index + 1) / steps.length) * 100;
  const isLast = step.kind === "recap" || step.kind === "levelRecap";
  let body = "";

  if (step.kind === "options") {
    const options = step.key === "split" ? splitOptions(Number(a.days) || 3) : step.options;
    body = `<div class="wz-options">${options.map(([v, l, d]) => `
      <button type="button" class="wz-option${a[step.key] === v ? " on" : ""}" data-v="${v}">
        <span class="wz-option-l">${l}</span><span class="wz-option-d">${d}</span>
      </button>`).join("")}</div>`;
  } else if (step.kind === "chips") {
    body = `<div class="wz-chips">${step.chips.map(v => `
      <button type="button" class="wz-chip${Number(a[step.key]) === v ? " on" : ""}" data-v="${v}">${v}<small>${step.unit || (v > 1 ? "séances" : "séance")}</small></button>`).join("")}</div>`;
  } else if (step.kind === "lifts") {
    const lifts = a.lifts || {};
    const reps = a.liftReps || {};
    body = `
      <p class="wz-help">Pour chaque mouvement, choisis <b>la variante que tu fais vraiment</b>, puis la charge et les répétitions d'une bonne série. Tu ne le fais pas ? Laisse vide : on l'estimera.</p>
      <div class="wz-lifts">
        <label class="wz-lift"><span>Poids de corps</span><input type="number" inputmode="decimal" data-lift="bodyweight" value="${esc(a.bodyweight)}" placeholder="75" min="30" max="250" step="0.5"><em>kg</em></label>
        ${Object.entries(LIFT_ALTS).map(([k, def]) => {
          const alt = liftAlt(a, k);
          const opt = def.options.find(o => o[0] === alt);
          return `
          <div class="wz-liftcard">
            <div class="wz-liftcard-h">
              <b>${def.label}</b>
              <select class="input wz-alt" data-alt="${k}" aria-label="Variante pour ${def.label}">
                ${def.options.map(([id, label]) => `<option value="${id}" ${id === alt ? "selected" : ""}>${label}</option>`).join("")}
              </select>
            </div>
            <div class="wz-liftcard-in">
              <label class="wz-lift"><input type="number" inputmode="decimal" data-lift="${k}" value="${esc(lifts[k])}" placeholder="${LEVEL_REFS[alt] && LEVEL_REFS[alt].reps ? "0" : "—"}" min="0" max="500" step="0.5" aria-label="Charge"><em>kg</em></label>
              <span class="wz-times">×</span>
              <label class="wz-lift"><input type="number" inputmode="numeric" data-reps="${k}" value="${esc(reps[k])}" placeholder="8" min="1" max="20" step="1" aria-label="Répétitions"><em>reps</em></label>
            </div>
            ${opt && opt[2] ? `<small class="wz-liftcard-note">${opt[2]}</small>` : ""}
          </div>`;
        }).join("")}
      </div>`;
  } else if (step.kind === "recap") {
    const program = generateProgram(a, wiz.exercises);
    wiz.program = program;
    wiz.level = assessLevel(liftEntries(a), a.bodyweight, a.sex);
    body = `
      ${wiz.level ? levelHtml(wiz.level) : ""}
      <div class="wz-recap-head"><b>${esc(program.name)}</b><span>${esc(program.description)}</span></div>
      ${sessionsHtml(program)}
      <p class="wz-help">Enchaîne les séances dans l'ordre, ${a.days} fois par semaine. Après chaque séance réussie, l'appli te proposera automatiquement +2,5 kg.</p>`;
  } else if (step.kind === "week") {
    body = weekBody();
  } else if (step.kind === "build") {
    body = buildBody(step);
  } else if (step.kind === "body") {
    body = bodyBody();
  } else if (step.kind === "levelRecap") {
    wiz.level = assessLevel(customEntries(), a.bodyweight, a.sex);
    wiz.program = buildCustomProgram();
    body = `
      ${levelHtml(wiz.level)}
      <div class="wz-recap-head"><b>${esc(wiz.program.name)}</b><span>${esc(wiz.program.description)}</span></div>
      ${sessionsHtml(wiz.program)}
      <p class="wz-help">Tes charges servent de point de départ : à chaque séance réussie, l'appli te proposera +2,5 kg. Ton niveau se mettra à jour avec tes progrès.</p>`;
  }

  wiz.el.querySelector(".wz-body").innerHTML = `
    <div class="wz-progress-row">
      <div class="wz-progress" role="progressbar" aria-label="Étape ${wiz.index + 1} sur ${steps.length}" aria-valuemin="1" aria-valuemax="${steps.length}" aria-valuenow="${wiz.index + 1}"><div style="width:${progress}%"></div></div>
      <span class="wz-count">${wiz.index + 1}/${steps.length}</span>
    </div>
    <h3 class="wz-q">${esc(step.q)}</h3>
    ${metaHtml(step)}
    ${body}
    <div class="wz-actions">
      ${wiz.index > 0 ? `<button type="button" class="btn btn-surface" data-wz="back">Retour</button>` : `<button type="button" class="btn btn-surface" data-wz="later">Plus tard</button>`}
      <button type="button" class="btn btn-primary btn-grow" data-wz="${isLast ? "create" : "next"}" ${canContinue(step) ? "" : "disabled"}>${isLast ? "Créer mon programme" : "Continuer"}</button>
    </div>`;
  if (!keepScroll) wiz.el.querySelector(".wz-card").scrollTop = 0;
  saveDraft();
}

/* ---------- brouillon : gardé à chaque changement, repris à la prochaine ouverture ---------- */
function saveDraft() {
  if (!wiz?.draftKey || wiz.resuming) return;
  if (wiz.index === 0 && !wiz.answers.mode) return;
  try {
    localStorage.setItem(wiz.draftKey, JSON.stringify({ v: 1, index: wiz.index, answers: wiz.answers, custom: wiz.custom, savedAt: Date.now() }));
  } catch { /* stockage indisponible : pas de brouillon */ }
}
function readDraft(key) {
  if (!key) return null;
  try {
    const draft = JSON.parse(localStorage.getItem(key) || "null");
    return draft && draft.v === 1 && draft.answers && draft.custom ? draft : null;
  } catch { return null; }
}
function clearDraft(key) {
  try { if (key) localStorage.removeItem(key); } catch { /* idem */ }
}

function renderResume(draft) {
  const date = new Date(draft.savedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  const custom = draft.answers.mode === "custom";
  const exercises = draft.custom.sessions.reduce((sum, s) => sum + s.items.length, 0);
  const sessions = draft.custom.sessions.length;
  const what = custom
    ? `${esc(draft.custom.name || "Programme sans nom")} · ${sessions} séance${sessions > 1 ? "s" : ""} · ${exercises} exercice${exercises > 1 ? "s" : ""}`
    : "Questionnaire du programme guidé";
  wiz.el.querySelector(".wz-body").innerHTML = `
    <h3 class="wz-q">Tu as un brouillon</h3>
    <p class="wz-hand">gardé le ${date}</p>
    <div class="wz-draft"><b>${what}</b><span>Tu reprends exactement là où tu t'étais arrêté.</span></div>
    <div class="wz-actions">
      <button type="button" class="btn btn-surface" data-wz="restart">Recommencer</button>
      <button type="button" class="btn btn-primary btn-grow" data-wz="resume">Reprendre</button>
    </div>`;
}

function close(done) {
  if (!wiz) return;
  if (done) clearDraft(wiz.draftKey);
  else if (!wiz.resuming && readDraft(wiz.draftKey)) showToast("Brouillon gardé : tu reprendras là où tu en étais");
  wiz.el.remove();
  const cb = done ? null : wiz.onDismiss;
  wiz = null;
  if (cb) cb();
}

function handleCustomAction(act, target) {
  const step = visibleSteps()[wiz.index];
  const c = wiz.custom;
  const session = step.kind === "build" ? c.sessions[step.session] : null;
  const i = Number(target.dataset.i);
  if (act === "preset") applyPreset(target.dataset.preset);
  if (act === "add-session") c.sessions.push({ name: `Séance ${c.sessions.length + 1}`, type: "full", dayKey: null, items: [] });
  if (act === "del-session") c.sessions.splice(i, 1);
  if (act === "del-ex" && session) session.items.splice(i, 1);
  if (act === "info") { wiz.showDetails?.(target.dataset.id); return; }
  if ((act === "up" || act === "down") && session) {
    const to = act === "up" ? i - 1 : i + 1;
    if (to < 0 || to >= session.items.length) return;
    [session.items[i], session.items[to]] = [session.items[to], session.items[i]];
    renderStep(true);
    // le focus suit l'exercice déplacé
    const same = wiz.el.querySelector(`[data-act="${act}"][data-i="${to}"]`);
    const other = wiz.el.querySelector(`[data-act="${act === "up" ? "down" : "up"}"][data-i="${to}"]`);
    (same && !same.disabled ? same : other)?.focus();
    return;
  }
  if (act === "suggest" && session) suggestItems(session);
  if (act === "create-ex" && session) {
    const index = step.session;
    wiz.createExercise(target.dataset.name, exercise => {
      if (!wiz) return;
      if (!wiz.exercises.some(ex => ex.id === exercise.id)) wiz.exercises.unshift(exercise);
      wiz.custom.sessions[index].items.push({ id: exercise.id, sets: 3, reps: 10, weight: "" });
      showAdded(exercise.id, false);
    });
    return;
  }
  if (act === "add-ex" && session) {
    const id = target.dataset.id;
    session.items.push({ id, sets: 3, reps: id === "plank" ? 45 : 10, weight: "" });
    showAdded(id, wiz.viaKeyboard);
    return;
  }
  renderStep(["del-ex", "suggest"].includes(act));
}

/** Après un ajout : l'exercice apparaît dans la liste, à l'écran, mis en valeur */
function showAdded(id, keepTyping) {
  wiz.flash = id;
  renderStep(true);
  wiz.flash = null;
  const item = wiz.el.querySelector(`[data-item="${CSS.escape(id)}"]`);
  item?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  if (keepTyping) wiz.el.querySelector("[data-search]")?.focus();
}

/**
 * Ouvre le questionnaire.
 * opts: { exercises, nameOf(exercise), bodyweight, onCreate(program, answers), onDismiss(),
 *         draftKey (clé du brouillon, propre au compte), showDetails(exerciseId) }
 */
export function openProgramWizard(opts) {
  if (wiz) return;
  const el = document.createElement("div");
  el.className = "modal wz-modal";
  el.innerHTML = `<div class="modal-card wz-card" role="dialog" aria-modal="true" aria-label="Créer mon programme">
    <div class="modal-head"><h3>Créer mon programme</h3><button class="icon-btn" data-wz="later" aria-label="fermer">✕</button></div>
    <div class="wz-body"></div></div>`;
  document.body.appendChild(el);

  wiz = {
    el, index: 0, program: null, level: null,
    exercises: opts.exercises || [],
    nameOf: opts.nameOf || (ex => ex?.name),
    onCreate: opts.onCreate, onDismiss: opts.onDismiss, createExercise: opts.createExercise, onNotion: opts.onNotion,
    draftKey: opts.draftKey || null, showDetails: opts.showDetails || null, resuming: false,
    answers: { bodyweight: opts.bodyweight || "", lifts: {}, liftReps: {}, liftAlt: {}, sex: "male" },
    custom: { preset: null, name: "", sessions: [] }
  };
  applyPreset("ppl_upper");

  // un clic à côté de la fenêtre ne ferme plus rien : seuls « Plus tard » et ✕ ferment
  el.addEventListener("click", event => {
    const resume = event.target.closest('[data-wz="resume"], [data-wz="restart"]');
    if (resume) {
      const draft = readDraft(wiz.draftKey);
      wiz.resuming = false;
      if (resume.dataset.wz === "resume" && draft) {
        Object.assign(wiz.answers, draft.answers);
        wiz.custom = draft.custom;
        wiz.index = draft.index;
      } else clearDraft(wiz.draftKey);
      renderStep();
      return;
    }
    if (wiz.resuming && !event.target.closest('[data-wz="later"]')) return;
    const custom = event.target.closest("[data-act]");
    if (custom) { handleCustomAction(custom.dataset.act, custom); return; }
    const sex = event.target.closest("[data-sex]");
    if (sex) { wiz.answers.sex = sex.dataset.sex; renderStep(); return; }
    const choice = event.target.closest("[data-v]");
    const steps = visibleSteps();
    const step = steps[wiz.index];
    if (choice) {
      const raw = choice.dataset.v;
      if (step.key === "mode" && raw === "notion" && wiz.onNotion) {
        const go = wiz.onNotion;
        close(false);
        go();
        return;
      }
      wiz.answers[step.key] = step.kind === "chips" ? Number(raw) : raw;
      // une réponse fermée fait avancer directement, comme un formulaire iOS
      wiz.index = Math.min(wiz.index + 1, visibleSteps().length - 1);
      renderStep();
      return;
    }
    const action = event.target.closest("[data-wz]")?.dataset.wz;
    if (action === "later") close(false);
    if (action === "back") { wiz.index = Math.max(0, wiz.index - 1); renderStep(); }
    if (action === "next") { wiz.index = Math.min(wiz.index + 1, steps.length - 1); renderStep(); }
    if (action === "create" && wiz.program) {
      const { program, level, answers, onCreate } = wiz;
      if (answers.mode === "custom") answers.days = program.sessions.length;
      if (level) {
        answers.levelScore = Math.round(level.score * 100) / 100;
        answers.levelLabel = level.label;
        if (answers.mode === "custom") answers.level = levelKey(level.index);
      }
      close(true);
      onCreate && onCreate(program, answers);
    }
  });

  el.addEventListener("input", event => {
    const t = event.target;
    const d = t.dataset;
    if (d.search === undefined) queueMicrotask(saveDraft);
    if (d.lift) {
      if (d.lift === "bodyweight") wiz.answers.bodyweight = t.value;
      else wiz.answers.lifts[d.lift] = t.value;
      return;
    }
    if (d.reps) { (wiz.answers.liftReps ||= {})[d.reps] = t.value; return; }
    if (d.alt) {
      (wiz.answers.liftAlt ||= {})[d.alt] = t.value;
      renderStep();
      wiz.el.querySelector(`[data-lift="${d.alt}"]`)?.focus();
      return;
    }
    if (d.search !== undefined) { renderSearchResults(t.value); return; }
    if (d.pname !== undefined) { wiz.custom.name = t.value; return; }
    if (d.sname !== undefined) { wiz.custom.sessions[Number(d.sname)].name = t.value; return; }
    if (d.field) {
      const session = wiz.custom.sessions[visibleSteps()[wiz.index].session];
      session.items[Number(d.i)][d.field] = t.value;
    }
  });

  el.addEventListener("change", event => {
    const d = event.target.dataset;
    if (d.stype === undefined) return;
    const session = wiz.custom.sessions[Number(d.stype)];
    session.type = event.target.value;
    session.dayKey = null;
    saveDraft();
  });

  // Entrée dans la recherche : ajoute le premier résultat
  el.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.target.dataset.search === undefined) return;
    event.preventDefault();
    const first = el.querySelector(".wz-result");
    if (!first) return;
    wiz.viaKeyboard = true;
    handleCustomAction(first.dataset.act, first);
    wiz.viaKeyboard = false;
  });

  const draft = readDraft(wiz.draftKey);
  if (draft) { wiz.resuming = true; renderResume(draft); }
  else renderStep();
}
