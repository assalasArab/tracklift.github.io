/* ═══════════════════════════════════════════════════════════
   Carte musculaire — silhouette de face / de dos avec les muscles
   sollicités en surbrillance (principal en rouge, secondaires en orange).
   Schémas : wger.de, licence CC-BY-SA 3.0 (copiés dans assets/muscles).
   ═══════════════════════════════════════════════════════════ */

const BASE = "./assets/muscles";

/* identifiants wger : 1 biceps, 2 deltoïde antérieur, 3 dentelé, 4 pectoraux, 5 triceps, 6 grand droit,
   7 gastrocnémien, 8 grand fessier, 9 trapèze, 10 quadriceps, 11 ischios, 12 grand dorsal,
   13 brachial, 14 obliques, 15 soléaire */
const FRONT = new Set([1, 2, 3, 4, 6, 10, 13, 14]);

const MUSCLE_IDS = {
  pectoraux: [4],
  epaules: [2],
  triceps: [5],
  biceps: [1, 13],
  avant_bras: [13],
  abdominaux: [6, 14],
  quadriceps: [10],
  ischio_jambiers: [11],
  fessiers: [8],
  mollets: [7, 15],
  dos: [12],
  trapeces: [9],
  bas_dos: [12],
  adducteurs: [10],
  abducteurs: [8]
};

function idsFor(keys) {
  const out = new Set();
  (keys || []).forEach(key => (MUSCLE_IDS[key] || []).forEach(id => out.add(id)));
  return out;
}

function figure(side, main, secondary) {
  const keep = id => (side === "front") === FRONT.has(id);
  const layers = [
    ...[...secondary].filter(keep).map(id => `<img src="${BASE}/secondary/muscle-${id}.svg" alt="" loading="lazy">`),
    ...[...main].filter(keep).map(id => `<img src="${BASE}/main/muscle-${id}.svg" alt="" loading="lazy">`)
  ];
  return `<div class="mm-fig"><img class="mm-base" src="${BASE}/muscular_system_${side}.svg" alt="" loading="lazy">${layers.join("")}</div>`;
}

/** true si au moins un muscle de l'exercice peut être dessiné */
export function hasMuscleMap(exercise) {
  return idsFor([exercise?.muscle_focus]).size > 0;
}

/**
 * Silhouettes face + dos. size : "sm" (encart de séance) ou "md" (fiche exercice).
 * labels : texte accessible déjà traduit, ex. "Pectoraux · Triceps".
 */
export function muscleMapHtml(exercise, { size = "md", label = "" } = {}) {
  const main = idsFor([exercise?.muscle_focus]);
  if (!main.size) return "";
  const secondary = idsFor(exercise.secondary_muscles);
  main.forEach(id => secondary.delete(id));
  const needsBack = [...main, ...secondary].some(id => !FRONT.has(id));
  const needsFront = [...main, ...secondary].some(id => FRONT.has(id));
  return `<div class="mm mm-${size}" role="img" aria-label="${label.replace(/"/g, "&quot;")}">
    ${needsFront || size === "md" ? figure("front", main, secondary) : ""}
    ${needsBack || size === "md" ? figure("back", main, secondary) : ""}
  </div>`;
}
