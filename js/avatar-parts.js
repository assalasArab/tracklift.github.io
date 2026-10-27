/* ═══════════════════════════════════════════════════════════
   Avatar : registre des pièces.
   Les pièces sont des dessins faits main (PDF « personnalisation »),
   découpés par _bench/avatar-cut.py en calques PNG (assets/avatar/) :
   - base : le trait et les aplats qui ne changent pas (blanc des yeux, dents) ;
   - skin / hair / iris : les zones recoloriées avec la couleur choisie.
   Le registre des calques est dans js/avatar-art.js (généré).

   Ajouter un dessin : une page de plus dans le PDF, relancer le script,
   puis ajouter son nom dans js/i18n.js (clé avatarParts).
   ═══════════════════════════════════════════════════════════ */
import { ART } from "./avatar-art.js?v=20261027b";

/* ─── Couleurs ─────────────────────────────────────────── */
export const SKINS = [
  { id: "s1", color: "#fde3cf" },
  { id: "s2", color: "#f8d6a8" },
  { id: "s3", color: "#e8b878" },
  { id: "s4", color: "#c98b5e" },
  { id: "s5", color: "#9a6342" },
  { id: "s6", color: "#6e4430" }
];

export const HAIR_COLORS = [
  { id: "noir", color: "#2f2926" },
  { id: "brun", color: "#5e3a24" },
  { id: "chatain", color: "#946234" },
  { id: "roux", color: "#f26a10" },
  { id: "blond", color: "#ecc56c" },
  { id: "blanc", color: "#e9e4dc" },
  { id: "rose", color: "#f2a3b6" },
  { id: "bleu", color: "#6fa8d6" }
];

export const EYE_COLORS = [
  { id: "marron", color: "#6b4226" },
  { id: "noisette", color: "#a26b2c" },
  { id: "vert", color: "#4f8c4a" },
  { id: "bleu", color: "#2f7fe0" },
  { id: "gris", color: "#8394a3" },
  { id: "noir", color: "#2b2522" },
  { id: "ambre", color: "#d8901c" }
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

/* ─── Pièces dessinées ─────────────────────────────────── */
// before / after : choix sans dessin (« sans barbe », « sans cheveux »…)
const pieces = (cat, { before = [], after = [] } = {}) =>
  [...before.map(id => ({ id })), ...Object.entries(ART[cat]).map(([id, art]) => ({ id, art })), ...after.map(id => ({ id }))];

export const FACES = pieces("face");
export const BODIES = pieces("body");
export const HAIRS = pieces("hair", { after: ["chauve"] });
export const EYES = pieces("eyes");
export const NOSES = pieces("nose");
export const MOUTHS = pieces("mouth");
export const BEARDS = pieces("beard", { before: ["aucune"] });
export const ACCESSORIES = pieces("accessory", { before: ["aucun"] });

/** Cadrage carré (viewBox) qui englobe toutes les pièces d'une catégorie, pour les vignettes */
function viewOf(cat, pad = 4, min = 30) {
  const boxes = Object.values(ART[cat]).map(a => a.box);
  const x0 = Math.min(...boxes.map(b => b[0])), y0 = Math.min(...boxes.map(b => b[1]));
  const x1 = Math.max(...boxes.map(b => b[0] + b[2])), y1 = Math.max(...boxes.map(b => b[1] + b[3]));
  const size = Math.max(x1 - x0, y1 - y0, min) + pad * 2;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const r = n => Math.round(n * 10) / 10;
  return `${r(cx - size / 2)} ${r(cy - size / 2)} ${r(size)} ${r(size)}`;
}

/* ─── Catégories de l'éditeur ──────────────────────────── */
// kind "color" : pastilles ; kind "shape" : vignettes. view : cadrage de la vignette.
export const AVATAR_CATEGORIES = [
  { key: "skin", kind: "color", items: SKINS },
  { key: "face", kind: "shape", items: FACES, view: viewOf("face") },
  { key: "hair", kind: "shape", items: HAIRS, view: viewOf("hair") },
  { key: "hairColor", kind: "color", items: HAIR_COLORS },
  { key: "eyes", kind: "shape", items: EYES, view: viewOf("eyes", 3) },
  { key: "eyeColor", kind: "color", items: EYE_COLORS },
  { key: "nose", kind: "shape", items: NOSES, view: viewOf("nose", 3, 24) },
  { key: "mouth", kind: "shape", items: MOUTHS, view: viewOf("mouth", 3, 26) },
  { key: "beard", kind: "shape", items: BEARDS, view: viewOf("beard") },
  { key: "body", kind: "shape", items: BODIES, view: viewOf("body", 2) },
  { key: "accessory", kind: "shape", items: ACCESSORIES, view: viewOf("accessory", 3) },
  { key: "bg", kind: "color", items: BACKGROUNDS }
];

/* ordre de dessin, du fond vers l'avant */
export const LAYER_ORDER = ["body", "face", "nose", "mouth", "beard", "eyes", "hair", "accessory"];

/* calque coloré → couleur de la config qui le remplit */
export const TINTS = { skin: "skin", hair: "hairColor", iris: "eyeColor" };
