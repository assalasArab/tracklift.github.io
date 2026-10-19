/* ═══════════════════════════════════════════════════════════
   Assistant programme — questionnaire de départ + générateur.
   Pose quelques questions (objectif, niveau, fréquence, split,
   matériel, durée, charges de référence) puis construit un
   programme complet avec séries, répétitions et charges de départ.
   ═══════════════════════════════════════════════════════════ */

/* ---------- bibliothèque de mouvements ----------
   gym / db / bw : exercice pour salle complète, haltères seuls, poids du corps (null = pas d'équivalent)
   ref / ratio   : charge = mouvement de référence × ratio (par haltère pour les variantes db)
   dbRatio       : ratio spécifique à la variante haltères */
const SLOTS = {
  bench:    { gym: "barbell_bench_press_medium_grip", db: "dumbbell_bench_press", bw: "pushups", ref: "bench", ratio: 1, dbRatio: 0.38 },
  incline:  { gym: "incline_dumbbell_press", db: "incline_dumbbell_press", bw: "decline_push_up", ref: "bench", ratio: 0.32, dbRatio: 0.32 },
  ohp:      { gym: "standing_military_press", db: "dumbbell_shoulder_press", bw: "decline_push_up", ref: "ohp", ratio: 1, dbRatio: 0.4 },
  lateral:  { gym: "side_lateral_raise", db: "side_lateral_raise", bw: null, ref: "ohp", ratio: 0.18, dbRatio: 0.18 },
  fly:      { gym: "flat_bench_cable_flyes", db: "dumbbell_flyes", bw: null, ref: "bench", ratio: 0.2, dbRatio: 0.14 },
  pushdown: { gym: "triceps_pushdown", db: "dumbbell_one_arm_triceps_extension", bw: "bench_dips", ref: "bench", ratio: 0.35, dbRatio: 0.12 },
  overhead: { gym: "cable_rope_overhead_triceps_extension", db: "dumbbell_one_arm_triceps_extension", bw: "bench_dips", ref: "bench", ratio: 0.28, dbRatio: 0.12 },
  dips:     { gym: "dips_triceps_version", db: "bench_dips", bw: "bench_dips", ref: null },
  squat:    { gym: "barbell_squat", db: "goblet_squat", bw: "bodyweight_squat", ref: "squat", ratio: 1, dbRatio: 0.3 },
  rdl:      { gym: "romanian_deadlift", db: "stiff_legged_dumbbell_deadlift", bw: "single_leg_glute_bridge", ref: "deadlift", ratio: 0.6, dbRatio: 0.25 },
  deadlift: { gym: "barbell_deadlift", db: "stiff_legged_dumbbell_deadlift", bw: "single_leg_glute_bridge", ref: "deadlift", ratio: 1, dbRatio: 0.25 },
  legpress: { gym: "leg_press", db: "dumbbell_lunges", bw: "bodyweight_walking_lunge", ref: "squat", ratio: 1.6, dbRatio: 0.18 },
  lunge:    { gym: "split_squat_with_dumbbells", db: "split_squat_with_dumbbells", bw: "split_squats", ref: "squat", ratio: 0.2, dbRatio: 0.2 },
  legcurl:  { gym: "lying_leg_curls", db: "stiff_legged_dumbbell_deadlift", bw: "ball_leg_curl", ref: "squat", ratio: 0.35, dbRatio: 0.25 },
  legext:   { gym: "leg_extensions", db: null, bw: null, ref: "squat", ratio: 0.4 },
  calf:     { gym: "standing_calf_raises", db: "calf_raise_on_a_dumbbell", bw: "calf_raise_on_a_dumbbell", ref: "squat", ratio: 0.6, dbRatio: 0.2 },
  hipthrust:{ gym: "barbell_hip_thrust", db: "barbell_glute_bridge", bw: "single_leg_glute_bridge", ref: "squat", ratio: 0.9, dbRatio: 0.3 },
  row:      { gym: "bent_over_barbell_row", db: "one_arm_dumbbell_row", bw: "inverted_row", ref: "bench", ratio: 0.8, dbRatio: 0.35 },
  pulldown: { gym: "wide_grip_lat_pulldown", db: "pullups", bw: "pullups", ref: "bench", ratio: 0.7 },
  pullup:   { gym: "pullups", db: "pullups", bw: "pullups", ref: null },
  cablerow: { gym: "seated_cable_rows", db: "bent_over_two_dumbbell_row", bw: "inverted_row", ref: "bench", ratio: 0.7, dbRatio: 0.28 },
  facepull: { gym: "face_pull", db: "seated_bent_over_rear_delt_raise", bw: "superman", ref: "bench", ratio: 0.25, dbRatio: 0.08 },
  curl:     { gym: "barbell_curl", db: "dumbbell_bicep_curl", bw: "chin_up", ref: "bench", ratio: 0.35, dbRatio: 0.15 },
  hammer:   { gym: "hammer_curls", db: "hammer_curls", bw: null, ref: "bench", ratio: 0.16, dbRatio: 0.16 },
  shrug:    { gym: "barbell_shrug", db: "dumbbell_shrug", bw: null, ref: "deadlift", ratio: 0.6, dbRatio: 0.25 },
  abs:      { gym: "hanging_leg_raise", db: "plank", bw: "plank", ref: null },
  crunch:   { gym: "cable_crunch", db: "plank", bw: "mountain_climbers", ref: null, cable: 0.3 }
};

const BODYWEIGHT_IDS = new Set(["pushups", "pullups", "chin_up", "inverted_row", "bench_dips", "dips_triceps_version",
  "plank", "hanging_leg_raise", "mountain_climbers", "decline_push_up", "bodyweight_squat", "split_squats",
  "bodyweight_walking_lunge", "single_leg_glute_bridge", "ball_leg_curl", "superman"]);

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
  const given = answers.lifts || {};
  const ref = {
    bench: Number(given.bench) || 0,
    squat: Number(given.squat) || 0,
    deadlift: Number(given.deadlift) || 0,
    ohp: Number(given.ohp) || 0
  };
  if (!ref.ohp && ref.bench) ref.ohp = ref.bench * 0.62;
  if (!ref.deadlift && ref.squat) ref.deadlift = ref.squat * 1.2;
  if (!ref.squat && ref.deadlift) ref.squat = ref.deadlift * 0.82;
  Object.keys(ref).forEach(k => { if (!ref[k]) ref[k] = bw * f[k]; });
  return ref;
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

/* ═══════════════════ Questionnaire (feuille modale) ═══════════════════ */
const STEPS = [
  { key: "goal", q: "Quel est ton objectif principal ?", options: [
    ["muscle", "Prendre du muscle", "Hypertrophie, 8 à 12 répétitions"],
    ["force", "Gagner en force", "Charges lourdes, 5 répétitions sur les gros mouvements"],
    ["seche", "Sécher", "Garder le muscle en perdant du gras"],
    ["forme", "Me remettre en forme", "Bouger régulièrement, sans pression"]] },
  { key: "level", q: "Depuis combien de temps tu t'entraînes ?", options: [
    ["debutant", "Moins d'un an", "Débutant"],
    ["intermediaire", "1 à 3 ans", "Intermédiaire"],
    ["avance", "Plus de 3 ans", "Avancé"]] },
  { key: "days", q: "Combien de séances par semaine ?", chips: [2, 3, 4, 5, 6] },
  { key: "split", q: "Comment tu veux organiser tes séances ?", options: null },
  { key: "equipment", q: "Avec quel matériel ?", options: [
    ["gym", "Salle complète", "Barres, machines, poulies"],
    ["dumbbells", "Haltères seulement", "À la maison ou en salle basique"],
    ["bodyweight", "Poids du corps", "Sans matériel, une barre de traction au mieux"]] },
  { key: "duration", q: "Combien de temps par séance ?", chips: [45, 60, 75, 90], unit: "min" },
  { key: "lifts", q: "Combien tu soulèves ?", lifts: true },
  { key: "recap", q: "Ton programme", recap: true }
];

const LIFT_FIELDS = [
  ["bench", "Développé couché"],
  ["squat", "Squat"],
  ["deadlift", "Soulevé de terre"],
  ["ohp", "Développé militaire"]
];

let wiz = null;

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
  return STEPS.filter(step => !(step.lifts && wiz.answers.equipment === "bodyweight"));
}

function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function renderStep() {
  const steps = visibleSteps();
  const step = steps[wiz.index];
  const a = wiz.answers;
  const progress = ((wiz.index + 1) / steps.length) * 100;
  let body = "";

  if (step.options !== undefined && !step.recap && !step.lifts && !step.chips) {
    const options = step.key === "split" ? splitOptions(Number(a.days) || 3) : step.options;
    body = `<div class="wz-options">${options.map(([v, l, d]) => `
      <button type="button" class="wz-option${a[step.key] === v ? " on" : ""}" data-v="${v}">
        <span class="wz-option-l">${l}</span><span class="wz-option-d">${d}</span>
      </button>`).join("")}</div>`;
  } else if (step.chips) {
    body = `<div class="wz-chips">${step.chips.map(v => `
      <button type="button" class="wz-chip${Number(a[step.key]) === v ? " on" : ""}" data-v="${v}">${v}<small>${step.unit || (v > 1 ? "séances" : "séance")}</small></button>`).join("")}</div>`;
  } else if (step.lifts) {
    const lifts = a.lifts || {};
    body = `
      <p class="wz-help">Indique la charge que tu fais pour <b>environ 8 répétitions</b>. Laisse vide si tu ne sais pas : on l'estimera à partir de ton poids et de ton niveau.</p>
      <div class="wz-lifts">
        <label class="wz-lift"><span>Poids de corps</span><input type="number" inputmode="decimal" data-lift="bodyweight" value="${esc(a.bodyweight)}" placeholder="75" min="30" max="250" step="0.5"><em>kg</em></label>
        ${LIFT_FIELDS.map(([k, l]) => `<label class="wz-lift"><span>${l}</span><input type="number" inputmode="decimal" data-lift="${k}" value="${esc(lifts[k])}" placeholder="—" min="0" max="500" step="2.5"><em>kg</em></label>`).join("")}
      </div>`;
  } else if (step.recap) {
    const program = generateProgram(a, wiz.exercises);
    wiz.program = program;
    body = `
      <div class="wz-recap-head"><b>${esc(program.name)}</b><span>${esc(program.description)}</span></div>
      <div class="wz-sessions">${program.sessions.map(s => `
        <div class="wz-session">
          <div class="wz-session-h">${esc(s.name)}<span>${s.exerciseIds.length} exercices</span></div>
          ${s.exerciseIds.map(id => {
            const p = s.plan[id];
            const ex = wiz.exercises.find(e => e.id === id);
            return `<div class="wz-ex"><span>${esc(wiz.nameOf(ex) || id)}</span><b>${p.sets}×${p.reps}${id === "plank" ? " s" : ""}${p.weight ? ` · ${String(p.weight).replace(".", ",")} kg` : ""}</b></div>`;
          }).join("")}
        </div>`).join("")}
      </div>
      <p class="wz-help">Enchaîne les séances dans l'ordre, ${a.days} fois par semaine. Après chaque séance réussie, l'appli te proposera automatiquement +2,5 kg.</p>`;
  }

  const canNext = step.recap || step.lifts || a[step.key] !== undefined;
  wiz.el.querySelector(".wz-body").innerHTML = `
    <div class="wz-progress"><div style="width:${progress}%"></div></div>
    <div class="wz-step">Étape ${wiz.index + 1} sur ${steps.length}</div>
    <h3 class="wz-q">${step.q}</h3>
    ${body}
    <div class="wz-actions">
      ${wiz.index > 0 ? `<button type="button" class="btn btn-surface" data-wz="back">Retour</button>` : `<button type="button" class="btn btn-surface" data-wz="later">Plus tard</button>`}
      <button type="button" class="btn btn-primary btn-grow" data-wz="${step.recap ? "create" : "next"}" ${canNext ? "" : "disabled"}>${step.recap ? "Créer mon programme" : "Continuer"}</button>
    </div>`;
}

function close(done) {
  if (!wiz) return;
  wiz.el.remove();
  const cb = done ? null : wiz.onDismiss;
  wiz = null;
  if (cb) cb();
}

/**
 * Ouvre le questionnaire.
 * opts: { exercises, nameOf(exercise), bodyweight, onCreate(program, answers), onDismiss() }
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
    el, index: 0, program: null,
    exercises: opts.exercises || [],
    nameOf: opts.nameOf || (ex => ex?.name),
    onCreate: opts.onCreate, onDismiss: opts.onDismiss,
    answers: { bodyweight: opts.bodyweight || "", lifts: {} }
  };

  el.addEventListener("click", event => {
    if (event.target === el) { close(false); return; }
    const choice = event.target.closest("[data-v]");
    const steps = visibleSteps();
    const step = steps[wiz.index];
    if (choice) {
      const raw = choice.dataset.v;
      wiz.answers[step.key] = step.chips ? Number(raw) : raw;
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
      const { program, answers, onCreate } = wiz;
      close(true);
      onCreate && onCreate(program, answers);
    }
  });
  el.addEventListener("input", event => {
    const key = event.target.dataset.lift;
    if (!key) return;
    if (key === "bodyweight") wiz.answers.bodyweight = event.target.value;
    else wiz.answers.lifts[key] = event.target.value;
  });

  renderStep();
}
