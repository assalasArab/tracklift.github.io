/* ═══════════════════════════════════════════════════════════
   Apparence du personnage : enregistrée avec le personnage
   (users/<uid> → rpg.look), publiée dans le profil des Potes.
   La fenêtre (équipement, apparence, boutique) est dans js/hero.js.
   ═══════════════════════════════════════════════════════════ */
import { figureSvg, normalizeLook, visibleOutfit } from "./avatar3.js?v=20261104f";
import { Social } from "./social.js?v=20261104f";
import { normalizeAvatar } from "./avatar.js?v=20261104f";
import { COSMETIC_BACKGROUNDS, lookTag, cosmeticById } from "./cosmetics.js?v=20261104f";
import { rpgState } from "./rpg-ui.js?v=20261104f";
import { DB } from "./db.js?v=20261104f";
import { openHero } from "./hero.js?v=20261104f";

/* ─── Données : apparence enregistrée avec le personnage (users/<uid> → rpg.look) ─── */
export function currentLook() { return normalizeLook((DB.getRpg() || {}).look); }
export function saveLook(patch) {
  const rpg = DB.getRpg() || {};
  DB.saveRpg({ ...rpg, look: { ...normalizeLook(rpg.look), ...patch } });
}
/** Apparence à toi : gratuite, ou débloquée (un costume de la Roue des cadeaux se gagne toujours) */
export const ownsLook = (id, price) => (!price && !cosmeticById(id)?.wheel) || DB.getPurchases().some(p => p.id === lookTag(id));

/** L'avatar publié dans le profil (vu par les potes) : visage, couleurs, fond et tenue visible */
export function profileAvatar() {
  const look = currentLook();
  return normalizeAvatar({ v: 3, ...look, outfit: visibleOutfit(look, wornGear()) });
}

/** Met à jour le profil public si le personnage a changé (seulement dans la partie Potes) */
export async function syncProfileAvatar() {
  if (!Social.joined) return;
  const next = profileAvatar();
  if (JSON.stringify(next) === JSON.stringify(normalizeAvatar(Social.avatar))) return;
  try { await Social.saveAvatar(next); } catch (err) { console.warn("[TrackLift] personnage :", err?.code || err); }
}

/** Première fois : le nouveau personnage reprend les couleurs de l'ancien avatar */
const OLD_BG = new Set(COSMETIC_BACKGROUNDS.filter(b => !b.price).map(b => b.id));
export function migrateLook(oldAvatar) {
  const rpg = DB.getRpg() || {};
  if (rpg.look || !oldAvatar || oldAvatar.v === 3 || DB.loadFailed) return false;
  const look = normalizeLook({
    skin: oldAvatar.skin, hairColor: oldAvatar.hairColor, eyeColor: oldAvatar.eyeColor,
    bg: OLD_BG.has(oldAvatar.bg) ? oldAvatar.bg : undefined
  });
  DB.saveRpg({ ...rpg, look });
  return true;
}

/** Vignette de la tête (profil) ; size en px */
export function headHtml(size = 76, label = "") { return figureSvg(currentLook(), { view: "head", size, label }); }

/** Équipement porté (acheté), pour dessiner la tenue et l'arme sur le personnage */
export function wornGear() {
  const { ch } = rpgState();
  return { outfit: ch.gear.outfit?.id || null, weapon: ch.gear.weapon?.id || null };
}

/* ─── La fenêtre du personnage : maintenant la fenêtre du héros (js/hero.js) ─── */
/** tab : "gear" (équipement) ou "look" (apparence) ; les autres onglets de la fenêtre du héros marchent aussi */
export function openCharacterWindow({ onChange, tab = "gear" } = {}) {
  openHero({ tab: tab === "gear" ? "hero" : tab, onChange });
}
