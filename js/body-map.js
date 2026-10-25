/* ═══════════════════════════════════════════════════════════
   Carte du corps cliquable (bibliothèque d'exercices) :
   silhouettes de face et de dos, chaque muscle est une zone à toucher
   qui filtre la liste sur les exercices qui le travaillent.
   Schémas : wger.de, licence CC-BY-SA 3.0.
   ═══════════════════════════════════════════════════════════ */
import { MUSCLE_LAYERS } from "./body-map-data.js?v=20261025l";

/* zone → calques dessinés + muscles RepDB qui la font travailler.
   « secondary » : muscle jamais principal, on cherche alors dans les secondaires. */
export const BODY_ZONES = {
  pecs:      { fr: "Pectoraux", en: "Chest", layers: [4], primary: ["pectoralis_major"] },
  epaules:   { fr: "Épaules", en: "Shoulders", layers: [2], primary: ["anterior_deltoid", "lateral_deltoid"] },
  biceps:    { fr: "Biceps", en: "Biceps", layers: [1], primary: ["biceps_brachii", "brachialis"] },
  avantbras: { fr: "Avant-bras", en: "Forearms", layers: [13], primary: ["brachioradialis", "forearm_flexors", "forearm_extensors", "forearms"] },
  dentele:   { fr: "Dentelé", en: "Serratus", layers: [3], secondary: ["serratus_anterior"] },
  abdos:     { fr: "Abdos", en: "Abs", layers: [6], primary: ["rectus_abdominis", "transverse_abdominis"] },
  obliques:  { fr: "Obliques", en: "Obliques", layers: [14], primary: ["obliques"] },
  cuisses:   { fr: "Quadriceps", en: "Quads", layers: [10], primary: ["quadriceps"] },
  hautdos:   { fr: "Trapèzes et haut du dos", en: "Traps and upper back", layers: [9], primary: ["trapezius", "rhomboids", "posterior_deltoid", "supraspinatus"] },
  dorsaux:   { fr: "Grand dorsal", en: "Lats", layers: [12], primary: ["latissimus_dorsi"] },
  triceps:   { fr: "Triceps", en: "Triceps", layers: [5], primary: ["triceps_brachii"] },
  lombaires: { fr: "Lombaires", en: "Lower back", layers: [16], primary: ["erector_spinae", "quadratus_lumborum"] },
  fessiers:  { fr: "Fessiers", en: "Glutes", layers: [8], primary: ["gluteus_maximus", "gluteus_medius", "abductors"] },
  ischios:   { fr: "Ischio-jambiers", en: "Hamstrings", layers: [11], primary: ["hamstrings"] },
  mollets:   { fr: "Mollets", en: "Calves", layers: [7, 15], primary: ["gastrocnemius", "soleus", "tibialis_anterior"] }
};

const LAYER_ZONE = {};
Object.entries(BODY_ZONES).forEach(([key, zone]) => zone.layers.forEach(id => { LAYER_ZONE[id] = key; }));

export function zoneName(key, lang = "fr") {
  const zone = BODY_ZONES[key];
  return zone ? zone[lang] || zone.fr : "";
}

/** true si l'exercice fait travailler la zone */
export function exerciseInZone(exercise, key) {
  const zone = BODY_ZONES[key];
  if (!zone) return true;
  const pick = zone.primary ? exercise?.primary_muscles : exercise?.secondary_detail;
  const wanted = zone.primary || zone.secondary;
  return (pick || []).some(muscle => wanted.includes(muscle));
}

/** Ordre dans la liste : d'abord les exercices dont c'est le muscle principal n°1,
    les niveaux avancés après, les étirements tout à la fin. Plus petit = plus haut. */
export function zoneRank(exercise, key) {
  const zone = BODY_ZONES[key];
  const stretch = exercise?.contraction_type === "etirement" ? 4 : 0;
  const main = zone?.primary?.includes(exercise?.primary_muscles?.[0]) ? 0 : 2;
  const expert = exercise?.difficulty === "avance" ? 1 : 0; // figures de gym (front lever…) en fin de groupe
  return stretch + main + expert;
}

function figure(side, selected, lang, caption) {
  const layers = Object.entries(MUSCLE_LAYERS)
    .filter(([, layer]) => layer.side === side)
    .map(([id, layer]) => {
      const key = LAYER_ZONE[id];
      if (!key) return "";
      const on = key === selected;
      return `<svg class="bm-layer" viewBox="0 0 ${layer.w} ${layer.h}" aria-hidden="false" focusable="false">
        <g class="bm-zone${on ? " is-on" : ""}" data-zone="${key}" role="button" tabindex="0" aria-pressed="${on}" aria-label="${zoneName(key, lang)}">${layer.svg}</g>
      </svg>`;
    }).join("");
  return `<figure class="bm-fig">
    <div class="bm-stack"><img class="bm-base" src="./assets/muscles/muscular_system_${side}.svg" alt="">${layers}</div>
    <figcaption>${caption}</figcaption>
  </figure>`;
}

/** Silhouettes face + dos. labels : { front, back } déjà traduits. */
export function bodyMapHtml(selected, { lang = "fr", labels = {} } = {}) {
  return figure("front", selected, lang, labels.front || "face") + figure("back", selected, lang, labels.back || "dos");
}
