/* ═══════════════════════════════════════════════════════════
   Bases Notion → programme TrackLift.
   Format visé (ex. « salas workout ») : une base par séance,
   une ligne = une série (Exercice, Poids, Répétition, Type chauffe/travail,
   Poids 2 / Répétition 2 = baisse de charge, STATUT actif / en pause).
   Fonctionne aussi avec « une ligne = un exercice » si une colonne Séries existe.
   Aucune dépendance au DOM : testable seul.
   ═══════════════════════════════════════════════════════════ */

export function norm(value) {
  return String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** « Hack squat variante gym80 (2) » → « Hack squat variante gym80 » */
export function cleanName(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, " ").trim();
}

const STOPWORDS = new Set(["a", "au", "aux", "de", "des", "du", "d", "la", "le", "les", "l", "en", "et", "avec", "sur", "un", "une", "the", "with", "on", "of"]);

function stem(token) {
  let t = token;
  if (t.length > 4 && /[sx]$/.test(t)) t = t.slice(0, -1);
  while (t.length > 4 && t.endsWith("e")) t = t.slice(0, -1);
  return t;
}

export function tokens(value) {
  return norm(value).split(" ").filter(t => t && !STOPWORDS.has(t)).map(stem);
}

function lev(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Deux mots identiques à une faute de frappe près (« horizental » ≈ « horizontal ») */
function sameToken(a, b) {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  if (min >= 5 && lev(a, b) <= 1) return true;
  if (min >= 8 && lev(a, b) <= 2) return true;
  return false;
}

function overlap(a, b) {
  const used = new Set();
  let hits = 0;
  for (const x of a) {
    const j = b.findIndex((y, idx) => !used.has(idx) && sameToken(x, y));
    if (j >= 0) { used.add(j); hits++; }
  }
  return hits;
}

/** Similarité 0..1 entre deux listes de mots */
export function similarity(a, b) {
  if (!a.length || !b.length) return 0;
  const hits = overlap(a, b);
  const dice = (2 * hits) / (a.length + b.length);
  // le nom de référence est entièrement contenu (« Hack squat » dans « Hack squat variante gym80 »)
  const contained = b.length >= 2 && hits === b.length ? 0.75 : 0;
  return Math.max(dice, contained);
}

/* Noms courants en salle → identifiants RepDB */
const ALIASES = [
  ["pec fly", "pec-deck"], ["pec deck", "pec-deck"], ["butterfly", "pec-deck"], ["ecarte machine", "machine-chest-fly"],
  ["tirage horizontal", "seated-cable-row"], ["rowing assis", "seated-cable-row"], ["tirage horizontal poulie", "seated-cable-row"],
  ["traction verticale", "lat-pulldown"], ["tirage vertical", "lat-pulldown"], ["tirage poitrine", "lat-pulldown"], ["lat pulldown", "lat-pulldown"],
  ["traction", "pull-up"], ["traction lestee", "weighted-pull-up"],
  ["arriere d epaule", "machine-reverse-fly"], ["arriere epaule machine", "machine-reverse-fly"], ["oiseau machine", "machine-reverse-fly"], ["oiseau", "rear-delt-fly"],
  ["presse", "leg-press"], ["presse a cuisse", "leg-press"], ["presse jambe", "leg-press"],
  ["extension quadriceps", "leg-extension"], ["leg extension", "leg-extension"], ["extension jambe", "leg-extension"],
  ["leg curl", "seated-leg-curl"], ["leg curl assis", "seated-leg-curl"], ["leg curl allonge", "lying-leg-curl"],
  ["elevation laterale", "lateral-raise"], ["elevation laterale haltere", "lateral-raise"], ["elevation laterale machine", "plate-loaded-lateral-raise"], ["elevation laterale poulie", "cable-lateral-raise"],
  ["curl marteau", "hammer-curl"], ["curl marteau poulie", "cable-hammer-curl"], ["curl poulie marteau", "cable-hammer-curl"],
  ["curl poulie", "cable-curl"], ["curl pupitre", "preacher-curl"], ["curl larry scott", "preacher-curl"], ["curl barre", "barbell-curl"],
  ["triceps poulie", "tricep-pushdown"], ["triceps poulie haute", "tricep-pushdown"], ["pushdown", "tricep-pushdown"], ["extension triceps poulie", "tricep-pushdown"],
  ["triceps corde dessus tete", "cable-overhead-tricep-extension"], ["extension triceps nuque poulie", "cable-overhead-tricep-extension"],
  ["developpe couche", "bench-press"], ["developpe incline", "incline-bench-press"], ["developpe incline smith", "smith-machine-incline-bench-press"],
  ["developpe militaire", "ohp"], ["developpe epaule", "dumbbell-shoulder-press"], ["developpe epaule machine", "machine-shoulder-press"],
  ["souleve de terre", "deadlift"], ["squat", "squat"], ["hack squat", "hack-squat"], ["crunch", "crunches"], ["crunch poulie", "cable-crunch"]
];

/** Index de recherche : [{ id, toks, alias }] */
export function buildIndex(exercises) {
  const ids = new Set(exercises.map(e => e.id));
  const index = [];
  for (const ex of exercises) {
    for (const label of [ex.name_fr, ex.name]) {
      const toks = tokens(label);
      if (toks.length) index.push({ id: ex.id, toks, alias: false });
    }
  }
  for (const [phrase, id] of ALIASES) if (ids.has(id)) index.push({ id, toks: tokens(phrase), alias: true });
  return index;
}

/** Meilleures correspondances pour un nom : [{ id, score }] triées */
export function suggest(name, index, limit = 5) {
  const toks = tokens(name);
  const best = new Map();
  for (const entry of index) {
    let score = similarity(toks, entry.toks);
    if (!score) continue;
    if (entry.alias && score === 1) score = 1.01; // un alias exact l'emporte sur un nom proche
    // à score égal, le nom le plus court (le plus générique) passe devant
    score -= entry.toks.length * 0.001;
    if (score > (best.get(entry.id) ?? 0)) best.set(entry.id, score);
  }
  return [...best.entries()].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score).slice(0, limit);
}

export const AUTO_MATCH = 0.7;

/* ---------- colonnes ---------- */
const isDrop = c => /(baisse|drop|d[eé]gressi|\b2\b)/i.test(c);

export function guessProgramMapping(columns, rows = []) {
  const cols = columns.filter(c => !c.startsWith("__"));
  const used = new Set();
  const take = test => {
    const col = cols.find(c => !used.has(c) && test(c));
    if (col) used.add(col);
    return col || "";
  };
  const valuesOf = col => rows.map(r => String(r[col] ?? "").trim()).filter(Boolean);

  const mapping = {};
  mapping.dropWeight = take(c => isDrop(c) && /(poids|charge|kg|weight|load)/i.test(c));
  mapping.dropReps = take(c => isDrop(c) && /(r[eé]p|reps?)/i.test(c));
  mapping.exercise = take(c => /(exercice|exercise|mouvement|movement|\bexo\b)/i.test(c));
  mapping.sets = take(c => /^\s*(s[eé]ries?|sets?|nb ?s[eé]ries)\s*$/i.test(c));
  mapping.reps = take(c => /(r[eé]p[eé]titions?|\breps?\b|r[eé]ps?)/i.test(c) && !/total/i.test(c));
  mapping.weight = take(c => /(poids|charge|\bkg\b|weight|load)/i.test(c) && !/total/i.test(c));
  mapping.kind = take(c => valuesOf(c).some(v => /^(chauffe|[eé]chauffement|warm ?-?up|approche)/i.test(v)));
  mapping.status = take(c => /(statut|status|[eé]tat)/i.test(c) || valuesOf(c).some(v => /^(en pause|pause|inactif|archiv)/i.test(v)));
  if (!mapping.exercise) {
    // repli : première colonne surtout textuelle
    mapping.exercise = take(c => {
      const v = valuesOf(c);
      return v.length && v.filter(x => isNaN(Number(x.replace(",", ".")))).length / v.length > 0.8;
    });
  }
  return mapping;
}

function num(value) {
  if (value === "" || value == null) return 0;
  if (typeof value === "number") return value;
  const m = String(value).replace(",", ".").match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
}

export function isPaused(value) {
  return /^(en pause|pause|inactif|inactive|paused|off|archiv|stop)/i.test(String(value ?? "").trim());
}

/* ---------- séance ---------- */
export function guessSessionType(title, matchedTypes = []) {
  const n = norm(title);
  if (/\bpush\b|\bpec|pouss|p ou ush/.test(n)) return "push";
  if (/\bpull\b|\bdos\b|tirage/.test(n)) return "pull";
  if (/\bleg|jambe|\bbas\b|squat|lower/.test(n)) return "legs";
  if (/upper|\bhaut\b|full|complet/.test(n)) return "full";
  const counts = {};
  matchedTypes.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "other";
}

/**
 * Lit une base et regroupe ses lignes par exercice.
 * → { exercises: [{ key, name, sets:[{reps, weight, kind}] }], paused, empty }
 */
export function parseSessionTable(rows, mapping, { includePaused = false } = {}) {
  const groups = [];
  let paused = 0, empty = 0;
  const ordered = [...rows].sort((a, b) => String(a.__created || "").localeCompare(String(b.__created || "")));
  for (const row of ordered) {
    const raw = cleanName(row[mapping.exercise]);
    if (!raw) { empty++; continue; }
    if (mapping.status && isPaused(row[mapping.status])) {
      if (!includePaused) { paused++; continue; }
    }
    const toks = tokens(raw);
    // ligne séparatrice (« EXO EN PAUSE ») : un nom sans aucune valeur
    const blank = [mapping.reps, mapping.weight, mapping.kind, mapping.dropReps, mapping.dropWeight, mapping.sets]
      .every(col => !col || String(row[col] ?? "").trim() === "" || String(row[col]).trim() === "0");
    if (!toks.length || blank) { empty++; continue; }
    // même exercice malgré la casse, les accents, « (1) » ou une faute de frappe
    let group = groups.find(g => g.toks.length === toks.length && overlap(g.toks, toks) === toks.length);
    if (!group) { group = { key: toks.join(" "), toks, names: {}, sets: [] }; groups.push(group); }
    group.names[raw] = (group.names[raw] || 0) + 1;

    const warm = mapping.kind && /^(chauffe|[eé]chauffement|warm|approche)/i.test(String(row[mapping.kind] ?? "").trim());
    const reps = Math.round(num(row[mapping.reps]));
    const weight = num(row[mapping.weight]);
    const count = Math.max(1, Math.min(10, Math.round(num(row[mapping.sets])) || 1));
    for (let i = 0; i < count; i++) group.sets.push({ reps, weight, kind: warm ? "warmup" : "work" });
    const dropReps = Math.round(num(row[mapping.dropReps]));
    const dropWeight = num(row[mapping.dropWeight]);
    if (dropReps > 0 || dropWeight > 0) group.sets.push({ reps: dropReps, weight: dropWeight || weight, kind: "drop" });
  }
  const exercises = groups.map(g => {
    // nom affiché : la graphie la plus fréquente, sinon la plus courte
    const name = Object.entries(g.names).sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
    // séries de chauffe d'abord, l'ordre de saisie est conservé ensuite
    const sets = [...g.sets.filter(s => s.kind === "warmup"), ...g.sets.filter(s => s.kind !== "warmup")];
    return { key: g.key, name, sets };
  });
  return { exercises, paused, empty };
}

/** Plan TrackLift d'un exercice à partir de ses séries */
export function planFromSets(sets) {
  const work = sets.filter(s => s.kind === "work");
  const ref = work.length ? work : sets;
  const firstReps = ref.find(s => s.reps > 0)?.reps || 10;
  return {
    sets: Math.max(1, work.length || sets.length),
    reps: firstReps,
    weight: Math.max(0, ...ref.map(s => s.weight || 0)),
    setList: sets.map(s => ({ reps: s.reps || firstReps, weight: s.weight || 0, kind: s.kind }))
  };
}

/** Résumé lisible : « 1 chauffe · 2 séries · 81 kg max · 1 baisse de charge » */
export function describeSets(sets) {
  const warm = sets.filter(s => s.kind === "warmup").length;
  const work = sets.filter(s => s.kind === "work");
  const drop = sets.filter(s => s.kind === "drop").length;
  const max = Math.max(0, ...work.map(s => s.weight || 0));
  const reps = [...new Set(work.map(s => s.reps).filter(Boolean))];
  const parts = [];
  if (warm) parts.push(`${warm} chauffe${warm > 1 ? "s" : ""}`);
  parts.push(`${work.length} série${work.length > 1 ? "s" : ""}${reps.length ? ` × ${reps.slice(0, 4).join("/")}` : ""}`);
  if (max) parts.push(`${String(max).replace(".", ",")} kg`);
  if (drop) parts.push(`${drop} baisse${drop > 1 ? "s" : ""} de charge`);
  return parts.join(" · ");
}
