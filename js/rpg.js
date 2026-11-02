/* ═══════════════════════════════════════════════════════════
   Personnage (« build ton perso grâce à la salle »).
   Calculs purs, aucun accès à l'écran ni à la base.

   - Les points spé se gagnent avec les pesées et les séances (js/flames.js).
   - Le total gagné depuis le début donne le niveau (il ne baisse jamais
     quand on dépense) : niveau N à partir de 5 × (N − 1)² points spé.
   - Chaque niveau donne 5 points à répartir dans les 5 caractéristiques.
   - Classes : Novice, puis un choix obligatoire au niveau 10 (la voie)
     et au niveau 30 (la spécialité) ; aux niveaux 65, 85 et 90 la classe
     évolue toute seule (sauf l'Ingénieur, qui choisit au niveau 65).
   - Équipement (arme, tenue, accessoire) acheté avec les points spé :
     il ajoute des caractéristiques tant qu'il est porté.
   ═══════════════════════════════════════════════════════════ */

export const STATS = ["fce", "agi", "int", "vol", "vit"];
export const BASE_STAT = 5;
export const POINTS_PER_LEVEL = 5;
export const MAX_LEVEL = 99;
export const GATES = [10, 30, 65, 85, 90]; // niveau requis pour chaque rang de classe (1 à 5)
export const CLASS_CHANGE_PRICE = 300;   // changer de voie coûte des points spé

export const xpForLevel = level => 5 * (Math.min(MAX_LEVEL, Math.max(1, Math.floor(level))) - 1) ** 2;
export function levelOf(xp) {
  let level = Math.floor(1 + Math.sqrt(Math.max(0, Number(xp) || 0) / 5));
  while (level > 1 && xpForLevel(level) > xp) level--; // arrondis
  return Math.min(MAX_LEVEL, Math.max(1, level));
}

/* ─── Classes ──────────────────────────────────────────── */
// main : caractéristiques renforcées par la classe (la 1re reçoit le plus)
// art : dessin de l'emblème ; ref : inspirations
export const CLASSES = {
  novice: { tier: 0, branch: null, main: [], next: ["guerrier", "chasseur", "sorcier", "pretre", "mecanicien"], art: "novice", fr: "Novice", en: "Novice" },

  guerrier: { tier: 1, branch: "guerrier", main: ["fce", "vit"], next: ["paladin", "berserker"], art: "guerrier", fr: "Guerrier", en: "Warrior",
    focus: { fr: "Force et résistance : il encaisse et frappe au corps à corps.", en: "Strength and toughness: takes hits and strikes up close." } },
  paladin: { tier: 2, branch: "guerrier", main: ["vit", "fce"], next: ["templier"], art: "paladin", fr: "Paladin", en: "Paladin",
    ref: "Alphonse Elric, Titan cuirassé",
    focus: { fr: "Tanking lourd, défense absolue, contrôle de menace et bouclier.", en: "Heavy tanking, absolute defence, threat control and shield." } },
  templier: { tier: 3, branch: "guerrier", main: ["vit", "fce"], next: ["celeste"], art: "paladin", fr: "Chevalier Templier", en: "Templar Knight" },
  celeste: { tier: 4, branch: "guerrier", main: ["vit", "fce"], next: ["paladinSupreme"], art: "paladin", fr: "Chevalier Céleste", en: "Celestial Knight" },
  paladinSupreme: { tier: 5, branch: "guerrier", main: ["vit", "fce"], next: [], art: "paladin", fr: "Paladin Suprême", en: "Supreme Paladin" },
  berserker: { tier: 2, branch: "guerrier", main: ["fce", "vit"], next: ["seigneurGuerre"], art: "berserker", fr: "Berserker", en: "Berserker",
    ref: "Guts, Kenpachi Zaraki",
    focus: { fr: "Dégâts physiques bruts, armes à deux mains, attaques de zone et bonus de rage.", en: "Raw physical damage, two-handed weapons, area attacks and rage bonus." } },
  seigneurGuerre: { tier: 3, branch: "guerrier", main: ["fce", "vit"], next: ["destructeur"], art: "berserker", fr: "Seigneur de Guerre", en: "Warlord" },
  destructeur: { tier: 4, branch: "guerrier", main: ["fce", "vit"], next: ["berserkerSupreme"], art: "berserker", fr: "Destructeur", en: "Destroyer" },
  berserkerSupreme: { tier: 5, branch: "guerrier", main: ["fce", "vit"], next: [], art: "berserker", fr: "Berserker Suprême", en: "Supreme Berserker" },

  chasseur: { tier: 1, branch: "chasseur", main: ["agi", "fce"], next: ["assassin", "ranger"], art: "chasseur", fr: "Chasseur", en: "Hunter",
    focus: { fr: "Vitesse et précision : il touche le premier et esquive.", en: "Speed and precision: strikes first and dodges." } },
  assassin: { tier: 2, branch: "chasseur", main: ["agi", "fce"], next: ["ninja"], art: "assassin", fr: "Assassin", en: "Assassin",
    ref: "Sung Jin-woo, Killua",
    focus: { fr: "Dagues, vitesse d'attaque, camouflage et taux de coup critique élevé.", en: "Daggers, attack speed, stealth and a high critical rate." } },
  ninja: { tier: 3, branch: "chasseur", main: ["agi", "fce"], next: ["ombre"], art: "assassin", fr: "Ninja", en: "Ninja" },
  ombre: { tier: 4, branch: "chasseur", main: ["agi", "fce"], next: ["assassinSupreme"], art: "assassin", fr: "Ombre", en: "Shadow" },
  assassinSupreme: { tier: 5, branch: "chasseur", main: ["agi", "fce"], next: [], art: "assassin", fr: "Assassin Suprême", en: "Supreme Assassin" },
  ranger: { tier: 2, branch: "chasseur", main: ["agi", "vit"], next: ["traqueur"], art: "ranger", fr: "Ranger", en: "Ranger",
    ref: "Uryū Ishida, Archer",
    focus: { fr: "Combat à distance (arc, arbalète), pièges de terrain et mobilité.", en: "Ranged combat (bow, crossbow), traps and mobility." } },
  traqueur: { tier: 3, branch: "chasseur", main: ["agi", "vit"], next: ["oeilFaucon"], art: "ranger", fr: "Traqueur", en: "Tracker" },
  oeilFaucon: { tier: 4, branch: "chasseur", main: ["agi", "vit"], next: ["rangerSupreme"], art: "ranger", fr: "Œil de Faucon", en: "Hawkeye" },
  rangerSupreme: { tier: 5, branch: "chasseur", main: ["agi", "vit"], next: [], art: "ranger", fr: "Ranger Suprême", en: "Supreme Ranger" },

  sorcier: { tier: 1, branch: "sorcier", main: ["int", "vol"], next: ["mage", "necromancien"], art: "sorcier", fr: "Sorcier", en: "Sorcerer",
    focus: { fr: "Dégâts des éléments et contrôle : la magie avant tout.", en: "Elemental damage and control: magic above all." } },
  mage: { tier: 2, branch: "sorcier", main: ["int", "vol"], next: ["sorcierSupreme"], art: "mage", fr: "Mage", en: "Mage",
    ref: "Roy Mustang, Megumin",
    focus: { fr: "Magie offensive brutale, sorts de zone et dégâts élémentaires.", en: "Brutal offensive magic, area spells and elemental damage." } },
  sorcierSupreme: { tier: 3, branch: "sorcier", main: ["int", "vol"], next: ["archimage"], art: "mage", fr: "Sorcier Suprême", en: "Supreme Sorcerer" },
  archimage: { tier: 4, branch: "sorcier", main: ["int", "vol"], next: ["mageSupreme"], art: "mage", fr: "Archimage", en: "Archmage" },
  mageSupreme: { tier: 5, branch: "sorcier", main: ["int", "vol"], next: [], art: "mage", fr: "Mage Suprême", en: "Supreme Mage" },
  necromancien: { tier: 2, branch: "sorcier", main: ["vol", "int"], next: ["demoniste"], art: "necromancien", fr: "Nécromancien", en: "Necromancer",
    ref: "Kabuto, Megumi Fushiguro",
    focus: { fr: "Invocations, malédictions, affaiblissements et dégâts sur la durée.", en: "Summons, curses, debuffs and damage over time." } },
  demoniste: { tier: 3, branch: "sorcier", main: ["vol", "int"], next: ["seigneurMorts"], art: "necromancien", fr: "Démoniste", en: "Warlock" },
  seigneurMorts: { tier: 4, branch: "sorcier", main: ["vol", "int"], next: ["necromancienSupreme"], art: "necromancien", fr: "Seigneur des Morts", en: "Lord of the Dead" },
  necromancienSupreme: { tier: 5, branch: "sorcier", main: ["vol", "int"], next: [], art: "necromancien", fr: "Nécromancien Suprême", en: "Supreme Necromancer" },

  pretre: { tier: 1, branch: "pretre", main: ["vol", "vit"], next: ["clerc", "sage"], art: "pretre", fr: "Prêtre", en: "Priest",
    focus: { fr: "Soutien et polyvalence : il protège et soigne les siens.", en: "Support and versatility: protects and heals allies." } },
  clerc: { tier: 2, branch: "pretre", main: ["vol", "vit"], next: ["prophete"], art: "clerc", fr: "Clerc", en: "Cleric",
    ref: "Tsunade, Orihime Inoue",
    focus: { fr: "Soins de groupe, barrières de protection, résurrection et renforts d'équipe.", en: "Group healing, protective barriers, resurrection and team buffs." } },
  prophete: { tier: 3, branch: "pretre", main: ["vol", "vit"], next: ["saint"], art: "clerc", fr: "Prophète", en: "Prophet" },
  saint: { tier: 4, branch: "pretre", main: ["vol", "vit"], next: ["clercSupreme"], art: "clerc", fr: "Saint", en: "Saint" },
  clercSupreme: { tier: 5, branch: "pretre", main: ["vol", "vit"], next: [], art: "clerc", fr: "Clerc Suprême", en: "Supreme Cleric" },
  sage: { tier: 2, branch: "pretre", main: ["vol", "fce"], next: ["mystique"], art: "sage", fr: "Sage", en: "Sage",
    ref: "Jiraiya, Chopper",
    focus: { fr: "Hybride soutien et combat, métamorphoses et magie de la nature.", en: "Support and combat hybrid, shapeshifting and nature magic." } },
  mystique: { tier: 3, branch: "pretre", main: ["vol", "fce"], next: ["druide"], art: "sage", fr: "Mystique", en: "Mystic" },
  druide: { tier: 4, branch: "pretre", main: ["vol", "fce"], next: ["sageSupreme"], art: "sage", fr: "Druide", en: "Druid" },
  sageSupreme: { tier: 5, branch: "pretre", main: ["vol", "fce"], next: [], art: "sage", fr: "Sage Suprême", en: "Supreme Sage" },

  mecanicien: { tier: 1, branch: "mecanicien", main: ["int", "agi"], next: ["ingenieur"], art: "mecanicien", fr: "Mécanicien", en: "Mechanic",
    focus: { fr: "Technologie et tirs : il construit ses propres armes.", en: "Technology and shooting: builds their own weapons." } },
  ingenieur: { tier: 2, branch: "mecanicien", main: ["int", "agi"], next: ["mecha", "erudit"], art: "ingenieur", fr: "Ingénieur", en: "Engineer",
    ref: "Genos, Franky",
    focus: { fr: "Tourelles, armes lourdes et contrôle de zone technologique.", en: "Turrets, heavy weapons and technological area control." } },
  mecha: { tier: 3, branch: "mecanicien", main: ["vit", "int"], next: ["archiIngenieurMecha"], art: "mecha", fr: "Mécha", en: "Mecha",
    focus: { fr: "Armure robotisée : plus solide, plus lourd.", en: "Robotic armour: tougher and heavier." } },
  erudit: { tier: 3, branch: "mecanicien", main: ["int", "vol"], next: ["archiIngenieur"], art: "erudit", fr: "Érudit", en: "Scholar",
    focus: { fr: "Inventions de précision : plus de technique, plus de savoir.", en: "Precision inventions: more technique, more knowledge." } },
  archiIngenieurMecha: { tier: 4, branch: "mecanicien", main: ["vit", "int"], next: ["ingenieurSupremeMecha"], art: "mecha", fr: "Archi-Ingénieur", en: "Arch-Engineer" },
  archiIngenieur: { tier: 4, branch: "mecanicien", main: ["int", "vol"], next: ["ingenieurSupreme"], art: "erudit", fr: "Archi-Ingénieur", en: "Arch-Engineer" },
  ingenieurSupremeMecha: { tier: 5, branch: "mecanicien", main: ["vit", "int"], next: [], art: "mecha", fr: "Ingénieur Suprême", en: "Supreme Engineer" },
  ingenieurSupreme: { tier: 5, branch: "mecanicien", main: ["int", "vol"], next: [], art: "erudit", fr: "Ingénieur Suprême", en: "Supreme Engineer" }
};

export const BRANCHES = ["guerrier", "chasseur", "sorcier", "pretre", "mecanicien"];

/** Bonus de classe selon son rang : [caractéristique principale, secondaire] */
const TIER_BONUS = [[0, 0], [10, 5], [25, 12], [45, 22], [70, 35], [100, 50]];

/**
 * Classe actuelle d'après les choix faits (path) et le niveau.
 * pending : les classes à choisir maintenant (choix obligatoire), sinon null.
 */
export function classAt(path, level) {
  const chosen = Array.isArray(path) ? path : [];
  let id = "novice";
  const chain = ["novice"];
  let pending = null;
  for (;;) {
    const cls = CLASSES[id];
    const rank = cls.tier + 1;
    if (!cls.next.length || rank > GATES.length || level < GATES[rank - 1]) break;
    let pick = cls.next.length === 1 ? cls.next[0] : chosen.find(c => cls.next.includes(c));
    if (!pick) { pending = [...cls.next]; break; }
    id = pick;
    chain.push(id);
  }
  return { id, tier: CLASSES[id].tier, chain, pending, nextGate: GATES[CLASSES[id].tier] || null };
}

/** Évolutions à venir de la classe actuelle (pour la frise) : [{ id, level, choice }] */
export function upcoming(classId) {
  const out = [];
  let id = classId;
  while (CLASSES[id]?.next.length && CLASSES[id].tier < GATES.length) {
    const cls = CLASSES[id];
    const level = GATES[cls.tier];
    if (cls.next.length > 1) { out.push({ id: null, options: [...cls.next], level }); break; }
    id = cls.next[0];
    out.push({ id, level });
  }
  return out;
}

/* ─── Équipement ───────────────────────────────────────── */
// slot : weapon | outfit | accessory ; req : niveau et classe (la classe ou l'une de ses évolutions)
// art : dessin de l'icône ; rarity : 1 commun, 2 rare, 3 légendaire
const W = (id, level, cls, price, bonus, art, rarity, fr, en) => [id, { slot: "weapon", req: { level, cls }, price, bonus, art, rarity, fr, en }];
const O = (id, level, price, bonus, art, rarity, fr, en) => [id, { slot: "outfit", req: { level, cls: null }, price, bonus, art, rarity, fr, en }];
const A = (id, level, price, bonus, art, rarity, fr, en) => [id, { slot: "accessory", req: { level, cls: null }, price, bonus, art, rarity, fr, en }];

export const GEAR = Object.fromEntries([
  W("baton", 1, null, 60, { fce: 3, agi: 3 }, "staff", 1, "Bâton d'entraînement", "Training staff"),
  W("epee", 10, "guerrier", 200, { fce: 12, vit: 4 }, "sword", 1, "Épée longue", "Longsword"),
  W("dague", 10, "chasseur", 200, { agi: 12, fce: 4 }, "dagger", 1, "Dague", "Dagger"),
  W("grimoire", 10, "sorcier", 200, { int: 12, vol: 4 }, "book", 1, "Grimoire", "Spellbook"),
  W("sceptre", 10, "pretre", 200, { vol: 12, vit: 4 }, "scepter", 1, "Sceptre", "Sceptre"),
  W("cle", 10, "mecanicien", 200, { int: 8, agi: 8 }, "wrench", 1, "Clé à molette", "Wrench"),
  W("bouclier", 30, "paladin", 600, { vit: 30, fce: 10 }, "shield", 2, "Grand bouclier", "Tower shield"),
  W("hache", 30, "berserker", 600, { fce: 35, vit: 5 }, "axe", 2, "Hache à deux mains", "Greataxe"),
  W("lames", 30, "assassin", 600, { agi: 30, fce: 10 }, "dagger", 2, "Lames jumelles", "Twin blades"),
  W("arc", 30, "ranger", 600, { agi: 30, vit: 10 }, "bow", 2, "Arc long", "Longbow"),
  W("batonAstral", 30, "mage", 600, { int: 35, vol: 5 }, "staff", 2, "Bâton astral", "Astral staff"),
  W("faux", 30, "necromancien", 600, { vol: 20, int: 20 }, "scythe", 2, "Faux maudite", "Cursed scythe"),
  W("masse", 30, "clerc", 600, { vol: 30, vit: 10 }, "scepter", 2, "Masse sacrée", "Holy mace"),
  W("batonSauvage", 30, "sage", 600, { vol: 20, fce: 20 }, "staff", 2, "Bâton sauvage", "Wild staff"),
  W("tourelle", 30, "ingenieur", 600, { int: 25, agi: 15 }, "wrench", 2, "Tourelle portative", "Portable turret"),
  W("egide", 65, "paladin", 1600, { vit: 60, fce: 25 }, "shield", 3, "Égide céleste", "Celestial aegis"),
  W("fendeuse", 65, "berserker", 1600, { fce: 65, vit: 20 }, "axe", 3, "Fendeuse de titans", "Titan cleaver"),
  W("lameOmbre", 65, "assassin", 1600, { agi: 60, fce: 25 }, "dagger", 3, "Lame d'ombre", "Shadow blade"),
  W("arcFaucon", 65, "ranger", 1600, { agi: 60, vit: 25 }, "bow", 3, "Arc du faucon", "Hawk bow"),
  W("batonComete", 65, "mage", 1600, { int: 65, vol: 20 }, "staff", 3, "Bâton de la comète", "Comet staff"),
  W("fauxAmes", 65, "necromancien", 1600, { vol: 45, int: 40 }, "scythe", 3, "Faux des âmes", "Soul scythe"),
  W("relique", 65, "clerc", 1600, { vol: 60, vit: 25 }, "scepter", 3, "Relique sainte", "Holy relic"),
  W("batonChene", 65, "sage", 1600, { vol: 45, fce: 40 }, "staff", 3, "Bâton du grand chêne", "Great oak staff"),
  W("canon", 65, "ingenieur", 1600, { int: 50, agi: 35 }, "wrench", 3, "Canon mécanique", "Mech cannon"),

  O("survet", 1, 80, { vit: 5, agi: 3 }, "shirt", 1, "Tenue de sport", "Gym outfit"),
  O("cuir", 10, 250, { vit: 10, agi: 8 }, "armor", 1, "Armure de cuir", "Leather armour"),
  O("robe", 10, 250, { int: 10, vol: 8 }, "robe", 1, "Robe d'apprenti", "Apprentice robe"),
  O("mailles", 30, 650, { vit: 25, fce: 12 }, "armor", 2, "Cotte de mailles", "Chainmail"),
  O("cape", 30, 650, { agi: 25, int: 12 }, "cloak", 2, "Cape d'ombre", "Shadow cloak"),
  O("habit", 30, 650, { vol: 25, vit: 12 }, "robe", 2, "Habit sacré", "Holy vestment"),
  O("armureCeleste", 65, 1600, { vit: 50, vol: 25 }, "armor", 3, "Armure céleste", "Celestial armour"),
  O("tenueArchimage", 65, 1600, { int: 50, vol: 25 }, "robe", 3, "Tenue de l'archimage", "Archmage attire"),
  O("combiMecha", 65, 1600, { agi: 40, int: 35 }, "cloak", 3, "Combinaison mécha", "Mecha suit"),

  A("bracelet", 5, 120, { fce: 8 }, "bracelet", 1, "Bracelet de force", "Strength bracelet"),
  A("plume", 5, 120, { agi: 8 }, "feather", 1, "Plume du vent", "Wind feather"),
  A("anneau", 5, 120, { int: 8 }, "ring", 1, "Anneau de sagesse", "Ring of wisdom"),
  A("pendentif", 5, 120, { vol: 8 }, "pendant", 1, "Pendentif d'esprit", "Spirit pendant"),
  A("talisman", 5, 120, { vit: 8 }, "talisman", 1, "Talisman de vie", "Life talisman"),
  A("couronne", 50, 1200, { fce: 10, agi: 10, int: 10, vol: 10, vit: 10 }, "crown", 3, "Couronne du champion", "Champion's crown")
]);

export const SLOTS = ["weapon", "outfit", "accessory"];
export const gearTag = id => `gear:${id}`;

/** L'objet peut-il être porté maintenant ? (niveau atteint et bonne classe) */
export function canWear(item, level, chain) {
  if (!item) return false;
  if (level < item.req.level) return false;
  return !item.req.cls || chain.includes(item.req.cls);
}

/* ─── Feuille du personnage ────────────────────────────── */
const toInt = n => Math.max(0, Math.floor(Number(n) || 0));
const round1 = n => Math.round(n * 10) / 10;

/** Points répartis, nettoyés (entiers positifs, caractéristiques connues) */
export function cleanAlloc(alloc) {
  return Object.fromEntries(STATS.map(s => [s, toInt(alloc?.[s])]));
}

/** Attributs tirés des caractéristiques (barème de la fiche) */
export function derived(stats) {
  return {
    pv: 100 + 40 * stats.vit,
    pm: 50 + 20 * stats.vol,
    atqCac: 3 * stats.fce,
    atqDist: 3 * stats.agi,
    atqMag: 3 * stats.int,
    def: round1(1.5 * stats.vit),
    defMag: round1(1.5 * stats.vol),
    esquive: Math.floor(stats.agi / 10),
    critPhys: Math.floor(stats.agi / 28),
    critMag: Math.floor(stats.int / 28),
    parade: Math.min(80, round1(stats.fce * 0.114))
  };
}

/**
 * Tout le personnage.
 * xp : points spé gagnés depuis le début ; rpg : { path, alloc, gear } ;
 * owned(id) : l'objet d'équipement est-il acheté ?
 */
export function character({ xp = 0, rpg = null, owned = () => false } = {}) {
  const level = levelOf(xp);
  const cls = classAt(rpg?.path, level);
  const alloc = cleanAlloc(rpg?.alloc);
  const total = POINTS_PER_LEVEL * (level - 1);
  const used = STATS.reduce((sum, s) => sum + alloc[s], 0);

  const classBonus = Object.fromEntries(STATS.map(s => [s, 0]));
  const main = CLASSES[cls.id].main;
  const [b1, b2] = TIER_BONUS[cls.tier];
  if (main[0]) classBonus[main[0]] += b1;
  if (main[1]) classBonus[main[1]] += b2;

  const gear = {};
  const gearBonus = Object.fromEntries(STATS.map(s => [s, 0]));
  for (const slot of SLOTS) {
    const id = rpg?.gear?.[slot];
    const item = GEAR[id];
    if (!item || item.slot !== slot || !owned(id)) continue;
    const active = canWear(item, level, cls.chain);
    gear[slot] = { id, item, active };
    if (active) for (const [s, n] of Object.entries(item.bonus)) gearBonus[s] += n;
  }

  const stats = Object.fromEntries(STATS.map(s => [s, BASE_STAT + alloc[s] + classBonus[s] + gearBonus[s]]));
  const next = level < MAX_LEVEL ? xpForLevel(level + 1) : null;
  const start = xpForLevel(level);
  return {
    xp, level, maxed: level >= MAX_LEVEL,
    levelStart: start, levelNext: next,
    progress: next ? Math.min(1, (xp - start) / (next - start)) : 1,
    cls, alloc, classBonus, gearBonus, gear, stats,
    attrs: derived(stats),
    points: { total, used, free: total - used }
  };
}

/** Ajoute des points (draft : { fce: 2 … }) si assez de points libres ; renvoie la nouvelle répartition ou null */
export function allocate(rpg, draft, freePoints) {
  const add = cleanAlloc(draft);
  const sum = STATS.reduce((n, s) => n + add[s], 0);
  if (!sum || sum > freePoints) return null;
  const alloc = cleanAlloc(rpg?.alloc);
  for (const s of STATS) alloc[s] += add[s];
  return { ...(rpg || {}), alloc };
}

/** Choisit une classe proposée maintenant ; renvoie le nouvel état ou null si ce choix n'est pas ouvert */
export function chooseClass(rpg, level, classId) {
  const cls = classAt(rpg?.path, level);
  if (!cls.pending?.includes(classId)) return null;
  return { ...(rpg || {}), path: [...(rpg?.path || []), classId] };
}

/** Repartir de Novice (changer de voie) : les points répartis restent, l'équipement d'une autre classe ne compte plus */
export function resetClass(rpg) {
  return { ...(rpg || {}), path: [] };
}

/** Porte un objet (ou retire l'objet de cet emplacement avec id = null) */
export function equip(rpg, slot, id) {
  const gear = { ...(rpg?.gear || {}) };
  if (id) gear[slot] = id;
  else delete gear[slot];
  return { ...(rpg || {}), gear };
}

/* ─── Textes de la fiche (FR / EN) ─────────────────────── */
export const STAT_INFO = {
  fce: { fr: "Force", en: "Strength", abbr: { fr: "FCE", en: "STR" },
    rule: { fr: "1 FCE = +3 attaque au corps à corps · 10 FCE = +1,14 % de parade (80 % max)", en: "1 STR = +3 melee attack · 10 STR = +1.14% parry (80% max)" },
    for: ["berserker", "paladin", "guerrier", "sage"] },
  agi: { fr: "Agilité", en: "Agility", abbr: { fr: "AGI", en: "AGI" },
    rule: { fr: "1 AGI = +3 attaque à distance · 10 AGI = +1 esquive · 28 AGI = +1 % de critique physique", en: "1 AGI = +3 ranged attack · 10 AGI = +1 dodge · 28 AGI = +1% physical crit" },
    for: ["assassin", "ranger", "chasseur", "mecanicien"] },
  int: { fr: "Intelligence", en: "Intelligence", abbr: { fr: "INT", en: "INT" },
    rule: { fr: "1 INT = +3 attaque magique · 28 INT = +1 % de critique magique", en: "1 INT = +3 magic attack · 28 INT = +1% magic crit" },
    for: ["mage", "necromancien", "sorcier", "ingenieur"] },
  vol: { fr: "Volonté", en: "Willpower", abbr: { fr: "VOL", en: "WIL" },
    rule: { fr: "1 VOL = +20 points de mana · 1 VOL = +1,5 défense magique", en: "1 WIL = +20 mana · 1 WIL = +1.5 magic defence" },
    for: ["clerc", "sage", "pretre", "necromancien"] },
  vit: { fr: "Vitalité", en: "Vitality", abbr: { fr: "VIT", en: "VIT" },
    rule: { fr: "1 VIT = +40 points de vie · 1 VIT = +1,5 défense physique", en: "1 VIT = +40 HP · 1 VIT = +1.5 physical defence" },
    for: ["paladin", "guerrier", "clerc", "mecha"] }
};

export const ATTR_INFO = {
  pv: { fr: "Points de vie", en: "Health" },
  pm: { fr: "Points de mana", en: "Mana" },
  atqCac: { fr: "Attaque corps à corps", en: "Melee attack" },
  atqDist: { fr: "Attaque à distance", en: "Ranged attack" },
  atqMag: { fr: "Attaque magique", en: "Magic attack" },
  def: { fr: "Défense physique", en: "Physical defence" },
  defMag: { fr: "Défense magique", en: "Magic defence" },
  esquive: { fr: "Esquive", en: "Dodge" },
  critPhys: { fr: "Critique physique", en: "Physical crit", unit: "%" },
  critMag: { fr: "Critique magique", en: "Magic crit", unit: "%" },
  parade: { fr: "Réduction de parade", en: "Parry reduction", unit: "%" }
};

export const className = (id, lang = "fr") => CLASSES[id]?.[lang === "en" ? "en" : "fr"] || "";
export const gearName = (id, lang = "fr") => GEAR[id]?.[lang === "en" ? "en" : "fr"] || "";
