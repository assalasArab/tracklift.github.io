/* ═══════════════════════════════════════════════════════════
   Muscles anatomiques (base RepDB) : noms FR / EN, calques de la
   silhouette wger (assets/muscles/{main,secondary}/muscle-N.svg)
   et vignettes RepDB (assets/muscles/repdb/*.webp).
   ═══════════════════════════════════════════════════════════ */

/* wger : 1 biceps, 2 deltoïde antérieur, 3 dentelé, 4 pectoraux, 5 triceps, 6 grand droit,
   7 gastrocnémien, 8 grand fessier, 9 trapèze, 10 quadriceps, 11 ischios, 12 grand dorsal,
   13 brachial, 14 obliques, 15 soléaire, 16 érecteurs du rachis (vue de dos) */
export const MUSCLES = {
  pectoralis_major:     { fr: "Grand pectoral", en: "Pectoralis major", wger: [4] },
  serratus_anterior:    { fr: "Dentelé antérieur", en: "Serratus anterior", wger: [3] },
  anterior_deltoid:     { fr: "Deltoïde antérieur", en: "Front delts", wger: [2] },
  lateral_deltoid:      { fr: "Deltoïde latéral", en: "Side delts", wger: [2] },
  posterior_deltoid:    { fr: "Deltoïde postérieur", en: "Rear delts", wger: [9] },
  supraspinatus:        { fr: "Sus-épineux", en: "Supraspinatus", wger: [9] },
  triceps_brachii:      { fr: "Triceps", en: "Triceps", wger: [5] },
  biceps_brachii:       { fr: "Biceps", en: "Biceps", wger: [1] },
  brachialis:           { fr: "Brachial", en: "Brachialis", wger: [13] },
  brachioradialis:      { fr: "Brachio-radial", en: "Brachioradialis", wger: [13] },
  forearm_flexors:      { fr: "Fléchisseurs de l'avant-bras", en: "Forearm flexors", wger: [13] },
  forearm_extensors:    { fr: "Extenseurs de l'avant-bras", en: "Forearm extensors", wger: [13] },
  forearms:             { fr: "Avant-bras", en: "Forearms", wger: [13] },
  rectus_abdominis:     { fr: "Grand droit (abdos)", en: "Rectus abdominis", wger: [6] },
  obliques:             { fr: "Obliques", en: "Obliques", wger: [14] },
  transverse_abdominis: { fr: "Transverse", en: "Transverse abdominis", wger: [6] },
  hip_flexors:          { fr: "Fléchisseurs de hanche", en: "Hip flexors", wger: [10] },
  quadriceps:           { fr: "Quadriceps", en: "Quadriceps", wger: [10] },
  hamstrings:           { fr: "Ischio-jambiers", en: "Hamstrings", wger: [11] },
  gluteus_maximus:      { fr: "Grand fessier", en: "Gluteus maximus", wger: [8] },
  gluteus_medius:       { fr: "Moyen fessier", en: "Gluteus medius", wger: [8] },
  gastrocnemius:        { fr: "Gastrocnémiens", en: "Gastrocnemius", wger: [7] },
  soleus:               { fr: "Soléaire", en: "Soleus", wger: [15] },
  tibialis_anterior:    { fr: "Tibial antérieur", en: "Tibialis anterior", wger: [] },
  latissimus_dorsi:     { fr: "Grand dorsal", en: "Lats", wger: [12] },
  rhomboids:            { fr: "Rhomboïdes", en: "Rhomboids", wger: [9] },
  trapezius:            { fr: "Trapèzes", en: "Traps", wger: [9] },
  erector_spinae:       { fr: "Érecteurs du rachis", en: "Erector spinae", wger: [16] },
  quadratus_lumborum:   { fr: "Carré des lombes", en: "Quadratus lumborum", wger: [16] },
  adductors:            { fr: "Adducteurs", en: "Adductors", wger: [] },
  abductors:            { fr: "Abducteurs", en: "Abductors", wger: [8] }
};

/* muscles qui ont une vignette RepDB (nom de fichier = clé avec des tirets) */
const NO_THUMB = new Set(["supraspinatus", "forearms", "quadratus_lumborum"]);

export function muscleName(key, lang = "fr") {
  const m = MUSCLES[key];
  return m ? m[lang] || m.fr : String(key || "").replace(/_/g, " ");
}

export function muscleThumb(key) {
  return MUSCLES[key] && !NO_THUMB.has(key) ? `./assets/muscles/repdb/${key.replace(/_/g, "-")}.webp` : null;
}

export function muscleWgerIds(keys) {
  const out = new Set();
  (keys || []).forEach(key => (MUSCLES[key]?.wger || []).forEach(id => out.add(id)));
  return out;
}

/* muscle anatomique → groupe utilisé par les filtres et l'appli (muscle_focus) */
export const MUSCLE_GROUP = {
  pectoralis_major: "pectoraux", serratus_anterior: "pectoraux",
  anterior_deltoid: "epaules", lateral_deltoid: "epaules", posterior_deltoid: "epaules", supraspinatus: "epaules",
  triceps_brachii: "triceps", biceps_brachii: "biceps", brachialis: "biceps",
  brachioradialis: "avant_bras", forearm_flexors: "avant_bras", forearm_extensors: "avant_bras", forearms: "avant_bras",
  rectus_abdominis: "abdominaux", obliques: "abdominaux", transverse_abdominis: "abdominaux",
  hip_flexors: "flechisseurs_hanche",
  quadriceps: "quadriceps", hamstrings: "ischio_jambiers",
  gluteus_maximus: "fessiers", gluteus_medius: "fessiers",
  gastrocnemius: "mollets", soleus: "mollets", tibialis_anterior: "mollets",
  latissimus_dorsi: "dos", rhomboids: "dos", trapezius: "trapeces",
  erector_spinae: "bas_dos", quadratus_lumborum: "bas_dos",
  adductors: "adducteurs", abductors: "abducteurs"
};

/* muscles proposés dans les formulaires, rangés par zone */
export const MUSCLE_REGIONS = [
  { fr: "Poussée", en: "Push", keys: ["pectoralis_major", "serratus_anterior", "anterior_deltoid", "lateral_deltoid", "posterior_deltoid", "triceps_brachii"] },
  { fr: "Dos et bras", en: "Back and arms", keys: ["latissimus_dorsi", "rhomboids", "trapezius", "erector_spinae", "biceps_brachii", "brachialis", "brachioradialis", "forearm_flexors", "forearm_extensors"] },
  { fr: "Tronc", en: "Core", keys: ["rectus_abdominis", "obliques", "transverse_abdominis", "hip_flexors", "quadratus_lumborum"] },
  { fr: "Jambes", en: "Legs", keys: ["quadriceps", "hamstrings", "gluteus_maximus", "gluteus_medius", "adductors", "abductors", "gastrocnemius", "soleus", "tibialis_anterior"] }
];
