/* ═══════════════════════════════════════════════════════════
   Avatar « corps entier » (préprod).
   Un seul corps, une seule forme de tête ; on choisit les yeux, la bouche,
   la coupe, et les couleurs de peau, de cheveux et d'yeux.
   Pièces : assets/avatar3/ (pages « maj skin », _bench/avatar3-build.py).
   Cheveux et sourcils : une image par couleur (teinte, saturation et
   luminosité changées), reflets à part en blanc neutre.

   Ordre de dessin : fond → arme portée dans le dos → corps → tenue (un slip si rien) →
   arme portée devant (grimoire à la ceinture) → bouche → yeux → cheveux.
   Une « skin » se pose sur l'emplacement de son équipement : elle remplace
   le dessin, les bonus restent ceux de l'équipement.
   ═══════════════════════════════════════════════════════════ */
import { ART3 } from "./avatar3-art.js?v=20261104d";
import { SKINS, HAIR_COLORS, EYE_COLORS } from "./avatar-parts.js?v=20261104d";
import { COSMETIC_BACKGROUNDS, cosmeticById, GEAR_ART, DEFAULT_OUTFIT } from "./cosmetics.js?v=20261104d";

const VERSION = "4";
const a3 = file => `./assets/avatar3/${file}.png?a=${VERSION}`;
const pick = (list, id, fallback) => (list.find(item => item.id === id) || list.find(item => item.id === fallback) || list[0]);
let serial = 0;

export const FACE_OPTIONS = {
  eyes: Object.keys(ART3.eyes || {}),
  mouth: Object.keys(ART3.mouth || {}),
  hair: Object.keys(ART3.hair || {})
};

/** Par défaut : les yeux, la bouche et la coupe du premier dessin */
export const DEFAULT_LOOK = { skin: "s2", hairColor: "roux", eyeColor: "bleu", bg: "menthe", eyes: "e4", mouth: "m5", hair: "h5" };

export function normalizeLook(look) {
  const l = { ...DEFAULT_LOOK, ...(look || {}) };
  const option = key => (FACE_OPTIONS[key].includes(l[key]) ? l[key] : FACE_OPTIONS[key].includes(DEFAULT_LOOK[key]) ? DEFAULT_LOOK[key] : FACE_OPTIONS[key][0]);
  return {
    skin: pick(SKINS, l.skin, DEFAULT_LOOK.skin).id,
    hairColor: pick(HAIR_COLORS, l.hairColor, DEFAULT_LOOK.hairColor).id,
    eyeColor: pick(EYE_COLORS, l.eyeColor, DEFAULT_LOOK.eyeColor).id,
    bg: pick(COSMETIC_BACKGROUNDS, l.bg, DEFAULT_LOOK.bg).id,
    eyes: option("eyes"), mouth: option("mouth"), hair: option("hair"),
    costume: l.costume || null,
    weaponSkin: l.weaponSkin || null,
    companion: l.companion || null,
    // tenue visible publiée dans le profil (avatar vu par les potes)
    outfitArt: ART3.outfit?.[l.outfitArt || l.outfit] ? (l.outfitArt || l.outfit) : null
  };
}

const center = box => [box[0] + box[2] / 2, box[1] + box[3] / 2];
const at = ([x, y, w, h]) => `x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"`;
const img = (file, box) => `<image href="${a3(file)}" ${at(box)}/>`;

/** Couleur à plat dans un masque (peau, iris) */
function tinted(id, file, box, color) {
  return {
    defs: `<mask id="${id}" maskUnits="userSpaceOnUse" x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}">${img(file, box)}</mask>`,
    body: `<rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" fill="${color}" mask="url(#${id})"/>`
  };
}

/** Dessin de la tenue et de l'arme : la skin d'abord, puis l'équipement porté, puis la tenue de base */
function wornPieces(l, gear = {}) {
  const outfit = cosmeticById(l.costume)?.art?.outfit || GEAR_ART[gear.outfit]?.outfit || l.outfitArt || DEFAULT_OUTFIT;
  const weapon = cosmeticById(l.weaponSkin)?.art?.weapon || GEAR_ART[gear.weapon]?.weapon || null;
  return { outfit, weapon };
}

/** Adresse du dessin d'une pièce */
export const pieceUrl = (cat, name) => (ART3[cat]?.[name] ? a3(`${cat}-${name}`) : null);
/** Miniature d'une pièce pour les icônes : une arme portée dans le dos a ses deux morceaux rapprochés */
export const thumbUrl = (cat, name) => (cat === "weapon" && ART3.weapon?.[name] && !ART3.weapon[name].front ? a3(`thumb-weapon-${name}`) : pieceUrl(cat, name));

/** Nom du dessin de tenue visible (pour le profil public) */
export const visibleOutfit = (look, gear) => wornPieces(normalizeLook(look), gear).outfit;

function characterSvg(l, colors, id, gear) {
  let defs = "";
  let body = "";
  const add = part => { defs += part.defs || ""; body += part.body || ""; };
  const worn = wornPieces(l, gear);
  const W = worn.weapon && ART3.weapon?.[worn.weapon];
  const weapon = W ? img(`weapon-${worn.weapon}`, W.box) : "";
  // les armes se portent dans le dos (dessinées avant le corps), sauf celles portées devant
  if (!W?.front) body += weapon;
  const B = ART3.body;
  if (B) {
    add(tinted(`${id}-skin`, "body-skin", B.box, colors.skin));
    body += img("body-shade", B.box) + img("body-blush", B.box) + img("body-base", B.box);
  }
  const O = ART3.outfit?.[worn.outfit];
  if (O) body += img(`outfit-${worn.outfit}`, O.box);
  if (W?.front) body += weapon;
  const M = ART3.mouth?.[l.mouth];
  if (M) body += img(`mouth-${l.mouth}`, M.box);
  const E = ART3.eyes?.[l.eyes];
  if (E) {
    add(tinted(`${id}-iris`, `eyes-${l.eyes}-iris`, E.box, colors.iris));
    body += img(`eyes-${l.eyes}-shade`, E.box) + img(`eyes-${l.eyes}-base`, E.box);
    if (E.brow) body += img(`eyes-${l.eyes}-brow-${l.hairColor}`, E.brow) + img(`eyes-${l.eyes}-brow-shine`, E.brow);
  }
  const Hh = ART3.hair?.[l.hair];
  if (Hh) body += img(`hair-${l.hair}-${l.hairColor}`, Hh.box) + img(`hair-${l.hair}-shine`, Hh.box) + img(`hair-${l.hair}-base`, Hh.box);
  return { defs, body };
}

function backgroundSvg(bg, [x, y, w, h], round, id) {
  const item = COSMETIC_BACKGROUNDS.find(b => b.id === bg) || COSMETIC_BACKGROUNDS[0];
  const shape = round ? `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2}"` : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.06}"`;
  if (!item.stops) return `${shape} fill="${item.color}"/>`;
  const grad = `<linearGradient id="${id}-bg" x1="0" y1="0" x2="0" y2="1">${item.stops.map((c, i) => `<stop offset="${i / (item.stops.length - 1)}" stop-color="${c}"/>`).join("")}</linearGradient>`;
  return `<defs>${grad}</defs>${shape} fill="url(#${id}-bg)"/>`;
}

/** Cadrages : corps entier, tête (du haut des cheveux au menton) ou visage (vignettes) */
function viewBox(view, l) {
  const B = ART3.body;
  if (!B) return [0, 0, 1024, 1024];
  const hairTop = Math.min(...Object.values(ART3.hair || {}).map(h => h.box[1]), B.head.top);
  const eyesBox = ART3.eyes?.[l.eyes]?.box || ART3.eyes?.e4?.box || [400, 240, 220, 130];
  if (view === "face") {
    const mouth = ART3.mouth?.[l.mouth]?.box || [460, 400, 60, 40];
    const y0 = Math.min(eyesBox[1], mouth[1]) - 14, y1 = Math.max(mouth[1] + mouth[3], eyesBox[1] + eyesBox[3]) + 18;
    const size = Math.max(eyesBox[2] + 40, y1 - y0);
    const cx = center(eyesBox)[0];
    return [Math.round(cx - size / 2), Math.round((y0 + y1) / 2 - size / 2), Math.round(size), Math.round(size)];
  }
  if (view === "head") {
    const top = Math.min(ART3.hair?.[l.hair]?.box[1] ?? B.head.top, B.head.top);
    const size = Math.round(B.head.chin - top + 70);
    const cx = center(eyesBox)[0];
    return [Math.round(cx - size / 2), Math.round(top - 12), size, size];
  }
  const bottom = B.box[1] + B.box[3];
  const h = bottom - hairTop;
  const w = Math.round(h * 0.62);
  const cx = B.box[0] + B.box[2] / 2;
  return [Math.round(cx - w / 2), Math.round(hairTop - h * 0.03), w, Math.round(h * 1.06)];
}

/**
 * Le personnage en SVG.
 * view : "full" (corps entier), "head" (gros plan sur la tête) ou "face" (vignettes du visage)
 * gear : équipement porté { outfit, weapon } (identifiants de js/rpg.js), pour dessiner la tenue et l'arme
 */
export function figureSvg(look, { view = "full", size = 120, label = "", frame = true, className = "", gear = {} } = {}) {
  const l = normalizeLook(look);
  const id = `av3-${++serial}`;
  const colors = { skin: pick(SKINS, l.skin).color, hair: pick(HAIR_COLORS, l.hairColor).color, iris: pick(EYE_COLORS, l.eyeColor).color };
  const box = viewBox(view, l);
  const { defs, body } = characterSvg(l, colors, id, gear);
  const height = view === "full" ? Math.round(size * box[3] / box[2]) : size;
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, "&quot;")}"` : `aria-hidden="true"`;
  const clip = view === "head" ? `<clipPath id="${id}-clip"><circle cx="${box[0] + box[2] / 2}" cy="${box[1] + box[3] / 2}" r="${box[2] / 2}"/></clipPath>` : "";
  const back = !frame ? "" : view === "face"
    ? `<rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" fill="${colors.skin}"/>`
    : backgroundSvg(l.bg, box, view === "head", id);
  return `<svg class="av3 av3-${view}${className ? ` ${className}` : ""}" viewBox="${box.join(" ")}" width="${size}" height="${height}" ${a11y} focusable="false">
    <defs>${defs}${clip}</defs>
    ${back}
    <g${view === "head" ? ` clip-path="url(#${id}-clip)"` : ""}>${body}</g>
  </svg>`;
}
