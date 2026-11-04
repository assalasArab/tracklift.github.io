/* ═══════════════════════════════════════════════════════════
   Apparence du personnage (préprod) : ce qui se voit, sans bonus.
   - costume    : tenue entière, posée sur l'emplacement « Tenue »
   - weaponSkin : skin d'arme, posée sur l'emplacement « Arme »
   - companion  : compagnon à côté du personnage
   - bg         : fond derrière le personnage
   Une skin garde les bonus de l'équipement qu'elle recouvre.
   Dessins : pages « maj skin », découpées par _bench/avatar3-build.py
   (art.outfit / art.weapon = nom de la pièce dans js/avatar3-art.js).
   ═══════════════════════════════════════════════════════════ */

/** Emplacements d'apparence, et l'emplacement d'équipement que chacun recouvre */
export const LOOK_SLOTS = [
  { key: "costume", covers: "outfit" },
  { key: "weaponSkin", covers: "weapon" },
  { key: "companion", covers: null },
  { key: "bg", covers: null }
];

/** Fonds : couleurs unies (libres) et dégradés (à débloquer avec des points spé) */
export const COSMETIC_BACKGROUNDS = [
  { id: "menthe", color: "#bee7b8", price: 0, fr: "Menthe", en: "Mint" },
  { id: "sauge", color: "#d3dcbc", price: 0, fr: "Sauge", en: "Sage" },
  { id: "creme", color: "#fbf0dc", price: 0, fr: "Crème", en: "Cream" },
  { id: "peche", color: "#ffd5b0", price: 0, fr: "Pêche", en: "Peach" },
  { id: "ciel", color: "#cde4ee", price: 0, fr: "Ciel", en: "Sky" },
  { id: "aube", stops: ["#ffd5b0", "#f8d0d6", "#cde4ee"], color: "#f8d0d6", price: 120, fr: "Aube", en: "Dawn" },
  { id: "foret", stops: ["#d3dcbc", "#8fb38a", "#4e7a52"], color: "#8fb38a", price: 160, fr: "Forêt", en: "Forest" },
  { id: "crepuscule", stops: ["#2c3e66", "#7b5cd6", "#ff8a3d"], color: "#7b5cd6", price: 220, fr: "Crépuscule", en: "Dusk" },
  { id: "arene", stops: ["#fbe39a", "#ff8a3d", "#c43c1e"], color: "#ff8a3d", price: 260, fr: "Arène", en: "Arena" }
];

/** Skins dessinées (apparence seule).
    wheel : costume qu'on ne trouve qu'à la Roue des cadeaux (js/gift-wheel.js) ; rarity : sa rareté */
export const COSMETICS = [
  { id: "tenue-tracklift", slot: "costume", fr: "Tenue TrackLift", en: "TrackLift outfit", price: 0, art: { outfit: "casual" } },
  { id: "tenue-armure", slot: "costume", fr: "Armure", en: "Armour", price: 300, art: { outfit: "armor" } },
  { id: "tenue-robe", slot: "costume", fr: "Robe de mage", en: "Mage robe", price: 300, art: { outfit: "robe" } },
  { id: "skin-baton", slot: "weaponSkin", fr: "Bâton", en: "Staff", price: 150, art: { weapon: "staff" } },
  { id: "skin-epee", slot: "weaponSkin", fr: "Épée", en: "Sword", price: 200, art: { weapon: "sword" } },
  { id: "skin-grimoire", slot: "weaponSkin", fr: "Grimoire", en: "Spellbook", price: 200, art: { weapon: "grimoire" } },
  { id: "skin-sceptre", slot: "weaponSkin", fr: "Sceptre", en: "Sceptre", price: 200, art: { weapon: "scepter" } },
  { id: "skin-cle", slot: "weaponSkin", fr: "Clé à molette", en: "Wrench", price: 200, art: { weapon: "wrench" } },
  { id: "skin-dague", slot: "weaponSkin", fr: "Dague", en: "Dagger", price: 200, art: { weapon: "dagger" } },
  { id: "skin-bouclier", slot: "weaponSkin", fr: "Bouclier", en: "Shield", price: 250, art: { weapon: "shield" } },
  { id: "skin-faux", slot: "weaponSkin", fr: "Faux", en: "Scythe", price: 300, art: { weapon: "scythe" } },
  // costumes de la Roue des cadeaux (du moins rare au plus rare)
  { id: "costume-infini", slot: "costume", fr: "Tenue de l'Infini", en: "Infinity outfit", price: 0, wheel: true, rarity: "epic", art: { outfit: "gojo" } },
  { id: "costume-nuages", slot: "costume", fr: "Manteau des Nuages rouges", en: "Red Cloud cloak", price: 0, wheel: true, rarity: "legendary", art: { outfit: "akatsuki" } },
  { id: "costume-aura", slot: "costume", fr: "Kimono de l'Aura dorée", en: "Golden Aura gi", price: 0, wheel: true, rarity: "mythic", art: { outfit: "dbz" } }
];

/** Dessin de chaque équipement (en attendant un dessin par objet, plusieurs partagent le même) */
export const GEAR_ART = {
  survet: { outfit: "casual" },
  cuir: { outfit: "armor" }, mailles: { outfit: "mail" }, cape: { outfit: "ornate" }, armureCeleste: { outfit: "seraph" },
  robe: { outfit: "robe" }, habit: { outfit: "robe" }, tenueArchimage: { outfit: "robe" },
  baton: { weapon: "staff" }, batonAstral: { weapon: "staff" }, batonSauvage: { weapon: "staff" }, batonComete: { weapon: "staff" }, batonChene: { weapon: "staff" },
  epee: { weapon: "sword" },
  dague: { weapon: "dagger" }, lames: { weapon: "dagger" }, lameOmbre: { weapon: "dagger" },
  bouclier: { weapon: "shield" }, egide: { weapon: "shield" },
  faux: { weapon: "scythe" }, fauxAmes: { weapon: "scythe" },
  grimoire: { weapon: "grimoire" },
  sceptre: { weapon: "scepter" }, masse: { weapon: "scepter" }, relique: { weapon: "scepter" },
  cle: { weapon: "wrench" }, tourelle: { weapon: "wrench" }, canon: { weapon: "wrench" }
};

/** Quand rien d'autre n'est mis : un slip (le personnage n'est jamais tout nu) */
export const DEFAULT_OUTFIT = "underwear";

export const cosmeticById = id => (id ? COSMETICS.find(item => item.id === id) || null : null);
export const cosmeticsFor = slot => COSMETICS.filter(item => item.slot === slot);
export const lookTag = id => `look:${id}`;
