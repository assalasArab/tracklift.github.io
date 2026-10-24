/* ═══════════════════════════════════════════════════════════
   Carte musculaire — silhouette de face / de dos avec les muscles
   sollicités en surbrillance (principal en rouge, secondaires en orange),
   et liste des muscles avec leur vignette.
   Schémas : wger.de, licence CC-BY-SA 3.0 (copiés dans assets/muscles).
   Vignettes et données musculaires : RepDB (repdb.co).
   ═══════════════════════════════════════════════════════════ */
import { muscleName, muscleThumb, muscleWgerIds } from "./muscles.js?v=20261024e";

const BASE = "./assets/muscles";

const FRONT = new Set([1, 2, 3, 4, 6, 10, 13, 14]);

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
  return muscleWgerIds(exercise?.primary_muscles).size > 0;
}

/**
 * Silhouettes face + dos. size : "sm" (encart de séance) ou "md" (fiche exercice).
 * label : texte accessible déjà traduit, ex. "Grand pectoral · Triceps".
 */
export function muscleMapHtml(exercise, { size = "md", label = "" } = {}) {
  const main = muscleWgerIds(exercise?.primary_muscles);
  if (!main.size) return "";
  const secondary = muscleWgerIds(exercise.secondary_detail);
  main.forEach(id => secondary.delete(id));
  const needsBack = [...main, ...secondary].some(id => !FRONT.has(id));
  const needsFront = [...main, ...secondary].some(id => FRONT.has(id));
  return `<div class="mm mm-${size}" role="img" aria-label="${label.replace(/"/g, "&quot;")}">
    ${needsFront || size === "md" ? figure("front", main, secondary) : ""}
    ${needsBack || size === "md" ? figure("back", main, secondary) : ""}
  </div>`;
}

/** Libellé court des muscles principaux, ex. "Grand pectoral · Triceps" */
export function primaryMusclesLabel(exercise, lang = "fr") {
  return (exercise?.primary_muscles || []).map(key => muscleName(key, lang)).join(" · ");
}

/**
 * Grille de vignettes : muscles principaux puis secondaires.
 * labels : { primary, secondary } déjà traduits.
 */
export function muscleChipsHtml(exercise, { lang = "fr", labels = {} } = {}) {
  const chip = (key, role) => {
    const thumb = muscleThumb(key);
    return `<div class="mchip mchip-${role}">
      ${thumb ? `<img src="${thumb}" alt="" loading="lazy">` : `<span class="mchip-ph"></span>`}
      <span>${muscleName(key, lang)}</span>
    </div>`;
  };
  const primary = exercise?.primary_muscles || [];
  const secondary = exercise?.secondary_detail || [];
  if (!primary.length) return "";
  return `
    <div class="mchips-group"><div class="mchips-title"><i class="mm-main"></i>${labels.primary || ""}</div>
      <div class="mchips">${primary.map(key => chip(key, "main")).join("")}</div></div>
    ${secondary.length ? `<div class="mchips-group"><div class="mchips-title"><i class="mm-sec"></i>${labels.secondary || ""}</div>
      <div class="mchips">${secondary.map(key => chip(key, "sec")).join("")}</div></div>` : ""}`;
}
