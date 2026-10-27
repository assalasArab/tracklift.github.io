/* ═══════════════════════════════════════════════════════════
   Avatar : registre des pièces.
   Dessin sur un carré de 100 × 100, dans le style de la mascotte :
   trait brun épais et arrondi, aplats, ombre franche sur le côté droit.

   Chaque pièce d'une catégorie « forme » a un identifiant et une ou
   plusieurs couches (back, body, face, top…), chacune étant une fonction
   qui reçoit un « pinceau » (voir avatar.js) et rend du SVG.

   Remplacer une pièce par un dessin PNG : ajouter `png: { <couche>: "chemin.png" }`
   à la pièce (même carré de 100 × 100, fond transparent). Le PNG est alors
   posé à la place du SVG pour cette couche. Les couleurs ne s'appliquent
   pas aux PNG.

   Les noms affichés sont dans js/i18n.js (clé avatarParts).
   ═══════════════════════════════════════════════════════════ */

export const INK = "#2b2620";

/* ─── Couleurs ─────────────────────────────────────────── */
export const SKINS = [
  { id: "s1", color: "#fde3cf" },
  { id: "s2", color: "#f6cba8" },
  { id: "s3", color: "#e6ad80" },
  { id: "s4", color: "#c98b5e" },
  { id: "s5", color: "#9a6342" },
  { id: "s6", color: "#6e4430" }
];

export const HAIR_COLORS = [
  { id: "noir", color: "#3a322d" },
  { id: "brun", color: "#6a4128" },
  { id: "chatain", color: "#9b6a3c" },
  { id: "roux", color: "#e8823a" },
  { id: "blond", color: "#ecc56c" },
  { id: "blanc", color: "#e6e1d8" },
  { id: "rose", color: "#f2a3b6" },
  { id: "bleu", color: "#7bb2d6" }
];

export const OUTFIT_COLORS = [
  { id: "olive", color: "#7a8450" },
  { id: "sauge", color: "#aebd93" },
  { id: "menthe", color: "#bee7b8" },
  { id: "orange", color: "#ff8a1f" },
  { id: "encre", color: "#3d3631" },
  { id: "creme", color: "#f6ecd9" },
  { id: "canard", color: "#3a8fa8" },
  { id: "brique", color: "#c4553f" }
];

export const BACKGROUNDS = [
  { id: "menthe", color: "#bee7b8" },
  { id: "sauge", color: "#d3dcbc" },
  { id: "creme", color: "#fbf0dc" },
  { id: "peche", color: "#ffd5b0" },
  { id: "ciel", color: "#cde4ee" },
  { id: "lilas", color: "#e2d5ee" },
  { id: "soleil", color: "#fbe39a" },
  { id: "rose", color: "#f8d0d6" }
];

const MOUTH_IN = "#8a3326";
const TONGUE = "#ef8a7e";
const IRIS = "#5b3c26";

/* ─── Outils de tracé ──────────────────────────────────── */
const r1 = n => Math.round(n * 10) / 10;

/** Bord festonné (boucles, afro) le long d'une ellipse, de t0 à t1 degrés.
    bulge > 0 : bosses vers l'extérieur ; < 0 : vers l'intérieur. */
function scallop(cx, cy, rx, ry, t0, t1, n, bulge) {
  const pt = (t, k = 1) => {
    const a = t * Math.PI / 180;
    return [r1(cx + rx * k * Math.cos(a)), r1(cy + ry * k * Math.sin(a))];
  };
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = t0 + (t1 - t0) * i / n;
    const b = t0 + (t1 - t0) * (i + 1) / n;
    const c1 = pt(a + (b - a) * 0.2, 1 + bulge);
    const c2 = pt(b - (b - a) * 0.2, 1 + bulge);
    const end = pt(b);
    d += ` C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${end[0]} ${end[1]}`;
  }
  return d;
}
function ellPoint(cx, cy, rx, ry, t) {
  const a = t * Math.PI / 180;
  return `${r1(cx + rx * Math.cos(a))} ${r1(cy + ry * Math.sin(a))}`;
}

/* Formes de base partagées */
export const FACE = "M50 27.5 C62 27.5 71.5 37.5 71.5 50 C71.5 63.5 62 73.5 50 73.5 C38 73.5 28.5 63.5 28.5 50 C28.5 37.5 38 27.5 50 27.5 Z";
const TORSO = "M8 104 C8 89 18 81 32 78.2 C37 77.2 41 76 44 74.5 Q50 79.5 56 74.5 C59 76 63 77.2 68 78.2 C82 81 92 89 92 104 Z";
const NECK = "M44 64 L44 76 Q50 80.5 56 76 L56 64 Z";

/* ─── Coiffures ────────────────────────────────────────── */
// casque lisse qui suit le crâne, ligne frontale à `brow`
const cap = (brow = 37, top = 25, side = 48) =>
  `M28.4 ${side} C27 ${top + 8} 37 ${top} 50 ${top} C63 ${top} 73 ${top + 8} 71.6 ${side} C70 ${brow + 6} 66 ${brow + 1.5} 60 ${brow} C56.5 ${brow - 0.8} 53 ${brow - 1} 50 ${brow - 1} C47 ${brow - 1} 43.5 ${brow - 0.8} 40 ${brow} C34 ${brow + 1.5} 30 ${brow + 6} 28.4 ${side} Z`;

const curlyFront = () =>
  `M${ellPoint(50, 41, 28, 21, 160)}${scallop(50, 41, 28, 21, 160, 380, 9, 0.17)}` +
  ` L70.6 47.5${scallop(50, 46.5, 20.5, 9.5, -12, -168, 6, -0.32)} L${ellPoint(50, 41, 28, 21, 160)} Z`;

const afroBack = () => `M${ellPoint(50, 41, 34, 30, 0)}${scallop(50, 41, 34, 30, 0, 360, 15, 0.1)} Z`;

export const HAIRS = [
  { id: "chauve", layers: {
    front: () => `<path d="M38.5 34.5 Q42.5 30.6 47.5 30" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity="0.55"/>`
  } },
  { id: "rase", layers: {
    front: p => p.shape("M28.6 47 C27.5 33 37.5 25.6 50 25.6 C62.5 25.6 72.5 33 71.4 47 C69 41.5 65.5 38.8 60.5 37.8 C57 37.1 53.5 36.9 50 36.9 C46.5 36.9 43 37.1 39.5 37.8 C34.5 38.8 31 41.5 28.6 47 Z", p.hair)
  } },
  { id: "court", layers: {
    front: p => p.shape("M27.8 49.5 C25.5 31.5 36.5 23 50 23 C63.5 23 74.5 31.5 72.2 49.5 C71 45 69.5 42 67 40.2 C64.5 42.4 60.5 42.8 57.5 41 C55 43.2 51 43.4 48 41.2 C45 43.2 41 43 38.5 40.6 C35.5 42.4 32.5 44 31 46.5 C30 47.8 28.8 48.8 27.8 49.5 Z", p.hair)
  } },
  { id: "boucles", layers: {
    front: p => p.shape(curlyFront(), p.hair)
  } },
  { id: "meche", layers: {
    front: p => p.shape("M28 50.5 C25 32 35.5 22 50.5 22 C65 22 75.5 31 72.4 50.5 C71.4 45.5 70.4 42.5 68.4 40.5 C59 41.5 47.5 39.5 40.5 33 C39.5 38.5 35 42.5 30.6 45 C29.6 46.8 28.8 48.6 28 50.5 Z", p.hair)
      + p.line("M44 30.5 C50 35 58 37 65.5 37")
  } },
  { id: "herisse", layers: {
    front: p => p.shape("M28.5 48 L26 37.5 L32.5 38.5 L30.5 28.5 L38 31.5 L39.5 21.5 L46 27.5 L51 18.5 L55 27 L62 21 L63 30 L70.5 27.5 L68.6 36.5 L74.5 37 L71.5 48 C69 42 64.5 39 57.5 38.4 C54 38.1 46 38.1 42.5 38.4 C35.5 39 31 42 28.5 48 Z", p.hair)
  } },
  { id: "afro", layers: {
    back: p => p.shape(afroBack(), p.hair),
    front: p => p.shape("M28.8 48.5 C29.5 36 38 30.5 50 30.5 C62 30.5 70.5 36 71.2 48.5 C67 42 59 39.2 50 39.2 C41 39.2 33 42 28.8 48.5 Z", p.hair)
  } },
  { id: "chignon", layers: {
    back: p => p.shape("M50 11.5 C55.5 11.5 59.5 15.5 59.5 20.5 C59.5 25.5 55.5 29 50 29 C44.5 29 40.5 25.5 40.5 20.5 C40.5 15.5 44.5 11.5 50 11.5 Z", p.hair),
    front: p => p.shape(cap(36.5, 24.5, 49), p.hair) + p.line("M43 27.5 C41 30 40 32.5 40 35 M57 27.5 C59 30 60 32.5 60 35")
  } },
  { id: "queue", layers: {
    back: p => p.shape("M63 30 C77 28 84 40 82 55 C80.5 66 76 74 70.5 80 C72 70 72.5 61 70.5 53 C69 46 66.5 38 63 30 Z", p.hair),
    front: p => p.shape(cap(36.5, 24.5, 49), p.hair) + p.line("M47 25 C45 29 44.5 33 45 36")
      + `<path d="M66.5 30.5 C69 29.5 71.5 30 73.5 32" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linecap="round"/>`
  } },
  { id: "long", layers: {
    back: p => p.shape("M27.5 52 C24 30 36 21 50 21 C64 21 76 30 72.5 52 C71.5 63 75 73 80 84 C71 88 63 85 59.5 78 L40.5 78 C37 85 29 88 20 84 C25 73 28.5 63 27.5 52 Z", p.hair),
    front: p => p.shape("M28.4 53 C27 33 37 24 50 24 C63 24 73 33 71.6 53 C70 44.5 66 37 58.5 33.8 C55.5 33.2 52.2 33.8 50 36.8 C47.8 33.8 44.5 33.2 41.5 33.8 C34 37 30 44.5 28.4 53 Z", p.hair)
  } },
  { id: "carre", layers: {
    back: p => p.shape("M26.5 55 C23 31.5 36 21.5 50 21.5 C64 21.5 77 31.5 73.5 55 C73 62.5 74 67.5 76 71 C69 73.5 64 71 62 66.5 L38 66.5 C36 71 31 73.5 24 71 C26 67.5 27 62.5 26.5 55 Z", p.hair),
    front: p => p.shape("M28.4 51 C27 33 37 24 50 24 C63 24 73 33 71.6 51 C70.8 47 70.2 44.4 69.6 42.4 C63 43.6 37 43.6 30.4 42.4 C29.8 44.4 29.2 47 28.4 51 Z", p.hair)
  } }
];

/* ─── Yeux ─────────────────────────────────────────────── */
const EYE_L = 41.5, EYE_R = 58.5, EYE_Y = 51.5;
const bigEye = (x, p) =>
  `<ellipse cx="${x}" cy="${EYE_Y}" rx="4.9" ry="5.9" fill="#fff" stroke="${INK}" stroke-width="2"/>` +
  `<circle cx="${x + (x < 50 ? 0.9 : -0.9)}" cy="${EYE_Y + 0.8}" r="3.2" fill="${IRIS}"/>` +
  `<circle cx="${x + (x < 50 ? 0.9 : -0.9)}" cy="${EYE_Y + 0.8}" r="1.6" fill="${INK}"/>` +
  `<circle cx="${x + (x < 50 ? 2 : 0.2)}" cy="${EYE_Y - 0.6}" r="1.05" fill="#fff"/>`;
const dotEye = x =>
  `<ellipse cx="${x}" cy="${EYE_Y}" rx="2.7" ry="3.4" fill="${INK}"/><circle cx="${x + 0.9}" cy="${EYE_Y - 1.1}" r="0.95" fill="#fff"/>`;
const happyEye = (x, p) => p.line(`M${x - 4} ${EYE_Y + 1.4} Q${x} ${EYE_Y - 3.6} ${x + 4} ${EYE_Y + 1.4}`, 2.6);

export const EYES = [
  { id: "grands", layers: { face: p => bigEye(EYE_L, p) + bigEye(EYE_R, p) } },
  { id: "points", layers: { face: () => dotEye(EYE_L) + dotEye(EYE_R) } },
  { id: "joyeux", layers: { face: p => happyEye(EYE_L, p) + happyEye(EYE_R, p) } },
  { id: "clin", layers: { face: p => dotEye(EYE_L) + happyEye(EYE_R, p) } },
  { id: "determine", layers: { face: p => dotEye(EYE_L) + dotEye(EYE_R)
    + p.line(`M${EYE_L - 5} ${EYE_Y - 6.8} L${EYE_L + 3.5} ${EYE_Y - 4.6}`, 2.8)
    + p.line(`M${EYE_R + 5} ${EYE_Y - 6.8} L${EYE_R - 3.5} ${EYE_Y - 4.6}`, 2.8) } },
  { id: "zen", layers: { face: p =>
    [EYE_L, EYE_R].map(x => `<path d="M${x - 3.8} ${EYE_Y - 0.4} Q${x} ${EYE_Y + 5} ${x + 3.8} ${EYE_Y - 0.4} Z" fill="${INK}"/>` + p.line(`M${x - 4.6} ${EYE_Y - 0.6} L${x + 4.6} ${EYE_Y - 0.6}`, 2.2)).join("") } }
];

/* ─── Bouches ──────────────────────────────────────────── */
export const MOUTHS = [
  { id: "sourire", layers: { mouth: p => p.line("M44.5 64 Q50 69 55.5 64", 2.5) } },
  { id: "rire", layers: { mouth: () =>
    `<path d="M43.5 63 Q50 64 56.5 63 Q55.6 71 50 71 Q44.4 71 43.5 63 Z" fill="${MOUTH_IN}"/>` +
    `<path d="M46.4 69.2 Q50 66.8 53.6 69.2 Q52.2 71 50 71 Q47.8 71 46.4 69.2 Z" fill="${TONGUE}"/>` +
    `<path d="M43.5 63 Q50 64 56.5 63 Q55.6 71 50 71 Q44.4 71 43.5 63 Z" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>` } },
  { id: "neutre", layers: { mouth: p => p.line("M46 65.5 L54 65.5", 2.5) } },
  { id: "langue", layers: { mouth: p =>
    `<path d="M48 65.6 Q47.8 70.4 50.8 70.2 Q53.8 70 53.2 65.4" fill="${TONGUE}" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/>` + p.line("M44.5 64 Q50 68 55.5 64", 2.5) } },
  { id: "effort", layers: { mouth: () =>
    `<rect x="42.5" y="62.6" width="15" height="5.6" rx="2.6" fill="#fff" stroke="${INK}" stroke-width="2"/>` +
    `<path d="M43 65.4 H57 M46.4 62.9 V67.9 M50 62.9 V67.9 M53.6 62.9 V67.9" stroke="${INK}" stroke-width="1.2"/>` } },
  { id: "souffle", layers: { mouth: () => `<ellipse cx="50" cy="66" rx="2.6" ry="3.1" fill="${MOUTH_IN}" stroke="${INK}" stroke-width="2"/>` } },
  { id: "malin", layers: { mouth: p => p.line("M45 65.5 Q51 67.4 56 62.6", 2.5) } }
];

/* ─── Barbe ────────────────────────────────────────────── */
const MOUSTACHE = "M43.4 63 C45.4 60.2 48.6 60.4 50 62 C51.4 60.4 54.6 60.2 56.6 63 C54.4 64.2 52 63.6 50 62.8 C48 63.6 45.6 64.2 43.4 63 Z";
export const BEARDS = [
  { id: "aucune", layers: {} },
  { id: "trois-jours", layers: { beard: p => `<path d="M29.6 54 C31 67 39 74.5 50 74.5 C61 74.5 69 67 70.4 54 C67 62.5 60 67 50 67.4 C40 67 33 62.5 29.6 54 Z" fill="${p.hair}" opacity="0.38"/>` } },
  { id: "barbe", layers: { beard: p => p.shape("M29.2 52 C29 67 38 78 50 78 C62 78 71 67 70.8 52 C68.5 59.5 63.5 62.6 58 61.8 C55.4 61.4 52.6 61 50 61 C47.4 61 44.6 61.4 42 61.8 C36.5 62.6 31.5 59.5 29.2 52 Z", p.hair) } },
  { id: "moustache", layers: { top: p => p.shape(MOUSTACHE, p.hair, 1.8) } },
  { id: "bouc", layers: {
    beard: p => p.shape("M45 69.6 Q50 68.2 55 69.6 Q54.6 76 50 76.4 Q45.4 76 45 69.6 Z", p.hair, 1.8),
    top: p => p.shape(MOUSTACHE, p.hair, 1.8)
  } }
];

/* ─── Tenues (le cou et les épaules sont dessinés avec) ─── */
const sleeves = p => p.line("M24.5 85 Q27.5 93 25.5 104", 1.6) + p.line("M75.5 85 Q72.5 93 74.5 104", 1.6);
export const OUTFITS = [
  { id: "tshirt", layers: { body: p => p.shape(TORSO, p.outfit) + p.line("M42.5 75.4 Q50 83 57.5 75.4", 2.2) + sleeves(p) } },
  { id: "debardeur", layers: { body: p => p.shape(TORSO, p.skin)
    + p.shape("M33 78.5 L41 75.6 C42.5 82 46 85.5 50 85.5 C54 85.5 57.5 82 59 75.6 L67 78.5 C66 84 69.5 89.5 73 93 L73 104 L27 104 L27 93 C30.5 89.5 34 84 33 78.5 Z", p.outfit) } },
  { id: "sweat", layers: { body: p => p.shape(TORSO, p.outfit) + sleeves(p)
    + p.shape("M32.5 79 C34.5 70.5 42 68 50 68 C58 68 65.5 70.5 67.5 79 C63 84 57 86.5 50 86.5 C43 86.5 37 84 32.5 79 Z M42 73 Q50 71 58 73 Q56 79.5 50 80.5 Q44 79.5 42 73 Z", p.outfit, 2.2, "evenodd")
    + p.line("M45.5 83.5 L44.6 93 M54.5 83.5 L55.4 93", 1.8)
    + `<circle cx="44.5" cy="94.2" r="1.3" fill="${INK}"/><circle cx="55.5" cy="94.2" r="1.3" fill="${INK}"/>` } },
  { id: "veste", layers: { body: p => p.shape(TORSO, p.outfit)
    + `<path d="M22 86 Q16 93 14.5 104 M78 86 Q84 93 85.5 104" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity="0.85"/>`
    + p.shape("M40.6 72.5 L40.8 79.4 Q50 84.6 59.2 79.4 L59.4 72.5 Q50 77.6 40.6 72.5 Z", p.outfit, 2)
    + p.line("M50 82.5 L50 104", 2) + `<rect x="48.4" y="85" width="3.2" height="5" rx="1" fill="#fff" stroke="${INK}" stroke-width="1.4"/>` } },
  { id: "raye", layers: { body: p => p.shape(TORSO, p.outfit)
    + `<path d="M11 92 C30 90 70 90 89 92 L90.5 97.5 C70 95.5 30 95.5 9.5 97.5 Z" fill="#fff" opacity="0.6"/>`
    + `<path d="M15.5 84.5 C32 82.5 68 82.5 84.5 84.5 L87 88.6 C68 87 32 87 13 88.6 Z" fill="#fff" opacity="0.6"/>`
    + p.line("M42.5 75.4 Q50 83 57.5 75.4", 2.2) + sleeves(p) } }
];

/* ─── Accessoires ──────────────────────────────────────── */
export const ACCESSORIES = [
  { id: "aucun", layers: {} },
  { id: "lunettes", layers: { top: () =>
    `<g fill="none" stroke="${INK}" stroke-width="2.1" stroke-linecap="round">` +
    `<circle cx="${EYE_L}" cy="${EYE_Y}" r="6.6" fill="rgba(255,255,255,0.18)"/><circle cx="${EYE_R}" cy="${EYE_Y}" r="6.6" fill="rgba(255,255,255,0.18)"/>` +
    `<path d="M47.9 50.6 Q50 49 52.1 50.6 M34.9 50 L29.4 48.6 M65.1 50 L70.6 48.6"/></g>` } },
  { id: "soleil", layers: { top: () =>
    `<path d="M33.6 47.2 H48 Q48.6 47.2 48.4 48 L47.4 53.4 Q46.6 57 43 57 H38.8 Q35 57 34.2 53.4 L33 48 Q32.9 47.2 33.6 47.2 Z M52 47.2 H66.4 Q67.1 47.2 67 48 L65.8 53.4 Q65 57 61.2 57 H57 Q53.4 57 52.6 53.4 L51.6 48 Q51.4 47.2 52 47.2 Z" fill="${INK}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M36.5 49.6 L39.4 49.6 M55 49.6 L57.9 49.6" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0.75"/>` +
    `<path d="M48 49 Q50 48 52 49 M33.2 48.4 L29.4 47.6 M66.8 48.4 L70.6 47.6" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>` } },
  { id: "casquette", layers: { top: p =>
    p.shape("M27.6 41 C27 26 37 18.5 50 18.5 C63 18.5 73 26 72.4 41 Z", p.outfit)
    + p.line("M50 18.6 L50 39", 1.5)
    + p.shape("M25.6 41.4 C34 36.8 66 36.8 74.4 41.4 C71 45.4 62 46.8 50 46.8 C38 46.8 29 45.4 25.6 41.4 Z", p.outfit)
    + `<circle cx="50" cy="18.6" r="1.8" fill="${p.outfit}" stroke="${INK}" stroke-width="1.6"/>` } },
  { id: "bandeau", layers: { top: p =>
    p.shape("M28.4 39.6 C38 35.2 62 35.2 71.6 39.6 L71.4 45.4 C62 41.4 38 41.4 28.6 45.4 Z", p.outfit, 2.2)
    + `<path d="M28.5 42.4 C38 38.4 62 38.4 71.5 42.4" fill="none" stroke="#fff" stroke-width="1.6" opacity="0.8"/>` } },
  { id: "bonnet", layers: { top: p =>
    p.shape("M27.4 42 C25.6 25 36 16.5 50 16.5 C64 16.5 74.4 25 72.6 42 Z", p.outfit)
    + p.shape("M26.2 38 C36 33.6 64 33.6 73.8 38 L73.6 45.4 C64 41.4 36 41.4 26.4 45.4 Z", p.outfit, 2.2)
    + p.line("M33 36 L33 43 M39.5 34.8 L39.5 41.8 M46 34.3 L46 41.3 M54 34.3 L54 41.3 M60.5 34.8 L60.5 41.8 M67 36 L67 43", 1.2)
    + p.shape("M50 9 C53.2 9 55.6 11.4 55.6 14.4 C55.6 17.4 53.2 19.8 50 19.8 C46.8 19.8 44.4 17.4 44.4 14.4 C44.4 11.4 46.8 9 50 9 Z", p.outfit, 2) } },
  { id: "casque", layers: { top: p =>
    `<path d="M25.4 52 C22.4 27 35.5 18.4 50 18.4 C64.5 18.4 77.6 27 74.6 52" fill="none" stroke="${INK}" stroke-width="6.2" stroke-linecap="round"/>` +
    `<path d="M25.4 52 C22.4 27 35.5 18.4 50 18.4 C64.5 18.4 77.6 27 74.6 52" fill="none" stroke="${p.outfit}" stroke-width="2.6" stroke-linecap="round"/>`
    + p.shape("M21.6 46 Q21.6 43.6 24 43.6 H28.6 Q31 43.6 31 46 V59 Q31 61.4 28.6 61.4 H24 Q21.6 61.4 21.6 59 Z", p.outfit, 2.2)
    + p.shape("M69 46 Q69 43.6 71.4 43.6 H76 Q78.4 43.6 78.4 46 V59 Q78.4 61.4 76 61.4 H71.4 Q69 61.4 69 59 Z", p.outfit, 2.2) } },
  { id: "boucle", layers: { face: () => `<circle cx="27.6" cy="60.4" r="2" fill="#f2c44d" stroke="${INK}" stroke-width="1.5"/>` } },
  { id: "rousseur", layers: { face: () =>
    [[35.2, 57.6], [37.8, 59.2], [34.6, 60.4], [64.8, 57.6], [62.2, 59.2], [65.4, 60.4]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.8" fill="#a8613a" opacity="0.65"/>`).join("") } }
];

/* ─── Catégories de l'éditeur, dans l'ordre affiché ────── */
// kind "color" : pastilles ; kind "shape" : vignettes. view : cadrage de la vignette.
export const AVATAR_CATEGORIES = [
  { key: "skin", kind: "color", items: SKINS },
  { key: "hair", kind: "shape", items: HAIRS, view: "12 6 76 76" },
  { key: "hairColor", kind: "color", items: HAIR_COLORS },
  { key: "eyes", kind: "shape", items: EYES, view: "28 38 44 28" },
  { key: "mouth", kind: "shape", items: MOUTHS, view: "34 52 32 22" },
  { key: "beard", kind: "shape", items: BEARDS, view: "22 42 56 42" },
  { key: "outfit", kind: "shape", items: OUTFITS, view: "4 56 92 48" },
  { key: "outfitColor", kind: "color", items: OUTFIT_COLORS },
  { key: "accessory", kind: "shape", items: ACCESSORIES, view: "14 6 72 72" },
  { key: "bg", kind: "color", items: BACKGROUNDS }
];

/* ordre de dessin, du fond vers l'avant */
export const LAYER_ORDER = [
  ["hair", "back"],
  ["outfit", "body"],
  ["accessory", "under"],
  ["@ears"],
  ["@face"],
  ["accessory", "face"],
  ["eyes", "face"],
  ["@nose"],
  ["beard", "beard"],
  ["mouth", "mouth"],
  ["beard", "top"],
  ["hair", "front"],
  ["accessory", "top"]
];

export { NECK, TORSO };
