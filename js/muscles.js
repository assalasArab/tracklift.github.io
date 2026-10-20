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
