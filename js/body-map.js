/* ═══════════════════════════════════════════════════════════
   Carte du corps cliquable (bibliothèque d'exercices) :
   silhouettes de face et de dos, chaque muscle est une zone à toucher
   qui filtre la liste sur les exercices qui le travaillent.
   Schémas : wger.de, licence CC-BY-SA 3.0.
   ═══════════════════════════════════════════════════════════ */
import { MUSCLE_LAYERS } from "./body-map-data.js?v=20261028a";

/* zone → calques dessinés + muscles qui la font travailler.
   « withSecondary » : peu d'exercices le ciblent en premier, on ajoute ceux où il travaille en second (affichés après). */
export const BODY_ZONES = {
  pecs:      { fr: "Pectoraux", en: "Chest", layers: [4], primary: ["pectoralis_major"] },
  epaules:   { fr: "Épaules", en: "Shoulders", layers: [2], primary: ["anterior_deltoid", "lateral_deltoid"] },
  biceps:    { fr: "Biceps", en: "Biceps", layers: [1], primary: ["biceps_brachii", "brachialis"] },
  avantbras: { fr: "Avant-bras", en: "Forearms", layers: [13], primary: ["brachioradialis", "forearm_flexors", "forearm_extensors", "forearms"] },
  dentele:   { fr: "Dentelé", en: "Serratus", layers: [3], primary: ["serratus_anterior"], withSecondary: true },
  abdos:     { fr: "Abdos", en: "Abs", layers: [6], primary: ["rectus_abdominis", "transverse_abdominis"] },
  obliques:  { fr: "Obliques", en: "Obliques", layers: [14], primary: ["obliques"] },
  cuisses:   { fr: "Quadriceps", en: "Quads", layers: [10], primary: ["quadriceps"] },
  hautdos:   { fr: "Trapèzes et haut du dos", en: "Traps and upper back", layers: [9], primary: ["trapezius", "rhomboids", "supraspinatus"] },
  arrepaule: { fr: "Arrière d'épaule", en: "Rear delts", layers: ["rear-delt"], primary: ["posterior_deltoid"] },
  dorsaux:   { fr: "Grand dorsal", en: "Lats", layers: [12], primary: ["latissimus_dorsi"] },
  triceps:   { fr: "Triceps", en: "Triceps", layers: [5], primary: ["triceps_brachii"] },
  lombaires: { fr: "Lombaires", en: "Lower back", layers: [16], primary: ["erector_spinae", "quadratus_lumborum"] },
  fessiers:  { fr: "Fessiers", en: "Glutes", layers: [8], primary: ["gluteus_maximus", "gluteus_medius", "abductors"] },
  ischios:   { fr: "Ischio-jambiers", en: "Hamstrings", layers: [11], primary: ["hamstrings"] },
  mollets:   { fr: "Mollets", en: "Calves", layers: [7, 15], primary: ["gastrocnemius", "soleus", "tibialis_anterior"] }
};

/* wger n'a pas de calque pour l'arrière d'épaule : on reprend la forme du deltoïde de face,
   posée au même endroit sur la silhouette de dos (les deux vues ont le même cadrage). */
const LAYERS = { ...MUSCLE_LAYERS, "rear-delt": { ...MUSCLE_LAYERS[2], side: "back" } };

const LAYER_ZONE = {};
Object.entries(BODY_ZONES).forEach(([key, zone]) => zone.layers.forEach(id => { LAYER_ZONE[id] = key; }));

export function zoneName(key, lang = "fr") {
  const zone = BODY_ZONES[key];
  return zone ? zone[lang] || zone.fr : "";
}

/** true si l'exercice fait travailler la zone */
const hits = (list, wanted) => (list || []).some(muscle => wanted.includes(muscle));

export function exerciseInZone(exercise, key) {
  const zone = BODY_ZONES[key];
  if (!zone) return true;
  return hits(exercise?.primary_muscles, zone.primary) || (zone.withSecondary && hits(exercise?.secondary_detail, zone.primary));
}

/** Ordre dans la liste (plus petit = plus haut) : muscle principal n°1, puis principal,
    puis secondaire ; les niveaux avancés en fin de groupe ; cardio et étirements tout à la fin. */
export function zoneRank(exercise, key) {
  const zone = BODY_ZONES[key];
  if (!zone) return 0;
  const last = ["etirement", "cardio"].includes(exercise?.contraction_type) ? 16 : 0;
  const role = zone.primary.includes(exercise?.primary_muscles?.[0]) ? 0 : hits(exercise?.primary_muscles, zone.primary) ? 4 : 8;
  const expert = exercise?.difficulty === "avance" ? 1 : 0; // figures de gym (front lever…) en fin de groupe
  return last + role + expert;
}

function figure(side, selected, lang, caption) {
  const sideLayers = Object.entries(LAYERS).filter(([id, layer]) => layer.side === side && LAYER_ZONE[id]);
  const box = layer => `viewBox="0 0 ${layer.w} ${layer.h}" focusable="false"`;
  // 1) marges invisibles, toutes SOUS les muscles : elles n'attrapent que les touchers tombés à côté
  const hits = sideLayers.map(([id, layer]) =>
    `<svg class="bm-layer" ${box(layer)} aria-hidden="true"><g class="bm-hit" data-zone="${LAYER_ZONE[id]}">${layer.svg}</g></svg>`).join("");
  // 2) les muscles visibles, chacun est un bouton
  const zones = sideLayers.map(([id, layer]) => {
    const key = LAYER_ZONE[id];
    const on = key === selected;
    return `<svg class="bm-layer" ${box(layer)}>
        <g class="bm-zone${on ? " is-on" : ""}" data-zone="${key}" role="button" tabindex="0" aria-pressed="${on}" aria-label="${zoneName(key, lang)}">${layer.svg}</g>
      </svg>`;
  }).join("");
  return `<figure class="bm-fig">
    <div class="bm-stack"><img class="bm-base" src="./assets/muscles/muscular_system_${side}.svg?c=olive1" alt="">${hits}${zones}</div>
    <figcaption>${caption}</figcaption>
  </figure>`;
}

/** Silhouettes face + dos. labels : { front, back } déjà traduits. */
export function bodyMapHtml(selected, { lang = "fr", labels = {} } = {}) {
  return figure("front", selected, lang, labels.front || "face") + figure("back", selected, lang, labels.back || "dos");
}
