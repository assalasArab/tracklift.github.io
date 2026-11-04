/* ═══════════════════════════════════════════════════════════
   Fenêtre du héros : le carnet d'aventurier, façon MMORPG,
   aux couleurs de TrackLift.
   Onglets : Héros (personnage + équipement), Stats, Apparence
   (garde-robe + miroir), Boutique (le marchand), Voie (classe).
   Le sac s'ouvre en bas de l'écran ; chaque objet a sa fiche :
   rareté, bonus comparés à ce que tu portes, conditions, légende.
   Un objet choisi s'essaie sur le personnage avant de l'acheter.
   Règles du jeu : js/rpg.js ; légendes : js/lore.js.
   ═══════════════════════════════════════════════════════════ */
import { character, CLASSES, GEAR, SLOTS, STATS, STAT_INFO, ATTR_INFO, GATES, upcoming, allocate, resetClass, equip, gearTag, className, gearName, CLASS_CHANGE_PRICE } from "./rpg.js?v=20261104g";
import { emblemSvg, statIcon, gearIcon, BRANCH_COLORS, rarityOf, rarityOfPrice, rarityByKey } from "./rpg-art.js?v=20261104g";
import { openWheel, wheelState, discounted } from "./gift-wheel.js?v=20261104g";
import { figureSvg, FACE_OPTIONS, thumbUrl } from "./avatar3.js?v=20261104g";
import { COSMETIC_BACKGROUNDS, COSMETICS, cosmeticById, lookTag, GEAR_ART } from "./cosmetics.js?v=20261104g";
import { SKINS, HAIR_COLORS, EYE_COLORS, priceOf } from "./avatar-parts.js?v=20261104g";
import { currentLook, saveLook, ownsLook, wornGear, syncProfileAvatar } from "./avatar3-ui.js?v=20261104g";
import { rpgState, saveRpg, openClassChoice } from "./rpg-ui.js?v=20261104g";
import { GEAR_LORE, LOOK_LORE, DYE_LORE, BRANCH_LORE, MERCHANT, loreText, pickLine } from "./lore.js?v=20261104g";
import { i18n } from "./i18n.js?v=20261104g";
import { showToast } from "./utils.js?v=20261104g";
import { DB } from "./db.js?v=20261104g";
import { Shop } from "./shop.js?v=20261104g";
import { Social } from "./social.js?v=20261104g";
import { openSheet, esc, cap, confirmSheet, reducedMotion, MASCOT } from "./potes-ui.js?v=20261104g";

const PS = `<svg class="hx-ps" viewBox="0 0 24 24" aria-hidden="true"><use href="#ps-icon"/></svg>`;
const ICON = {
  hero: `<path d="M12 3l7 3v5c0 5-3.2 8.3-7 10-3.8-1.7-7-5-7-10V6z"/><path d="M12 8v8M8.5 11.5h7"/>`,
  stats: `<path d="M3.5 9v6M6.5 7.5v9M17.5 7.5v9M20.5 9v6M6.5 12h11"/>`,
  look: `<path d="M12 7.2a2.1 2.1 0 1 1 2.1-2.1"/><path d="M12 7.2v1.6L3 15.5c-.8.6-.4 1.9.6 1.9h16.8c1 0 1.4-1.3.6-1.9L12 8.8"/>`,
  shop: `<path d="M5 8.5h14l-1.2 11.5H6.2z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>`,
  path: `<path d="M6 21V4h11l-2.2 4 2.2 4H6"/>`,
  bolt: `<path d="M13 2.5L4.5 14H11l-1 7.5L19.5 10H13z"/>`,
  lock: `<rect x="5.5" y="10.5" width="13" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
  dice: `<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/>`,
  ghost: {
    weapon: `<path d="M14.5 3.5H20.5v6L10 20l-6-6z"/><path d="M6.5 13.5l4 4M3.5 20.5l2.8-2.8"/>`,
    outfit: `<path d="M8 3.5L3.5 7l2.3 3.3L8 9v11.5h8V9l2.2 1.3L20.5 7 16 3.5c-.8 1.6-2.3 2.5-4 2.5S8.8 5.1 8 3.5z"/>`,
    accessory: `<circle cx="12" cy="14.5" r="6"/><path d="M9.5 6.5L12 3l2.5 3.5L12 8.5z"/>`,
    costume: `<path d="M12 3c-3 0-4.5 2-4.5 4.5L4 20.5h16L16.5 7.5C16.5 5 15 3 12 3z"/>`,
    weaponSkin: `<path d="M12 2.5l2.2 4V15H9.8V6.5z"/><path d="M7.5 15h9M12 15v4.5"/>`,
    companion: `<path d="M5 18c0-4 3-7 7-7s7 3 7 7"/><circle cx="8.5" cy="6.5" r="2"/><circle cx="15.5" cy="6.5" r="2"/>`,
    bg: `<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M3.5 15l5-4 4 3 3-2 5 4"/>`
  }
};
const svg = (paths, cls = "") => `<svg class="hx-ico${cls ? ` ${cls}` : ""}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
/** Flacon de teinture, rempli de sa couleur */
const potion = color => `<svg class="hx-potion" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <path d="M19 9h10v8.5c6.2 2.3 10 7.6 10 13.5a15 15 0 0 1-30 0c0-5.9 3.8-11.2 10-13.5z" fill="${color}"/>
  <path d="M19 9h10v8.5c6.2 2.3 10 7.6 10 13.5a15 15 0 0 1-30 0c0-5.9 3.8-11.2 10-13.5z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="M17 6.5h14" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M15.5 30.5c.8-3.6 3.3-6.4 6.5-7.6" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2.6" stroke-linecap="round"/>
</svg>`;

const TABS = ["hero", "stats", "look", "shop", "path"];
const TEXT = {
  fr: {
    kicker: "Carnet d'aventurier", title: "Mon héros", close: "Fermer",
    tabs: { hero: "Héros", stats: "Stats", look: "Apparence", shop: "Boutique", path: "Voie" },
    purse: "points spé", level: "Niv. {n}", power: "Puissance",
    xpNext: "{have} / {need} avant le niveau {n}", xpMax: "Niveau maximum atteint",
    slot: { weapon: "Arme", outfit: "Tenue", accessory: "Accessoire", costume: "Tenue entière", weaponSkin: "Skin d'arme", companion: "Compagnon", bg: "Fond" },
    empty: "Vide", hint: "Touche un emplacement pour ouvrir ton sac.", lookHint: "Apparence seule : les bonus restent ceux de ton équipement.",
    gearBonus: "Bonus de l'équipement", noGear: "Rien sur le dos pour l'instant : touche un emplacement.",
    toPlace: "points à placer", toPlaceOne: "point à placer", place: "Les placer",
    chooseCta: "Niveau {n} : choisis ta voie", choose: "Choisir",
    levelUp: "Niveau {n} !", levelUpSub: "+{pts} points de caractéristique à placer", levelUpChoose: "Une nouvelle voie s'ouvre à toi.",
    inBag: "Dans ton sac", atMerchant: "Chez le marchand", bagEmpty: "Rien dans ton sac pour cet emplacement.",
    type: { weapon: "Arme", outfit: "Tenue", accessory: "Accessoire", costume: "Skin · tenue entière", weaponSkin: "Skin d'arme", bg: "Fond", dye: "Teinture", companion: "Compagnon" },
    reqLevel: "Niveau {n}", reqClass: "Voie : {cls}", vs: "Comparé à : {name}",
    coveredBy: "Ta skin « {name} » recouvre cet objet : il garde ses bonus.", skinNote: "Apparence seule : les bonus restent ceux de ton équipement.",
    equip: "Équiper", unequip: "Retirer", apply: "Utiliser", inUse: "Utilisé",
    buy: "Acheter", missing: "Il te manque {n} points spé", tooLow: "Niveau {n} requis", wrongClass: "Réservé : {cls}",
    obtained: "Obtenu !", bought: "{name} est dans ton sac.", equipped: "Équipé : {name}",
    preview: "Aperçu", tryOn: "Essayage",
    attrs: "Attributs", buildLabel: "Ton build : {list}",
    noPoints: "Chaque niveau te donne 5 points à placer.", blocked: "Choisis d'abord ta voie pour placer tes points.",
    over: "{n} points en trop (des séances ont été supprimées) : redistribue-les.",
    breakdown: "{base} base · {mine} placés · {cls} classe · {gear} équipement",
    add: "Ajouter un point en {name}", remove: "Retirer un point en {name}",
    validate: "Valider ({n})", cancel: "Annuler", saved: "Points placés.",
    reset: "Tout redistribuer", resetTitle: "Redistribuer tes points ?", resetText: "Tous tes points placés reviennent à placer. C'est gratuit.", resetOk: "Redistribuer",
    mirror: "Miroir", random: "Au hasard",
    styleCats: { hair: "Coupe", eyes: "Yeux", mouth: "Bouche", skin: "Peau", dyes: "Teintures" },
    hairDyes: "Cheveux", eyeDyes: "Yeux", dyeName: { hair: "Cheveux {c}", eyes: "Yeux {c}" },
    none: "Aucune", noneM: "Aucun", companionSoon: "Les premiers compagnons arrivent bientôt au Comptoir.",
    shopName: "Comptoir de la Fonte", merchant: "Le marchand",
    cats: { weapon: "Armes", outfit: "Tenues", accessory: "Accessoires", skins: "Skins", bg: "Fonds", dyes: "Teintures" },
    owned: "Possédé", worn: "Équipé",
    wheelTag: "Roue", wheelOnly: "Ne s'achète pas : à gagner à la Roue des cadeaux.", openWheel: "Ouvrir la roue",
    wheelTitle: "Roue des cadeaux", wheelSpins: "{n} tours à jouer", wheelSpinsOne: "1 tour à jouer", wheelNoSpin: "Un code cadeau ? Tente ta chance",
    coupons: "Tes bons", couponsList: "Tes bons de réduction : {list}", couponNone: "Sans bon",
    pathNow: "Ta voie", rank: "Rang {n}", strengthens: "Renforce : {list}", style: "Style : {ref}",
    evolutions: "Évolutions", atLevel: "Niv. {n}", choiceAt: "Choix au niv. {n}",
    change: "Changer de voie ({price} points spé)", changeTitle: "Changer de voie ?",
    changeText: "Tu redeviens Novice et tu choisis une nouvelle voie. Coût : {price} points spé. Tes points placés et tes objets restent.",
    changeOk: "Changer pour {price}", changeShort: "Il te faut {price} points spé pour changer de voie.",
    earn: "Gagner des points spé",
    earnText: "Pesée du jour : +10, multiplié par le bonus de ta série (jusqu'à ×6). Séance du jour (3 séries ou plus) : +15. Les deux le même jour : +5. Ton niveau vient de tout ce que tu as gagné : dépenser ne le fait jamais baisser."
  },
  en: {
    kicker: "Adventurer's log", title: "My hero", close: "Close",
    tabs: { hero: "Hero", stats: "Stats", look: "Look", shop: "Shop", path: "Path" },
    purse: "spec points", level: "Lv. {n}", power: "Power",
    xpNext: "{have} / {need} before level {n}", xpMax: "Max level reached",
    slot: { weapon: "Weapon", outfit: "Outfit", accessory: "Accessory", costume: "Full outfit", weaponSkin: "Weapon skin", companion: "Companion", bg: "Background" },
    empty: "Empty", hint: "Tap a slot to open your bag.", lookHint: "Look only: bonuses stay those of your gear.",
    gearBonus: "Gear bonuses", noGear: "Nothing on your back yet: tap a slot.",
    toPlace: "points to assign", toPlaceOne: "point to assign", place: "Assign",
    chooseCta: "Level {n}: choose your path", choose: "Choose",
    levelUp: "Level {n}!", levelUpSub: "+{pts} attribute points to assign", levelUpChoose: "A new path opens before you.",
    inBag: "In your bag", atMerchant: "At the merchant", bagEmpty: "Nothing in your bag for this slot.",
    type: { weapon: "Weapon", outfit: "Outfit", accessory: "Accessory", costume: "Skin · full outfit", weaponSkin: "Weapon skin", bg: "Background", dye: "Dye", companion: "Companion" },
    reqLevel: "Level {n}", reqClass: "Path: {cls}", vs: "Compared to: {name}",
    coveredBy: "Your “{name}” skin covers this item: it keeps its bonuses.", skinNote: "Look only: bonuses stay those of your gear.",
    equip: "Equip", unequip: "Take off", apply: "Use", inUse: "In use",
    buy: "Buy", missing: "You need {n} more spec points", tooLow: "Level {n} required", wrongClass: "Reserved: {cls}",
    obtained: "Got it!", bought: "{name} is in your bag.", equipped: "Equipped: {name}",
    preview: "Preview", tryOn: "Try-on",
    attrs: "Stats", buildLabel: "Your build: {list}",
    noPoints: "Each level gives you 5 points to assign.", blocked: "Choose your path first to assign your points.",
    over: "{n} points too many (workouts were deleted): reassign them.",
    breakdown: "{base} base · {mine} assigned · {cls} class · {gear} gear",
    add: "Add a point to {name}", remove: "Remove a point from {name}",
    validate: "Confirm ({n})", cancel: "Cancel", saved: "Points assigned.",
    reset: "Reassign everything", resetTitle: "Reassign your points?", resetText: "All your assigned points go back to the pool. It's free.", resetOk: "Reassign",
    mirror: "Mirror", random: "Random",
    styleCats: { hair: "Hair", eyes: "Eyes", mouth: "Mouth", skin: "Skin", dyes: "Dyes" },
    hairDyes: "Hair", eyeDyes: "Eyes", dyeName: { hair: "{c} hair", eyes: "{c} eyes" },
    none: "None", noneM: "None", companionSoon: "The first companions arrive at the Counter soon.",
    shopName: "The Iron Counter", merchant: "The merchant",
    cats: { weapon: "Weapons", outfit: "Outfits", accessory: "Accessories", skins: "Skins", bg: "Backgrounds", dyes: "Dyes" },
    owned: "Owned", worn: "Equipped",
    wheelTag: "Wheel", wheelOnly: "Not for sale: win it on the Gift wheel.", openWheel: "Open the wheel",
    wheelTitle: "Gift wheel", wheelSpins: "{n} spins to play", wheelSpinsOne: "1 spin to play", wheelNoSpin: "Got a gift code? Try your luck",
    coupons: "Your vouchers", couponsList: "Your vouchers: {list}", couponNone: "No voucher",
    pathNow: "Your path", rank: "Rank {n}", strengthens: "Strengthens: {list}", style: "Style: {ref}",
    evolutions: "Evolutions", atLevel: "Lv. {n}", choiceAt: "Choice at lv. {n}",
    change: "Change path ({price} spec points)", changeTitle: "Change path?",
    changeText: "You become a Novice again and choose a new path. Cost: {price} spec points. Your assigned points and items stay.",
    changeOk: "Change for {price}", changeShort: "You need {price} spec points to change path.",
    earn: "Earning spec points",
    earnText: "Daily weigh-in: +10, multiplied by your streak bonus (up to ×6). Daily workout (3 sets or more): +15. Both on the same day: +5. Your level comes from everything you've earned: spending never lowers it."
  }
};

const lang = () => (i18n.getLanguage() === "en" ? "en" : "fr");
const T = () => TEXT[lang()];
const fill = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const num = n => Number(n).toLocaleString(i18n.getLocale(), { maximumFractionDigits: 1 });
const statName = s => STAT_INFO[s][lang()];
const statAbbr = s => STAT_INFO[s].abbr[lang()];
const STAT_COLORS = { fce: "#d4553f", agi: "#4f9a52", int: "#8a5cd6", vol: "#3f87c0", vit: "#d9547a" };
const ownsGear = id => DB.getPurchases().some(p => p.id === gearTag(id));
const rarityName = r => r[lang()];
const zero = () => Object.fromEntries(STATS.map(s => [s, 0]));
const bgOf = id => COSMETIC_BACKGROUNDS.find(b => b.id === id) || COSMETIC_BACKGROUNDS[0];
const bgCss = bg => (bg.stops ? `linear-gradient(180deg, ${bg.stops.join(", ")})` : bg.color);
const classColor = ch => BRANCH_COLORS[CLASSES[ch.cls.id].branch || "novice"];
const dyeKey = part => (part === "hair" ? "hairColor" : "eyeColor");
const freePoints = ch => (ch.cls.pending ? 0 : Math.max(0, ch.points.free));

/** Puissance : un seul chiffre pour mesurer son héros (caractéristiques et niveau) */
const powerOf = ch => Math.round(STATS.reduce((n, s) => n + ch.stats[s], 0) * 4 + ch.level * 10);

/** Objet utile pour ma voie : sans classe, de ma classe, ou d'une classe que je pourrai devenir (un Novice voit tout) */
function reachable(item, cls) {
  if (!item.req.cls || cls.id === "novice") return true;
  if (cls.chain.includes(item.req.cls)) return true;
  const below = id => CLASSES[id].next.some(n => n === item.req.cls || below(n));
  return below(cls.id);
}
/** Équipement d'un emplacement, du plus petit niveau au plus grand */
const gearFor = (slot, cls) => Object.entries(GEAR).filter(([, g]) => g.slot === slot && reachable(g, cls))
  .sort((a, b) => a[1].req.level - b[1].req.level || a[1].price - b[1].price).map(([id]) => id);

/* ─── Tout objet du jeu, ramené à une même fiche ───────── */
function itemInfo(kind, id) {
  const L = lang();
  const t = T();
  const { wallet, rpg, ch } = rpgState();
  const look = currentLook();
  if (kind === "gear") {
    const g = GEAR[id];
    const art = GEAR_ART[id];
    const levelOk = ch.level >= g.req.level;
    const classOk = !g.req.cls || ch.cls.chain.includes(g.req.cls);
    const skin = cosmeticById(g.slot === "outfit" ? look.costume : g.slot === "weapon" ? look.weaponSkin : null);
    return {
      kind, id, slot: g.slot, name: gearName(id, L), type: t.type[g.slot], rarity: rarityOf(g.req.level),
      thumb: art ? { img: thumbUrl(art.outfit ? "outfit" : "weapon", art.outfit || art.weapon) } : { icon: g.art },
      bonus: g.bonus,
      req: [
        { text: fill(t.reqLevel, { n: g.req.level }), ok: levelOk },
        ...(g.req.cls ? [{ text: fill(t.reqClass, { cls: className(g.req.cls, L) }), ok: classOk }] : [])
      ],
      lore: loreText(GEAR_LORE[id], L), note: skin && art ? fill(t.coveredBy, { name: skin[L] }) : "",
      price: g.price, owned: ownsGear(id), worn: rpg.gear?.[g.slot] === id,
      usable: levelOk && classOk, afford: wallet.balance >= g.price,
      reason: !levelOk ? fill(t.tooLow, { n: g.req.level }) : !classOk ? fill(t.wrongClass, { cls: className(g.req.cls, L) }) : ""
    };
  }
  if (kind === "look") {
    const item = cosmeticById(id);
    const art = item.art || {};
    return {
      kind, id, slot: item.slot, name: item[L], type: t.type[item.slot], rarity: item.rarity ? rarityByKey(item.rarity) : rarityOfPrice(item.price), wheel: !!item.wheel,
      thumb: { img: thumbUrl(art.outfit ? "outfit" : "weapon", art.outfit || art.weapon) },
      lore: loreText(LOOK_LORE[id], L), note: t.skinNote, price: item.price, owned: ownsLook(id, item.price),
      worn: look[item.slot] === id, usable: true, afford: wallet.balance >= item.price, reason: ""
    };
  }
  if (kind === "bg") {
    const bg = bgOf(id);
    return {
      kind, id, slot: "bg", name: bg[L], type: t.type.bg, rarity: rarityOfPrice(bg.price), thumb: { bg: bgCss(bg) },
      lore: loreText(LOOK_LORE[id], L), price: bg.price, owned: ownsLook(id, bg.price), worn: look.bg === id,
      usable: true, afford: wallet.balance >= bg.price, reason: ""
    };
  }
  // teintures : « hair:rose » ou « eyes:violet »
  const [part, color] = id.split(":");
  const key = dyeKey(part);
  const c = (part === "hair" ? HAIR_COLORS : EYE_COLORS).find(x => x.id === color);
  const price = priceOf(key, color);
  return {
    kind, id, slot: key, name: cap(fill(t.dyeName[part], { c: i18n.t(`avatarParts.${key}.${color}`) })), type: t.type.dye,
    rarity: rarityOfPrice(price), thumb: { dye: c.color }, lore: loreText(DYE_LORE[id], L), price,
    owned: !price || Shop.owned(key, color), worn: look[key] === color, usable: true, afford: wallet.balance >= price, reason: ""
  };
}

/** Ce que porterait le héros avec cet objet (essayage) ; null si l'objet ne se voit pas */
function tryOn(info) {
  const look = currentLook();
  const gear = wornGear();
  if (info.kind === "gear") {
    if (!GEAR_ART[info.id]) return null;
    // l'essayage montre l'objet lui-même, même sous une skin
    const uncover = info.slot === "outfit" ? { costume: null } : { weaponSkin: null };
    return { look: { ...look, ...uncover }, gear: { ...gear, [info.slot]: info.id } };
  }
  if (info.kind === "look") return { look: { ...look, [info.slot]: info.id }, gear };
  if (info.kind === "bg") return { look: { ...look, bg: info.id }, gear };
  if (info.kind === "dye") {
    const [part, color] = info.id.split(":");
    return { look: { ...look, [dyeKey(part)]: color }, gear, view: part === "eyes" ? "head" : "full" };
  }
  return null;
}

/** Image d'un objet : son dessin, sinon son pictogramme */
function thumbHtml(info) {
  if (info.thumb.img) return `<img src="${info.thumb.img}" alt="" loading="lazy" decoding="async">`;
  if (info.thumb.bg) return `<span class="hx-swatch" style="background:${info.thumb.bg}"></span>`;
  if (info.thumb.dye) return potion(info.thumb.dye);
  return gearIcon(info.thumb.icon, 1, 40);
}

/** Reflet qui passe sur les objets légendaires */
const shine = info => (["legendary", "mythic"].includes(info.rarity.key) ? `<span class="hx-shine" aria-hidden="true"></span>` : "");
/** Éclats autour d'un objet qui vient d'être obtenu */
const burst = () => `<span class="hx-burst" aria-hidden="true">${Array.from({ length: 10 }, (_, k) => `<i style="--a:${k * 36}deg"></i>`).join("")}</span>`;

/** Une case d'objet (sac, boutique) ; tag : prix ou « Possédé » sous la case */
function cellHtml(info, { selected = false, tag = false } = {}) {
  const t = T();
  const locked = !info.owned && !info.usable;
  const off = info.owned && !info.usable;
  const state = info.worn ? t.worn : info.owned ? t.owned : locked ? info.reason : info.wheel ? t.wheelOnly : `${num(info.price)} ${t.purse}`;
  const tagHtml = !tag ? ""
    : info.owned ? `<span class="hx-tag is-owned" aria-hidden="true">${esc(info.worn ? t.worn : t.owned)}</span>`
    : info.wheel ? `<span class="hx-tag is-wheel" aria-hidden="true">${esc(t.wheelTag)}</span>`
    : info.price ? `<span class="hx-tag${info.afford && info.usable ? "" : " is-short"}" aria-hidden="true">${PS}${num(info.price)}</span>` : "";
  return `<button type="button" class="hx-cell r-${info.rarity.key}${info.worn ? " is-worn" : ""}${locked ? " is-locked" : ""}${off ? " is-off" : ""}${selected ? " is-selected" : ""}"
      data-hx-pick="${info.kind}|${esc(info.id)}" aria-label="${esc(`${info.name}, ${rarityName(info.rarity)}, ${state}`)}" aria-pressed="${selected}">
      <span class="hx-cell-art">${thumbHtml(info)}</span>${shine(info)}
      ${info.worn ? `<span class="hx-badge" aria-hidden="true">${svg(ICON.check)}</span>` : ""}
      ${locked ? `<span class="hx-lock" aria-hidden="true">${svg(ICON.lock)}</span>` : ""}
      ${tagHtml}
    </button>`;
}
const itemHtml = (info, sel) => `<li class="hx-item">${cellHtml(info, { tag: true, selected: sel?.kind === info.kind && sel?.id === info.id })}<span class="hx-item-name r-${info.rarity.key}">${esc(info.name)}</span></li>`;

/** Toile du build : la forme des 5 caractéristiques (les points en attente en pointillés) */
function radarSvg(stats, draft, color) {
  const total = Object.fromEntries(STATS.map(s => [s, stats[s] + (draft[s] || 0)]));
  const max = Math.max(10, ...STATS.map(s => total[s]));
  const C = 90;
  const R = 56;
  const xy = (i, v) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / STATS.length;
    const r = (R * v) / max;
    return [(C + r * Math.cos(a)).toFixed(1), (C + r * Math.sin(a)).toFixed(1)];
  };
  const poly = vals => STATS.map((s, i) => xy(i, vals[s]).join(",")).join(" ");
  const ring = f => STATS.map((_, i) => xy(i, max * f).join(",")).join(" ");
  const axes = STATS.map((_, i) => { const [x, y] = xy(i, max); return `<line x1="${C}" y1="${C}" x2="${x}" y2="${y}"/>`; }).join("");
  const labels = STATS.map((s, i) => { const [x, y] = xy(i, max * 1.3); return `<text x="${x}" y="${y}">${esc(statAbbr(s))}</text>`; }).join("");
  const label = fill(T().buildLabel, { list: STATS.map(s => `${statName(s)} ${total[s]}`).join(", ") });
  const dots = STATS.map((s, i) => { const [x, y] = xy(i, total[s]); return `<circle cx="${x}" cy="${y}" r="3.2"/>`; }).join("");
  return `<svg class="hx-radar" viewBox="0 0 180 180" width="180" height="180" role="img" aria-label="${esc(label)}" style="--c:${color}" focusable="false">
    <g class="hx-radar-grid"><polygon points="${ring(1)}"/><polygon points="${ring(0.66)}"/><polygon points="${ring(0.33)}"/>${axes}</g>
    ${STATS.some(s => draft[s]) ? `<polygon class="hx-radar-draft" points="${poly(total)}"/>` : ""}
    <polygon class="hx-radar-shape" points="${poly(stats)}"/>
    <g class="hx-radar-dots">${dots}</g>
    <g class="hx-radar-labels">${labels}</g>
  </svg>`;
}

/* ─── La fenêtre ───────────────────────────────────────── */
export function openHero({ tab = "hero", slot = null, onChange } = {}) {
  const { sheet } = openSheet({ labelledBy: "tl-sheet-title" });
  sheet.classList.add("hx");
  const st = {
    tab: TABS.includes(tab) ? tab : "hero",
    drawer: null, sel: null, back: null, shopCat: "weapon", styleCat: "hair", draft: zero(),
    greet: pickLine(MERCHANT.greet, lang()), levelUp: null, first: true,
    fx: { stamp: false, power: 0, purse: false, panel: false, drawer: false, ribbon: true }
  };
  const resetFx = () => { st.fx = { stamp: false, power: 0, purse: false, panel: false, drawer: false, ribbon: false }; };
  const changed = () => { onChange?.(); syncProfileAvatar(); };

  // niveau gagné depuis la dernière visite : bannière, et le niveau est noté comme vu
  {
    const { rpg, ch } = rpgState();
    const seen = Number(rpg.seenLevel) || 1;
    if (seen < ch.level) {
      st.levelUp = { level: ch.level, pts: (ch.level - seen) * 5, choose: !!ch.cls.pending };
      saveRpg({ ...rpg, seenLevel: ch.level });
      onChange?.();
    }
  }

  /** Ouvre le sac d'un emplacement ; l'objet porté s'affiche d'abord dans la fiche */
  function openSlot(key) {
    const { ch } = rpgState();
    const look = currentLook();
    st.drawer = { slot: key };
    st.sel = null;
    st.back = `[data-hx-slot="${key}"]`;
    if (SLOTS.includes(key) && ch.gear[key]) st.sel = { kind: "gear", id: ch.gear[key].id };
    else if (key === "bg") st.sel = { kind: "bg", id: look.bg };
    else if (look[key] && cosmeticById(look[key])) st.sel = { kind: "look", id: look[key] };
  }
  if (slot) { openSlot(slot); st.fx.drawer = true; }

  /** Le marchand réagit à l'objet regardé */
  const merchantReacts = info => {
    const L = lang();
    if (info.owned) return;
    if (info.wheel) st.greet = pickLine(MERCHANT.wheel, L);
    else if (!info.usable) st.greet = pickLine(MERCHANT.locked, L);
    else if (!info.afford) st.greet = pickLine(MERCHANT.poor, L);
    else if (info.rarity.key === "legendary") st.greet = pickLine(MERCHANT.legendary, L);
  };

  /* ─── en-tête et onglets ─── */
  const header = () => {
    const t = T();
    const { wallet, ch } = rpgState();
    const dot = k => (k === "stats" && freePoints(ch) > 0) || (k === "path" && ch.cls.pending);
    return `
      <header class="hx-top">
        <div class="hx-titles">
          <p class="hx-kicker">${esc(t.kicker)}</p>
          <h2 id="tl-sheet-title" class="hx-title" tabindex="-1">${esc(t.title)}</h2>
        </div>
        <p class="hx-purse${st.fx.purse ? " is-bump" : ""}" aria-label="${esc(`${num(wallet.balance)} ${t.purse}`)}">${PS}<b>${num(wallet.balance)}</b></p>
        <button type="button" class="icon-btn hx-close" data-sheet-close aria-label="${esc(t.close)}">✕</button>
      </header>
      <nav class="hx-tabs" role="tablist" aria-label="${esc(t.title)}">
        ${TABS.map(k => `<button type="button" role="tab" class="hx-tab" id="hx-tab-${k}" aria-selected="${st.tab === k}" aria-controls="hx-panel" tabindex="${st.tab === k ? 0 : -1}" data-hx-tab="${k}">${svg(ICON[k])}<span>${esc(t.tabs[k])}</span>${dot(k) ? `<i class="hx-dot" aria-hidden="true"></i>` : ""}</button>`).join("")}
      </nav>`;
  };

  /* ─── la scène : le personnage entouré de ses emplacements ─── */
  const gearSlot = key => {
    const t = T();
    const { ch } = rpgState();
    const g = ch.gear[key];
    const open = st.drawer?.slot === key;
    if (!g) {
      return `<div class="hx-slot"><button type="button" class="hx-cell is-empty${open ? " is-selected" : ""}" data-hx-slot="${key}" aria-expanded="${open}" aria-label="${esc(`${t.slot[key]} : ${t.empty}`)}">
        <span class="hx-cell-art">${svg(ICON.ghost[key], "hx-ghost")}</span></button><span class="hx-slot-label">${esc(t.slot[key])}</span></div>`;
    }
    const info = itemInfo("gear", g.id);
    return `<div class="hx-slot"><button type="button" class="hx-cell r-${info.rarity.key}${g.active ? "" : " is-off"}${open ? " is-selected" : ""}" data-hx-slot="${key}" aria-expanded="${open}" aria-label="${esc(`${t.slot[key]} : ${info.name}`)}">
        <span class="hx-cell-art">${thumbHtml(info)}</span>${info.note ? `<span class="hx-skinmark" aria-hidden="true">${svg(ICON.look)}</span>` : ""}</button>
      <span class="hx-slot-label">${esc(t.slot[key])}</span></div>`;
  };
  const lookSlot = key => {
    const t = T();
    const look = currentLook();
    const open = st.drawer?.slot === key;
    const info = key === "bg" ? itemInfo("bg", look.bg) : look[key] && cosmeticById(look[key]) ? itemInfo("look", look[key]) : null;
    return `<div class="hx-slot"><button type="button" class="hx-cell${info ? ` r-${info.rarity.key}` : " is-empty"}${open ? " is-selected" : ""}" data-hx-slot="${key}" aria-expanded="${open}" aria-label="${esc(`${t.slot[key]} : ${info ? info.name : key === "companion" ? t.noneM : t.none}`)}">
      <span class="hx-cell-art">${info ? thumbHtml(info) : svg(ICON.ghost[key], "hx-ghost")}</span></button><span class="hx-slot-label">${esc(t.slot[key])}</span></div>`;
  };
  const stageHtml = mode => {
    const t = T();
    const L = lang();
    const { ch } = rpgState();
    // l'objet regardé dans le sac s'essaie sur le personnage
    const info = st.sel ? itemInfo(st.sel.kind, st.sel.id) : null;
    const trial = info && !info.worn ? tryOn(info) : null;
    const look = trial ? trial.look : currentLook();
    const sides = mode === "gear" ? [["weapon"], ["outfit", "accessory"]] : [["weaponSkin", "companion"], ["costume", "bg"]];
    const slotFn = mode === "gear" ? gearSlot : lookSlot;
    return `
      <section class="hx-stage" style="--hx-class:${classColor(ch)}">
        <div class="hx-col">${sides[0].map(slotFn).join("")}</div>
        <div class="hx-scene" style="background:${bgCss(bgOf(look.bg))}">
          <span class="hx-aura" aria-hidden="true"></span>
          <span class="hx-motes" aria-hidden="true">${"<i></i>".repeat(6)}</span>
          <span class="hx-floor" aria-hidden="true"></span>
          <div class="hx-doll">${figureSvg(look, { view: "full", size: 190, frame: false, gear: trial ? trial.gear : wornGear(), label: trial ? `${t.preview} : ${info.name}` : className(ch.cls.id, L) })}</div>
          ${trial ? `<span class="hx-preview-chip">${esc(t.preview)}</span>` : ""}
        </div>
        <div class="hx-col">${sides[1].map(slotFn).join("")}</div>
      </section>`;
  };
  const powerHtml = ch => {
    const t = T();
    const power = powerOf(ch);
    const d = st.fx.power;
    return `<p class="hx-power" aria-label="${esc(`${t.power} ${num(power)}`)}">${svg(ICON.bolt)}<b>${num(power)}</b><small>${esc(t.power)}</small>${d ? `<em class="hx-delta${d > 0 ? "" : " is-down"}" aria-hidden="true">${d > 0 ? "+" : "−"}${num(Math.abs(d))}</em>` : ""}</p>`;
  };

  /* ─── onglet Héros ─── */
  const heroTab = () => {
    const t = T();
    const L = lang();
    const { ch } = rpgState();
    const color = classColor(ch);
    const name = Social.username || "";
    const pct = Math.round(ch.progress * 100);
    const free = freePoints(ch);
    const bonus = STATS.filter(s => ch.gearBonus[s]);
    const ribbon = st.levelUp ? `
      <div class="hx-levelup${st.fx.ribbon ? " is-pop" : ""}" role="status">
        <b>${esc(fill(t.levelUp, { n: st.levelUp.level }))}</b>
        <span>${esc(st.levelUp.choose ? t.levelUpChoose : fill(t.levelUpSub, { pts: st.levelUp.pts }))}</span>
      </div>` : "";
    const cta = ch.cls.pending
      ? `<div class="hx-cta" style="--hx-class:${color}"><p>${esc(fill(t.chooseCta, { n: ch.level }))}</p><button type="button" class="btn btn-primary btn-sm" data-hx-choose>${esc(t.choose)}</button></div>`
      : free > 0 ? `<div class="hx-cta"><p><b class="hx-gem">${free}</b> ${esc(free === 1 ? t.toPlaceOne : t.toPlace)}</p><button type="button" class="btn btn-primary btn-sm" data-hx-tab="stats">${esc(t.place)}</button></div>` : "";
    return `
      ${ribbon}
      <section class="hx-frame hx-id" style="--hx-class:${color}">
        <div class="hx-crest">${emblemSvg(ch.cls.id, { size: 62, title: className(ch.cls.id, L) })}<span class="hx-lv" aria-hidden="true">${ch.level}</span></div>
        <div class="hx-id-text">
          ${name ? `<p class="hx-name">${esc(name)}</p>` : ""}
          <p class="hx-class">${esc(className(ch.cls.id, L))} <span>· ${esc(fill(t.level, { n: ch.level }))}</span></p>
          <div class="hx-xp" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${esc(fill(t.level, { n: ch.level + 1 }))}"><i style="width:${pct}%"></i></div>
          <p class="hx-xp-text">${esc(ch.maxed ? t.xpMax : fill(t.xpNext, { have: num(ch.xp - ch.levelStart), need: num(ch.levelNext - ch.levelStart), n: ch.level + 1 }))}</p>
        </div>
        ${powerHtml(ch)}
      </section>
      ${cta}
      ${stageHtml("gear")}
      <p class="hx-hint">${esc(t.hint)}</p>
      <section class="hx-frame">
        <h3 class="hx-h">${esc(t.gearBonus)}</h3>
        <div class="hx-pills">${bonus.length
          ? bonus.map(s => `<span class="hx-pill" style="--s:${STAT_COLORS[s]}">${statIcon(s, 15)}+${ch.gearBonus[s]} ${esc(statAbbr(s))}</span>`).join("")
          : `<span class="hx-muted">${esc(t.noGear)}</span>`}</div>
      </section>`;
  };

  /* ─── onglet Stats ─── */
  const statsTab = () => {
    const t = T();
    const L = lang();
    const { rpg, ch } = rpgState();
    const pending = STATS.reduce((n, s) => n + st.draft[s], 0);
    const left = ch.points.free - pending;
    const canAdd = !ch.cls.pending && left > 0;
    const msg = ch.points.free < 0 ? fill(t.over, { n: -ch.points.free }) : ch.cls.pending && ch.points.free > 0 ? t.blocked : ch.points.free > 0 ? "" : t.noPoints;
    const rows = STATS.map(s => `
      <li class="hx-stat" style="--s:${STAT_COLORS[s]}">
        <span class="hx-medal">${statIcon(s, 22)}</span>
        <span class="hx-stat-text"><b>${esc(statName(s))}</b> <small>${esc(statAbbr(s))}</small>
          <small class="hx-stat-detail">${esc(fill(t.breakdown, { base: 5, mine: ch.alloc[s] + st.draft[s], cls: ch.classBonus[s], gear: ch.gearBonus[s] }))}</small></span>
        <b class="hx-stat-value${st.draft[s] ? " is-up" : ""}">${ch.stats[s] + st.draft[s]}${st.draft[s] ? `<small>+${st.draft[s]}</small>` : ""}</b>
        <span class="hx-steps">
          ${st.draft[s] ? `<button type="button" class="hx-step" data-hx-minus="${s}" aria-label="${esc(fill(t.remove, { name: statName(s) }))}">−</button>` : ""}
          <button type="button" class="hx-step is-plus" data-hx-plus="${s}" aria-label="${esc(fill(t.add, { name: statName(s) }))}"${canAdd ? "" : " disabled"}>+</button>
        </span>
      </li>`).join("");
    const preview = character({ xp: ch.xp, rpg: { ...rpg, alloc: Object.fromEntries(STATS.map(s => [s, ch.alloc[s] + st.draft[s]])) }, owned: ownsGear }).attrs;
    const attrs = Object.entries(ATTR_INFO).map(([k, info]) => `<div class="hx-attr${preview[k] !== ch.attrs[k] ? " is-up" : ""}"><span>${esc(info[L])}</span><b>${num(preview[k])}${info.unit || ""}</b></div>`).join("");
    return `
      <section class="hx-frame hx-build" style="--hx-class:${classColor(ch)}">
        ${radarSvg(ch.stats, st.draft, classColor(ch))}
        <div class="hx-build-side">
          <p class="hx-gem-big${left > 0 && !ch.cls.pending ? " is-lit" : ""}"><b>${Math.max(0, left)}</b><span>${esc(left === 1 ? t.toPlaceOne : t.toPlace)}</span></p>
          ${powerHtml(ch)}
          ${ch.points.used ? `<button type="button" class="hero-other" data-hx-reset>${esc(t.reset)}</button>` : ""}
        </div>
      </section>
      ${msg ? `<p class="hx-hint">${esc(msg)}</p>` : ""}
      <section class="hx-frame">
        <ul class="hx-stats">${rows}</ul>
      </section>
      <section class="hx-frame">
        <h3 class="hx-h">${esc(t.attrs)}</h3>
        <div class="hx-attrs">${attrs}</div>
      </section>
      ${pending ? `<div class="hx-dock"><button type="button" class="btn btn-surface" data-hx-cancel>${esc(t.cancel)}</button><button type="button" class="btn btn-primary" data-hx-save>${esc(fill(t.validate, { n: pending }))}</button></div>` : ""}`;
  };

  /* ─── onglet Apparence ─── */
  const mirror = () => {
    const t = T();
    const look = currentLook();
    const cats = ["hair", "eyes", "mouth", "skin", "dyes"];
    const chips = `<div class="hx-chips" role="radiogroup" aria-label="${esc(t.mirror)}">${cats.map(c => `<button type="button" role="radio" class="hx-chip" aria-checked="${st.styleCat === c}" data-hx-style="${c}">${esc(t.styleCats[c])}</button>`).join("")}</div>`;
    let body;
    if (["hair", "eyes", "mouth"].includes(st.styleCat)) {
      const key = st.styleCat;
      body = `<div class="hx-faces">${FACE_OPTIONS[key].map((opt, i) => `<button type="button" class="hx-face${look[key] === opt ? " is-on" : ""}" data-hx-face="${key}|${opt}" aria-pressed="${look[key] === opt}" aria-label="${esc(`${t.styleCats[key]} ${i + 1}`)}">${figureSvg({ ...look, [key]: opt }, { view: key === "hair" ? "head" : "face", size: 72 })}</button>`).join("")}</div>`;
    } else if (st.styleCat === "skin") {
      body = `<div class="hx-colors">${SKINS.map(c => `<button type="button" class="hx-color${look.skin === c.id ? " is-on" : ""}" style="--c:${c.color}" data-hx-skin="${c.id}" aria-pressed="${look.skin === c.id}" aria-label="${esc(cap(i18n.t(`avatarParts.skin.${c.id}`)))}"></button>`).join("")}</div>`;
    } else {
      const row = (title, part, list) => `<h4 class="hx-sub">${esc(title)}</h4><div class="hx-colors">${list.map(c => {
        const info = itemInfo("dye", `${part}:${c.id}`);
        const attr = info.owned ? `data-hx-dye="${part}:${c.id}"` : `data-hx-pick="dye|${part}:${c.id}"`;
        return `<button type="button" class="hx-color${info.worn ? " is-on" : ""}${info.owned ? "" : " is-locked"}" style="--c:${c.color}" ${attr} aria-pressed="${info.worn}" aria-label="${esc(info.owned ? info.name : `${info.name}, ${num(info.price)} ${t.purse}`)}">${info.owned ? "" : `<small>${PS}${num(info.price)}</small>`}</button>`;
      }).join("")}</div>`;
      body = row(t.hairDyes, "hair", HAIR_COLORS) + row(t.eyeDyes, "eyes", EYE_COLORS);
    }
    return `
      <section class="hx-frame">
        <div class="hx-h-row"><h3 class="hx-h">${esc(t.mirror)}</h3><button type="button" class="hx-dice" data-hx-random>${svg(ICON.dice)}<span>${esc(t.random)}</span></button></div>
        ${chips}${body}
      </section>`;
  };
  const lookTab = () => `${stageHtml("look")}<p class="hx-hint">${esc(T().lookHint)}</p>${mirror()}`;

  /* ─── onglet Boutique : le Comptoir de la Fonte ─── */
  const shopItems = cat => {
    const { ch } = rpgState();
    if (SLOTS.includes(cat)) return gearFor(cat, ch.cls).map(id => itemInfo("gear", id));
    if (cat === "skins") return COSMETICS.map(c => itemInfo("look", c.id));
    if (cat === "bg") return COSMETIC_BACKGROUNDS.map(b => itemInfo("bg", b.id));
    return [...HAIR_COLORS.map(c => itemInfo("dye", `hair:${c.id}`)), ...EYE_COLORS.map(c => itemInfo("dye", `eyes:${c.id}`))].filter(i => i.price);
  };
  /** Bannière de la Roue des cadeaux (et bons de réduction en cours) */
  const wheelBanner = () => {
    const t = T();
    const { spins, coupons } = wheelState();
    const list = [...new Set(coupons.map(c => c.pct))].map(p => `−${p} %`).join(", ");
    return `
      <button type="button" class="gw-banner${spins ? " is-lit" : ""}" data-hx-wheel>
        <svg class="gw-banner-wheel" viewBox="-12 -12 24 24" aria-hidden="true" focusable="false"><circle r="10.5"/><path d="M0-10.5V10.5M-10.5 0H10.5M-7.4-7.4L7.4 7.4M7.4-7.4L-7.4 7.4"/><circle r="2.6" class="gw-banner-hub"/></svg>
        <span><b>${esc(t.wheelTitle)}</b><small>${esc(spins === 1 ? t.wheelSpinsOne : spins ? fill(t.wheelSpins, { n: spins }) : t.wheelNoSpin)}</small></span>
        ${spins ? `<i class="gw-banner-count" aria-hidden="true">${spins}</i>` : ""}
      </button>
      ${list ? `<p class="hx-hint">${esc(fill(t.couponsList, { list }))}</p>` : ""}`;
  };
  const shopTab = () => {
    const t = T();
    const cats = ["weapon", "outfit", "accessory", "skins", "bg", "dyes"];
    return `
      <section class="hx-merchant">
        <img class="hx-npc" src="${MASCOT}" alt="" width="62" height="162" decoding="async">
        <div class="hx-bubble"><p class="hx-npc-name">${esc(t.merchant)} · ${esc(t.shopName)}</p><p class="hx-say">${esc(st.greet)}</p></div>
      </section>
      ${wheelBanner()}
      <div class="hx-chips hx-cats" role="radiogroup" aria-label="${esc(t.shopName)}">${cats.map(c => `<button type="button" role="radio" class="hx-chip" aria-checked="${st.shopCat === c}" data-hx-cat="${c}">${esc(t.cats[c])}</button>`).join("")}</div>
      <ul class="hx-grid">${shopItems(st.shopCat).map(info => itemHtml(info, st.sel)).join("")}</ul>`;
  };

  /* ─── onglet Voie ─── */
  const pathTab = () => {
    const t = T();
    const L = lang();
    const { ch } = rpgState();
    const cls = CLASSES[ch.cls.id];
    const steps = [
      ...ch.cls.chain.map((id, i) => `<li class="hx-path-step${id === ch.cls.id ? " is-now" : " is-done"}" style="--hx-class:${BRANCH_COLORS[CLASSES[id].branch || "novice"]}">${emblemSvg(id, { size: 50 })}<b>${esc(className(id, L))}</b><small>${esc(fill(t.atLevel, { n: i === 0 ? 1 : GATES[i - 1] }))}</small></li>`),
      ...upcoming(ch.cls.id).map(step => step.id
        ? `<li class="hx-path-step is-next">${emblemSvg(step.id, { size: 50 })}<b>${esc(className(step.id, L))}</b><small>${esc(fill(t.atLevel, { n: step.level }))}</small></li>`
        : `<li class="hx-path-step is-next"><span class="hx-qmark" aria-hidden="true">?</span><b>${esc(step.options.map(o => className(o, L)).join(" / "))}</b><small>${esc(fill(t.choiceAt, { n: step.level }))}</small></li>`)
    ].join("");
    return `
      <section class="hx-frame hx-class-card" style="--hx-class:${classColor(ch)}">
        <div class="hx-class-head">${emblemSvg(ch.cls.id, { size: 84, title: className(ch.cls.id, L) })}
          <div><p class="hx-kicker">${esc(t.pathNow)} · ${esc(fill(t.rank, { n: cls.tier }))}</p><p class="hx-class-name">${esc(className(ch.cls.id, L))}</p>
          ${cls.main.length ? `<p class="hx-muted">${esc(fill(t.strengthens, { list: cls.main.map(statName).join(", ") }))}</p>` : ""}</div></div>
        <blockquote class="hx-lore">${esc(loreText(BRANCH_LORE[cls.branch || "novice"], L))}</blockquote>
        ${cls.focus ? `<p class="hx-text">${esc(cls.focus[L])}</p>` : ""}
        ${cls.ref ? `<p class="hx-muted">${esc(fill(t.style, { ref: cls.ref }))}</p>` : ""}
        ${ch.cls.pending ? `<button type="button" class="btn btn-primary btn-block" data-hx-choose>${esc(fill(t.chooseCta, { n: ch.level }))}</button>` : ""}
      </section>
      <section class="hx-frame">
        <h3 class="hx-h">${esc(t.evolutions)}</h3>
        <ol class="hx-path">${steps}</ol>
        ${cls.tier > 0 ? `<button type="button" class="hero-other hx-change" data-hx-change>${esc(fill(t.change, { price: CLASS_CHANGE_PRICE }))}</button>` : ""}
      </section>
      <section class="hx-frame">
        <h3 class="hx-h">${esc(t.earn)}</h3>
        <p class="hx-text">${esc(t.earnText)}</p>
      </section>`;
  };

  /* ─── fiche d'un objet ─── */
  const cardHtml = info => {
    const t = T();
    const L = lang();
    const { wallet, ch } = rpgState();
    // bonus comparés à l'objet porté dans le même emplacement
    let bonusHtml = "";
    if (info.bonus) {
      const cur = ch.gear[info.slot];
      const vs = cur && cur.active && cur.id !== info.id ? cur : null;
      const other = vs ? vs.item.bonus : {};
      const keys = [...new Set([...Object.keys(info.bonus), ...Object.keys(other)])];
      bonusHtml = `${vs ? `<p class="hx-vs">${esc(fill(t.vs, { name: gearName(vs.id, L) }))}</p>` : ""}
        <ul class="hx-bonus">${keys.map(s => {
          const mine = info.bonus[s] || 0;
          const diff = mine - (other[s] || 0);
          return `<li style="--s:${STAT_COLORS[s]}"${mine ? "" : ` class="is-gone"`}>${statIcon(s, 16)}<b>+${mine} ${esc(statAbbr(s))}</b>${vs && diff ? `<em class="${diff > 0 ? "is-up" : "is-down"}">${diff > 0 ? "▲" : "▼"} ${Math.abs(diff)}</em>` : ""}</li>`;
        }).join("")}</ul>`;
    }
    const req = info.req ? `<ul class="hx-req">${info.req.map(r => `<li class="${r.ok ? "is-ok" : "is-missing"}">${svg(r.ok ? ICON.check : ICON.lock)}${esc(r.text)}</li>`).join("")}</ul>` : "";
    let actions;
    if (info.owned) {
      if (info.kind === "dye" || info.kind === "bg") actions = info.worn ? `<p class="hx-state">${svg(ICON.check)}${esc(t.inUse)}</p>` : `<button type="button" class="btn btn-primary btn-block" data-hx-act="use">${esc(t.apply)}</button>`;
      else if (info.worn) actions = `<button type="button" class="btn btn-surface btn-block" data-hx-act="unequip">${esc(t.unequip)}</button>`;
      else actions = info.usable ? `<button type="button" class="btn btn-primary btn-block" data-hx-act="equip">${esc(t.equip)}</button>` : `<p class="hx-state is-missing">${esc(info.reason)}</p>`;
    } else if (info.wheel) {
      actions = `<p class="hx-state">${esc(t.wheelOnly)}</p><button type="button" class="btn btn-surface btn-block hx-wheel-btn" data-hx-wheel>${esc(t.openWheel)}</button>`;
    } else if (!info.usable) {
      actions = `<p class="hx-state is-missing">${svg(ICON.lock)}${esc(info.reason)}</p>`;
    } else {
      // bons de réduction gagnés à la roue : on choisit d'en utiliser un (ou non)
      const coupons = [...new Map(wheelState().coupons.map(c => [c.pct, c])).values()];
      const coupon = coupons.find(c => c.id === st.coupon) || null;
      const pay = discounted(info.price, coupon);
      const chips = info.price && coupons.length ? `
        <div class="hx-coupons" role="group" aria-label="${esc(t.coupons)}"><span>${esc(t.coupons)}</span>
          <button type="button" class="hx-coupon" data-hx-coupon="" aria-pressed="${!coupon}">${esc(t.couponNone)}</button>
          ${coupons.map(c => `<button type="button" class="hx-coupon" data-hx-coupon="${esc(c.id)}" aria-pressed="${coupon?.id === c.id}">−${c.pct} %</button>`).join("")}
        </div>` : "";
      actions = wallet.balance < pay
        ? `${chips}<p class="hx-state is-missing">${esc(fill(t.missing, { n: num(pay - wallet.balance) }))}</p>`
        : `${chips}<button type="button" class="btn btn-primary btn-block hx-buy" data-hx-act="buy">${esc(t.buy)}<span>${coupon ? `<s>${num(info.price)}</s>` : ""}${PS}${num(pay)}</span></button>`;
    }
    // dans la boutique, pas de scène : l'essayage se fait dans la fiche
    const trial = st.tab === "shop" ? tryOn(info) : null;
    const trialHtml = trial ? `<figure class="hx-trial"><div class="hx-trial-pic">${figureSvg(trial.look, { view: trial.view || "full", size: 74, frame: true, gear: trial.gear })}</div><figcaption>${esc(t.tryOn)}</figcaption></figure>` : "";
    return `
      <article class="hx-card r-${info.rarity.key}" aria-labelledby="hx-card-name">
        <div class="hx-card-top">
          <div class="hx-card-art r-${info.rarity.key}">${thumbHtml(info)}${shine(info)}${st.fx.stamp ? `${burst()}<span class="hx-stamp">${esc(t.obtained)}</span>` : ""}</div>
          <div class="hx-card-id">
            <span class="hx-rchip r-${info.rarity.key}">${esc(rarityName(info.rarity))}</span>
            <h3 id="hx-card-name" class="hx-card-name r-${info.rarity.key}" tabindex="-1">${esc(info.name)}</h3>
            <p class="hx-muted">${esc(info.type)}</p>
          </div>
          ${trialHtml}
        </div>
        ${bonusHtml}${req}
        ${info.note ? `<p class="hx-note">${esc(info.note)}</p>` : ""}
        ${info.lore ? `<blockquote class="hx-lore">${esc(info.lore)}</blockquote>` : ""}
        <div class="hx-card-actions">${actions}</div>
      </article>`;
  };

  /* ─── sac : les objets d'un emplacement ─── */
  const bagHtml = key => {
    const t = T();
    const { ch } = rpgState();
    const look = currentLook();
    let list;
    if (SLOTS.includes(key)) list = gearFor(key, ch.cls).map(id => itemInfo("gear", id));
    else if (key === "bg") list = COSMETIC_BACKGROUNDS.map(b => itemInfo("bg", b.id));
    else list = COSMETICS.filter(c => c.slot === key).map(c => itemInfo("look", c.id));
    const mine = list.filter(i => i.owned);
    const others = list.filter(i => !i.owned);
    const grid = items => `<ul class="hx-grid is-bag">${items.map(info => itemHtml(info, st.sel)).join("")}</ul>`;
    const canClear = (SLOTS.includes(key) && ch.gear[key]) || (["costume", "weaponSkin", "companion"].includes(key) && look[key]);
    return `
      <div class="hx-bag-head"><h3 class="hx-h">${esc(t.slot[key])}</h3>${canClear ? `<button type="button" class="hero-other" data-hx-act="clear">${esc(t.unequip)}</button>` : ""}</div>
      ${key === "companion" ? `<p class="hx-hint">${esc(t.companionSoon)}</p>` : ""}
      ${mine.length ? `<h4 class="hx-sub">${esc(t.inBag)}</h4>${grid(mine)}` : key !== "companion" ? `<p class="hx-hint">${esc(t.bagEmpty)}</p>` : ""}
      ${others.length ? `<h4 class="hx-sub">${esc(t.atMerchant)}</h4>${grid(others)}` : ""}`;
  };

  const drawerHtml = () => {
    if (!st.drawer && !st.sel) return "";
    const t = T();
    const info = st.sel ? itemInfo(st.sel.kind, st.sel.id) : null;
    return `
      <section class="hx-drawer${st.fx.drawer ? " is-in" : ""}" aria-label="${esc(info ? info.name : t.slot[st.drawer.slot])}">
        <div class="hx-drawer-bar"><span class="hx-grip" aria-hidden="true"></span><button type="button" class="icon-btn hx-drawer-close" data-hx-shut aria-label="${esc(t.close)}">✕</button></div>
        <div class="hx-drawer-body">
          ${info ? cardHtml(info) : ""}
          ${st.drawer ? bagHtml(st.drawer.slot) : ""}
        </div>
      </section>`;
  };

  /* ─── dessin ─── */
  const PANELS = { hero: heroTab, stats: statsTab, look: lookTab, shop: shopTab, path: pathTab };
  const draw = ({ focus = null, scroll = "keep" } = {}) => {
    const top = sheet.scrollTop;
    const bagTop = sheet.querySelector(".hx-drawer-body")?.scrollTop || 0;
    sheet.innerHTML = `
      <div class="tl-sheet-inner hx-wrap">
        ${header()}
        <div class="hx-panel${st.fx.panel ? " is-in" : ""}" id="hx-panel" role="tabpanel" aria-labelledby="hx-tab-${st.tab}">${PANELS[st.tab]()}</div>
      </div>
      ${drawerHtml()}`;
    sheet.scrollTop = scroll === "top" ? 0 : top;
    const body = sheet.querySelector(".hx-drawer-body");
    if (body) body.scrollTop = focus === "card" ? 0 : bagTop;
    // le sac s'ouvre : le personnage reste visible au-dessus
    if (scroll === "stage") sheet.querySelector(".hx-stage")?.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
    if (st.first) { sheet.querySelector("#tl-sheet-title")?.focus({ preventScroll: true }); st.first = false; }
    else if (focus === "card") sheet.querySelector("#hx-card-name")?.focus({ preventScroll: true });
    else if (focus) sheet.querySelector(focus)?.focus({ preventScroll: true });
    // les petites animations ne se rejouent pas au dessin suivant
    resetFx();
  };

  const withPower = fn => {
    const before = powerOf(rpgState().ch);
    fn();
    st.fx.power = powerOf(rpgState().ch) - before;
  };
  const switchTab = key => {
    st.tab = key;
    st.drawer = null;
    st.sel = null;
    st.fx.panel = true;
    draw({ focus: `[data-hx-tab="${key}"]`, scroll: "top" });
  };
  const closeDrawer = () => {
    const back = st.back;
    st.drawer = null;
    st.sel = null;
    st.back = null;
    draw({ focus: back });
  };

  /* ─── actions sur un objet ─── */
  const act = what => {
    const t = T();
    const L = lang();
    if (what === "clear" && st.drawer) {
      const key = st.drawer.slot;
      if (SLOTS.includes(key)) withPower(() => saveRpg(equip(rpgState().rpg, key, null)));
      else saveLook({ [key]: null });
      st.sel = null;
      changed();
      draw({ focus: ".hx-drawer-close" });
      return;
    }
    const info = st.sel ? itemInfo(st.sel.kind, st.sel.id) : null;
    if (!info) return;
    if (what === "buy") {
      if (info.owned || !info.usable || info.wheel) return;
      const coupon = wheelState().coupons.find(c => c.id === st.coupon) || null;
      const pay = discounted(info.price, coupon);
      if (rpgState().wallet.balance < pay) return;
      const [part, color] = info.id.split(":");
      const tag = info.kind === "gear" ? gearTag(info.id) : info.kind === "dye" ? `${dyeKey(part)}:${color}` : lookTag(info.id);
      // un achat payé avec un bon garde l'identifiant du bon : il ne sert qu'une fois
      if (!DB.addPurchase({ id: tag, price: pay, at: Date.now(), ...(coupon ? { coupon: coupon.id } : {}) })) return;
      st.coupon = null;
      // emplacement vide (ou teinture, fond) : l'objet est porté tout de suite
      const { rpg } = rpgState();
      const look = currentLook();
      if (info.kind === "gear" && !rpg.gear?.[info.slot]) withPower(() => saveRpg(equip(rpg, info.slot, info.id)));
      if (info.kind === "look" && !look[info.slot]) saveLook({ [info.slot]: info.id });
      if (info.kind === "bg") saveLook({ bg: info.id });
      if (info.kind === "dye") { const [part, color] = info.id.split(":"); saveLook({ [dyeKey(part)]: color }); }
      st.fx.stamp = true;
      st.fx.purse = true;
      st.greet = pickLine(MERCHANT.bought, L);
      try { navigator.vibrate?.(12); } catch { /* pas de vibreur */ }
      showToast(fill(t.bought, { name: info.name }));
      changed();
      draw({ focus: "card" });
      return;
    }
    if (what === "equip") {
      if (info.kind === "gear") withPower(() => saveRpg(equip(rpgState().rpg, info.slot, info.id)));
      else saveLook({ [info.slot]: info.id });
      showToast(fill(t.equipped, { name: info.name }));
    } else if (what === "unequip") {
      if (info.kind === "gear") withPower(() => saveRpg(equip(rpgState().rpg, info.slot, null)));
      else saveLook({ [info.slot]: null });
    } else if (what === "use") {
      if (info.kind === "dye") { const [part, color] = info.id.split(":"); saveLook({ [dyeKey(part)]: color }); }
      else saveLook({ bg: info.id });
    }
    changed();
    draw({ focus: "card" });
  };

  /* ─── écoute ─── */
  sheet.addEventListener("click", async event => {
    const el = s => event.target.closest(s);
    const t = T();
    const tabBtn = el("[data-hx-tab]");
    if (tabBtn) { switchTab(tabBtn.dataset.hxTab); return; }
    if (el("[data-hx-shut]")) { closeDrawer(); return; }
    const slotBtn = el("[data-hx-slot]");
    if (slotBtn) {
      const key = slotBtn.dataset.hxSlot;
      if (st.drawer?.slot === key) { closeDrawer(); return; }
      const wasOpen = !!(st.drawer || st.sel);
      openSlot(key);
      st.fx.drawer = !wasOpen;
      draw({ focus: st.sel ? "card" : ".hx-drawer-close", scroll: wasOpen ? "keep" : "stage" });
      return;
    }
    const pick = el("[data-hx-pick]");
    if (pick) {
      const [kind, ...rest] = pick.dataset.hxPick.split("|");
      const id = rest.join("|");
      const wasOpen = !!(st.drawer || st.sel);
      st.sel = { kind, id };
      st.coupon = null;
      st.fx.drawer = !wasOpen;
      if (!st.drawer) st.back = `[data-hx-pick="${kind}|${id}"]`;
      if (st.tab === "shop") merchantReacts(itemInfo(kind, id));
      draw({ focus: "card" });
      return;
    }
    const actBtn = el("[data-hx-act]");
    if (actBtn) { act(actBtn.dataset.hxAct); return; }
    const couponBtn = el("[data-hx-coupon]");
    if (couponBtn) { st.coupon = couponBtn.dataset.hxCoupon || null; draw({ focus: `[data-hx-coupon="${couponBtn.dataset.hxCoupon}"]` }); return; }
    if (el("[data-hx-wheel]")) {
      const back = st.tab;
      openWheel({ onChange, onClose: () => openHero({ tab: back, onChange }) });
      return;
    }
    const cat = el("[data-hx-cat]");
    if (cat) {
      st.shopCat = cat.dataset.hxCat;
      st.sel = null;
      const { wallet } = rpgState();
      const prices = shopItems(st.shopCat).filter(i => !i.owned && i.usable && i.price).map(i => i.price);
      if (prices.length && wallet.balance < Math.min(...prices)) st.greet = pickLine(MERCHANT.poor, lang());
      draw({ focus: `[data-hx-cat="${st.shopCat}"]` });
      return;
    }
    const style = el("[data-hx-style]");
    if (style) { st.styleCat = style.dataset.hxStyle; draw({ focus: `[data-hx-style="${st.styleCat}"]` }); return; }
    const face = el("[data-hx-face]");
    if (face) { const [key, opt] = face.dataset.hxFace.split("|"); saveLook({ [key]: opt }); changed(); draw({ focus: `[data-hx-face="${key}|${opt}"]` }); return; }
    const skin = el("[data-hx-skin]");
    if (skin) { saveLook({ skin: skin.dataset.hxSkin }); changed(); draw({ focus: `[data-hx-skin="${skin.dataset.hxSkin}"]` }); return; }
    const dye = el("[data-hx-dye]");
    if (dye) {
      const [part, color] = dye.dataset.hxDye.split(":");
      saveLook({ [dyeKey(part)]: color });
      changed();
      draw({ focus: `[data-hx-dye="${part}:${color}"]` });
      return;
    }
    if (el("[data-hx-random]")) {
      const r = list => list[Math.floor(Math.random() * list.length)];
      const hairs = HAIR_COLORS.filter(c => Shop.owned("hairColor", c.id));
      saveLook({ hair: r(FACE_OPTIONS.hair), eyes: r(FACE_OPTIONS.eyes), mouth: r(FACE_OPTIONS.mouth), hairColor: r(hairs).id });
      changed();
      draw({ focus: "[data-hx-random]" });
      return;
    }
    const plus = el("[data-hx-plus]");
    const minus = el("[data-hx-minus]");
    if (plus || minus) {
      const s = plus ? plus.dataset.hxPlus : minus.dataset.hxMinus;
      const { ch } = rpgState();
      const used = STATS.reduce((n, k) => n + st.draft[k], 0);
      if (plus && !ch.cls.pending && used < ch.points.free) st.draft[s] += 1;
      if (minus && st.draft[s] > 0) st.draft[s] -= 1;
      // le bouton « − » disparaît à zéro : le focus revient sur « + »
      draw({ focus: minus && !st.draft[s] ? `[data-hx-plus="${s}"]` : `[data-hx-${plus ? "plus" : "minus"}="${s}"]` });
      return;
    }
    if (el("[data-hx-cancel]")) { st.draft = zero(); draw(); return; }
    if (el("[data-hx-save]")) {
      const { rpg, ch } = rpgState();
      withPower(() => { const next = allocate(rpg, st.draft, ch.points.free); if (next) saveRpg(next); });
      st.draft = zero();
      showToast(t.saved);
      changed();
      draw();
      return;
    }
    if (el("[data-hx-reset]")) {
      const ok = await confirmSheet({ title: t.resetTitle, text: t.resetText, confirmLabel: t.resetOk, danger: false });
      if (ok) { const { rpg } = rpgState(); saveRpg({ ...rpg, alloc: {} }); changed(); }
      openHero({ tab: "stats", onChange });
      return;
    }
    if (el("[data-hx-choose]")) { openClassChoice({ onChange }); return; }
    if (el("[data-hx-change]")) {
      const { wallet } = rpgState();
      if (wallet.balance < CLASS_CHANGE_PRICE) { showToast(fill(t.changeShort, { price: CLASS_CHANGE_PRICE })); return; }
      const ok = await confirmSheet({ title: t.changeTitle, text: fill(t.changeText, { price: CLASS_CHANGE_PRICE }), confirmLabel: fill(t.changeOk, { price: CLASS_CHANGE_PRICE }) });
      const fresh = rpgState();
      if (!ok || fresh.wallet.balance < CLASS_CHANGE_PRICE) { openHero({ tab: "path", onChange }); return; }
      DB.addPurchase({ id: `respec:${Date.now()}`, price: CLASS_CHANGE_PRICE, at: Date.now() });
      saveRpg(resetClass(fresh.rpg));
      changed();
      openClassChoice({ onChange });
    }
  });

  sheet.addEventListener("keydown", event => {
    // Échap ferme d'abord le sac, puis la fenêtre
    if (event.key === "Escape" && (st.drawer || st.sel)) { event.stopPropagation(); closeDrawer(); return; }
    // onglets au clavier : flèches gauche / droite
    if (!event.target.closest("[data-hx-tab]") || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const i = TABS.indexOf(st.tab) + (event.key === "ArrowRight" ? 1 : -1);
    switchTab(TABS[(i + TABS.length) % TABS.length]);
  });

  draw({ scroll: st.drawer ? "stage" : "top" });
}
