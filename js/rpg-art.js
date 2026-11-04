/* ═══════════════════════════════════════════════════════════
   Dessins du personnage, en SVG :
   - l'emblème de chaque classe : le symbole change avec la voie et la
     spécialité, le cadre évolue avec le rang (rond, écu, lauriers,
     ailes, couronne dorée) ;
   - les icônes des caractéristiques et de l'équipement.
   ═══════════════════════════════════════════════════════════ */
import { CLASSES } from "./rpg.js?v=20261104c";
import { GEAR_ART } from "./cosmetics.js?v=20261104c";
import { pieceUrl } from "./avatar3.js?v=20261104c";

export const BRANCH_COLORS = {
  novice: "#8d8e95",
  guerrier: "#d4553f",
  chasseur: "#4f9a52",
  sorcier: "#8a5cd6",
  pretre: "#d29a1e",
  mecanicien: "#3f87c0"
};
const GOLD = "#e0a92e";
export const RARITY_COLORS = { 1: "#8a8f86", 2: "#3f87c0", 3: GOLD };

/* engrenage : roue + 8 dents */
function gear(cx, cy, r) {
  const teeth = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const p = n => (Math.round(n * 100) / 100);
    return `M${p(cx + r * Math.cos(a))} ${p(cy + r * Math.sin(a))}L${p(cx + (r + 2.6) * Math.cos(a))} ${p(cy + (r + 2.6) * Math.sin(a))}`;
  }).join("");
  return `<circle cx="${cx}" cy="${cy}" r="${r}"/><circle cx="${cx}" cy="${cy}" r="${(r * 0.38).toFixed(2)}"/><path d="${teeth}"/>`;
}

/* Symboles (dessinés sur 24 × 24, en traits) */
const GLYPHS = {
  novice: `<path d="M3.5 9v6M6.5 7.5v9M17.5 7.5v9M20.5 9v6M6.5 12h11"/>`,
  guerrier: `<path d="M5 5l10.5 10.5M19 5L8.5 15.5M13 17.5l4.5-4.5M6.5 13l4.5 4.5M16.2 16.2l3 3M7.8 16.2l-3 3"/>`,
  paladin: `<path d="M12 3l7 3v5c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10V6z"/><path d="M12 8v8M8.5 11.5h7"/>`,
  berserker: `<path d="M12 3v18M11 6C6 6 4 9 4 11s2 5 7 5M13 6c5 0 7 3 7 5s-2 5-7 5"/>`,
  chasseur: `<path d="M4 20L19 5M12.5 5H19v6.5M4 15.5V20h4.5"/>`,
  assassin: `<path d="M12 2.5l2.2 4V15H9.8V6.5z"/><path d="M7.5 15h9M12 15v4.5"/><circle cx="12" cy="21" r="1.2"/>`,
  ranger: `<path d="M7 3c6 3 6 15 0 18M7 3v18M4 12h14M15 9l3 3-3 3"/>`,
  sorcier: `<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4l-5.3 3 1.2-6-4.5-4.1 6-.7z"/>`,
  mage: `<path d="M7.5 21l7.2-11"/><circle cx="16.5" cy="7.5" r="3.2"/><path d="M20.5 2.5v2.4M19.3 3.7h2.4"/>`,
  necromancien: `<path d="M12 3c-4.4 0-7.5 3-7.5 7 0 2.5 1.2 4.2 3 5.2V19h9v-3.8c1.8-1 3-2.7 3-5.2 0-4-3.1-7-7.5-7z"/><circle cx="9.3" cy="10.5" r="1.5"/><circle cx="14.7" cy="10.5" r="1.5"/><path d="M10.5 19v-2.2M13.5 19v-2.2"/>`,
  pretre: `<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>`,
  clerc: `<ellipse cx="12" cy="4.2" rx="4.2" ry="1.6"/><path d="M12 7.5v13.5M7.2 12h9.6"/>`,
  sage: `<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z"/><path d="M5 19l9.5-9.5"/>`,
  mecanicien: gear(12, 12, 6),
  ingenieur: `<path d="M14.6 3.6a4.4 4.4 0 0 0-5.3 5.6L3.8 14.7l2.6 2.6 5.5-5.5a4.4 4.4 0 0 0 5.6-5.3l-2.7 2.7-2.4-.4-.4-2.4z"/><path d="M15.5 15.5l4 4"/>`,
  mecha: `<rect x="5.5" y="7" width="13" height="10.5" rx="2.5"/><path d="M9 11.2h1.6M13.4 11.2H15M9.5 14.5h5M12 7V4M3.5 10.5v3.5M20.5 10.5v3.5"/><circle cx="12" cy="3.4" r=".9"/>`,
  erudit: `<path d="M12 6.5c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13"/>`
};

/* Cadres (dessinés sur 64 × 64) */
const SHIELD = "M32 6L53 13v16c0 14-9.5 24.5-21 29.5C20.5 53.5 11 43 11 29V13z";
// lauriers : autour du bas de l'écu ; ailes : sur le haut
const LAURELS = `<path d="M29 61.5C17 59.5 8 50.5 6.5 37M35 61.5c12-2 21-11 22.5-24.5"/><path d="M13 54l-5 1.2M9 47.5l-5-.2M7 41l-4.5-1.8M51 54l5 1.2M55 47.5l5-.2M57 41l4.5-1.8"/>`;
const WINGS = `<path d="M11.5 14C6 9.5 1.5 11 1 17c3-1.8 6.5-2 10.2-.9M11 20.5C5.5 17.5 1 19.5 1 25c3-1.5 6.4-1.6 10-.4M52.5 14C58 9.5 62.5 11 63 17c-3-1.8-6.5-2-10.2-.9M53 20.5c5.5-3 10-1 10 4.5-3-1.5-6.4-1.6-10-.4"/>`;
const CROWN = `<path d="M22 9.5l3.2-5.2 3.4 3.6L32 2.8l3.4 5.1 3.4-3.6 3.2 5.2v3H22z"/>`;

/**
 * Emblème d'une classe. size en px ; title : texte lu par les lecteurs d'écran (sinon décoratif).
 */
export function emblemSvg(classId, { size = 64, title = "" } = {}) {
  const cls = CLASSES[classId] || CLASSES.novice;
  const tier = cls.tier;
  const color = BRANCH_COLORS[cls.branch || "novice"];
  const edge = tier >= 5 ? GOLD : color;
  const glyph = GLYPHS[cls.art] || GLYPHS.novice;
  const frame = tier === 0
    ? `<circle cx="32" cy="32" r="25" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="5 4"/>`
    : tier === 1
      ? `<circle cx="32" cy="32" r="25" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="3"/>`
      : `<path d="${SHIELD}" fill="${color}" fill-opacity="${tier >= 4 ? 0.26 : 0.18}" stroke="${edge}" stroke-width="3" stroke-linejoin="round"/>`;
  const extras = [
    tier >= 3 ? `<g fill="none" stroke="${tier >= 5 ? GOLD : color}" stroke-width="2.2" stroke-linecap="round">${LAURELS}</g>` : "",
    tier >= 4 ? `<g fill="none" stroke="${tier >= 5 ? GOLD : color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${WINGS}</g>` : "",
    tier >= 5 ? `<g fill="${GOLD}" stroke="${GOLD}" stroke-width="1.5" stroke-linejoin="round">${CROWN}</g>` : ""
  ].join("");
  const label = title ? `role="img" aria-label="${title.replace(/"/g, "&quot;")}"` : `aria-hidden="true"`;
  // le symbole occupe le centre du cadre (un peu plus haut dans l'écu)
  const y = tier >= 2 ? 12.8 : 14.8;
  return `<svg class="rpg-emblem rpg-tier-${tier}" viewBox="0 0 64 64" width="${size}" height="${size}" ${label} focusable="false">
    ${extras}${frame}
    <g transform="translate(14.8 ${y}) scale(1.43)" fill="none" stroke="${tier >= 5 ? GOLD : color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
  </svg>`;
}

/* ─── Icônes des caractéristiques (24 × 24, couleur du texte) ─── */
const STAT_ICONS = {
  fce: GLYPHS.novice,
  agi: `<path d="M3 8h10.5a3 3 0 1 0-3-3M3 12.5h14.5a3 3 0 1 1-3 3M3 17h7"/>`,
  int: `<path d="M12 2.5c.8 5 4.5 8.7 9.5 9.5-5 .8-8.7 4.5-9.5 9.5-.8-5-4.5-8.7-9.5-9.5 5-.8 8.7-4.5 9.5-9.5z"/>`,
  vol: `<path d="M12 3c3 4.5 6 7.7 6 11a6 6 0 0 1-12 0c0-3.3 3-6.5 6-11z"/>`,
  vit: `<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>`
};
export function statIcon(stat, size = 20) {
  return `<svg class="rpg-stat-icon" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${STAT_ICONS[stat] || ""}</svg>`;
}

/* ─── Icônes de l'équipement (24 × 24) ─── */
const GEAR_ICONS = {
  staff: `<path d="M7 21L16.5 6.5"/><circle cx="17.5" cy="5" r="2.4"/>`,
  sword: `<path d="M14.5 3.5H20.5v6L10 20l-6-6z"/><path d="M6.5 13.5l4 4M3.5 20.5l2.8-2.8"/>`,
  dagger: GLYPHS.assassin,
  book: GLYPHS.erudit,
  scepter: `<path d="M12 9v12"/><circle cx="12" cy="6" r="3"/><path d="M9 13.5h6"/>`,
  wrench: GLYPHS.ingenieur,
  shield: GLYPHS.paladin,
  axe: GLYPHS.berserker,
  bow: GLYPHS.ranger,
  scythe: `<path d="M8 21L15.5 3.5"/><path d="M15.5 3.5c-4.5-.5-9 1.5-11 5.5 3.5-1.5 7.5-1.8 10.2-.3"/>`,
  shirt: `<path d="M8 3.5L3.5 7l2.3 3.3L8 9v11.5h8V9l2.2 1.3L20.5 7 16 3.5c-.8 1.6-2.3 2.5-4 2.5S8.8 5.1 8 3.5z"/>`,
  armor: `<path d="M6 4h12l1.5 5-2.5 1.5V20H7V10.5L4.5 9z"/><path d="M12 4v16M7 12.5h10"/>`,
  robe: `<path d="M9 3.5h6l1.5 4L19 20.5H5L7.5 7.5z"/><path d="M12 3.5v17M9.5 11h5"/>`,
  cloak: `<path d="M12 3c-3 0-4.5 2-4.5 4.5L4 20.5h16L16.5 7.5C16.5 5 15 3 12 3z"/><path d="M9.5 9.5c1.5 1 3.5 1 5 0"/>`,
  bracelet: `<ellipse cx="12" cy="12" rx="8" ry="4.5"/><ellipse cx="12" cy="12" rx="5" ry="2.2"/>`,
  feather: `<path d="M19.5 4.5C12 4.5 6.5 10 6.5 17.5h0C14 17.5 19.5 12 19.5 4.5z"/><path d="M4 20l9.5-9.5"/>`,
  ring: `<circle cx="12" cy="14.5" r="6"/><path d="M9.5 6.5L12 3l2.5 3.5L12 8.5z"/>`,
  pendant: `<path d="M5 3.5c1.5 4 4 6.5 7 6.5s5.5-2.5 7-6.5"/><path d="M12 10l3 4.5-3 6-3-6z"/>`,
  talisman: `<circle cx="12" cy="12" r="8.5"/>${STAT_ICONS.vit.replace("<path", '<path transform="translate(4.8 4.6) scale(.6)"')}`,
  crown: `<path d="M3.5 18.5h17M4.5 16L3.5 7l5 4L12 4.5 15.5 11l5-4-1 9z"/>`
};
export function gearIcon(art, rarity = 1, size = 36) {
  const color = RARITY_COLORS[rarity] || RARITY_COLORS[1];
  return `<svg class="rpg-gear-icon" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${GEAR_ICONS[art] || ""}</svg>`;
}

/* ─── Icône d'un objet d'équipement : miniature de son dessin (s'il est dessiné), sinon le pictogramme,
   dans un cadre de la couleur du niveau requis : gris (avant 10), vert (10), bleu (30), or (65 et plus) ─── */
export const LEVEL_COLORS = [
  { from: 1, color: "#8a8f86" },
  { from: 10, color: "#4f9a52" },
  { from: 30, color: "#3f87c0" },
  { from: 50, color: "#e0a92e" }
];
export const levelColor = level => LEVEL_COLORS.filter(t => level >= t.from).pop().color;

export function gearVisual(id, item, size = 40) {
  const color = levelColor(item?.req?.level || 1);
  const art = GEAR_ART[id];
  const url = art ? pieceUrl(art.outfit ? "outfit" : "weapon", art.outfit || art.weapon) : null;
  const inner = url
    ? `<img class="gear-thumb" src="${url}" alt="" loading="lazy" decoding="async">`
    : gearIcon(item.art, 1, Math.round(size * 0.7)).replace(/stroke="#[0-9a-f]{6}"/, `stroke="${color}"`);
  return `<span class="gear-pic" style="--lv:${color};width:${size}px;height:${size}px">${inner}</span>`;
}
