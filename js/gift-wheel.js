/* ═══════════════════════════════════════════════════════════
   Roue des cadeaux : un code cadeau donne des tours de roue.
   - Les codes se créent à la main dans la console Firebase :
     giftCodes/<CODE> { active: true, spins: 1 } ; l'appli peut lire un code
     qu'on connaît, jamais la liste des codes (firestore.rules).
   - Un code ne sert qu'une fois par compte.
   - Gains : costumes (25 % en tout, du moins rare au plus rare : Infini,
     Nuages rouges, Aura dorée), points spé (comptés aussi pour le niveau),
     bons de réduction pour la boutique, teinture offerte.
   Tout est noté dans la liste des achats (fusionnée entre appareils) :
     code:<CODE>  { spins }   code utilisé
     wheel:<id>   { gift }    un tour joué et son gain (gift.ps compte dans js/flames.js)
     un achat payé avec un bon porte coupon: <id du tour>
   ═══════════════════════════════════════════════════════════ */
import { firestore } from "./firebase-config.js?v=20261122c";
import { DB } from "./db.js?v=20261122c";
import { Shop } from "./shop.js?v=20261122c";
import { i18n } from "./i18n.js?v=20261122c";
import { cosmeticById, lookTag } from "./cosmetics.js?v=20261122c";
import { HAIR_COLORS, EYE_COLORS, priceOf } from "./avatar-parts.js?v=20261122c";
import { figureSvg, pieceUrl, thumbUrl } from "./avatar3.js?v=20261122c";
import { rarityByKey } from "./rpg-art.js?v=20261122c";
import { xpForLevel, MAX_LEVEL } from "./rpg.js?v=20261122c";
import { ownsLook, currentLook, wornGear, syncProfileAvatar } from "./avatar3-ui.js?v=20261122c";
import { openHero } from "./hero.js?v=20261122c";
import { openSheet, esc, reducedMotion } from "./potes-ui.js?v=20261122c";

/* ─── Les saisons : chacune a sa roue (100 parts en tout, la taille d'une case = sa chance) ───
   Dates en heure du téléphone. Une saison terminée : ses costumes ne se gagnent plus,
   ceux déjà gagnés restent ; les tours non joués servent à la saison suivante. */
// un lot déjà à soi (costume, teinture) rend seulement le prix d'un tour (js/flames.js DUP_REFUND)
const S2_START = new Date(2026, 10, 22, 0, 0, 0).getTime();
export const SEASONS = [
  {
    id: 1, ends: S2_START,
    until: { fr: "jusqu'au dimanche 22\u00a0novembre", en: "until Sunday 22 November", frShort: "jusqu'au dim. 22 nov.", enShort: "until Sun 22 Nov" },
    wheel: [
      { key: "ps50", kind: "ps", ps: 50, weight: 22, color: "#bee7b8" },
      { key: "infini", kind: "costume", item: "costume-infini", weight: 13 },
      { key: "coupon20", kind: "coupon", pct: 20, weight: 15, color: "#fbe39a" },
      { key: "ps100", kind: "ps", ps: 100, weight: 15, color: "#d3dcbc" },
      { key: "nuages", kind: "costume", item: "costume-nuages", weight: 8 },
      { key: "dye", kind: "dye", weight: 10, color: "#f8d0d6" },
      { key: "coupon40", kind: "coupon", pct: 40, weight: 8, color: "#ffd5b0" },
      { key: "aura", kind: "costume", item: "costume-aura", weight: 4 },
      { key: "ps250", kind: "ps", ps: 250, weight: 5, color: "#cde4ee" }
    ]
  },
  {
    id: 2, starts: S2_START,
    wheel: [
      { key: "ps50", kind: "ps", ps: 50, weight: 16, color: "#bee7b8" },
      { key: "bonnet", kind: "costume", item: "bonnet-heros", weight: 6 },
      { key: "bois", kind: "costume", item: "costume-heros-bois", weight: 13 },
      { key: "coupon20", kind: "coupon", pct: 20, weight: 15, color: "#fbe39a" },
      { key: "ps100", kind: "ps", ps: 100, weight: 10, color: "#d3dcbc" },
      { key: "lame", kind: "costume", item: "skin-lame-legende", weight: 5 },
      { key: "temps", kind: "costume", item: "costume-heros-temps", weight: 8 },
      { key: "dye", kind: "dye", weight: 10, color: "#f8d0d6" },
      { key: "coupon40", kind: "coupon", pct: 40, weight: 8, color: "#ffd5b0" },
      { key: "confrerie", kind: "costume", item: "costume-confrerie", weight: 4 },
      { key: "ps250", kind: "ps", ps: 250, weight: 5, color: "#cde4ee" }
    ]
  }
];
/** La saison en cours (null entre deux saisons) */
export const currentSeason = (now = Date.now()) => SEASONS.find(x => (!x.starts || now >= x.starts) && (!x.ends || now < x.ends)) || null;
export const wheelOpen = (now = Date.now()) => !!currentSeason(now);
/** Texte « jusqu'au… » de la saison en cours ("" si pas de date de fin) */
export const seasonUntil = (short = false) => { const u = currentSeason()?.until; return u ? u[(lang() === "en" ? "en" : "fr") + (short ? "Short" : "")] : ""; };
/** L'objet se gagne-t-il à la roue de la saison en cours ? */
export const inSeason = id => !!currentSeason()?.wheel.some(seg => seg.item === id);
// la roue affichée : celle de la saison en cours, sinon la dernière
const WHEEL = () => (currentSeason() || SEASONS[SEASONS.length - 1]).wheel;
const TOTAL = () => WHEEL().reduce((n, x) => n + x.weight, 0);
const MAX_SPINS = 10;
/** Prix d'un tour acheté avec les points spé (en plus des codes cadeaux) */
export const SPIN_PRICE = 70;

const TEXT = {
  fr: {
    kicker: "Comptoir de la Fonte", title: "Roue des cadeaux", close: "Fermer",
    closedTitle: "La roue est partie", closedText: "Cette collection est terminée : une nouvelle arrive bientôt au Comptoir. Tes costumes et tes bons restent à toi.",
    kept: "Tes {n} tours sont gardés pour la prochaine collection.", keptOne: "Ton tour est gardé pour la prochaine collection.",
    codeLabel: "Code cadeau", codeHolder: "Ex. : FONTE-2026", validate: "Valider", checking: "Vérification…",
    ok: "Code accepté : +{n} tours de roue !", okOne: "Code accepté : +1 tour de roue !",
    okAdjust: "Compte réglé : niveau {level}, {n} points spé.", okAdjustPs: "Compte réglé : {n} points spé.",
    dupFreeName: "Déjà à toi",
    days: "Ta flamme est réparée : {n} jours de pesée remis.", daysOne: "Ta flamme est réparée : 1 jour de pesée remis.",
    errors: {
      format: "Ce code n'a pas la bonne forme : lettres, chiffres et tirets seulement.",
      used: "Tu as déjà utilisé ce code.",
      unknown: "Code inconnu. Vérifie l'orthographe.",
      expired: "Ce code a expiré.",
      wait: "Trop d'essais : attends une minute.",
      network: "Pas de réseau : réessaie dans un instant.",
      closed: "Les codes cadeaux ne sont pas encore ouverts.",
      save: "Impossible d'enregistrer pour l'instant, réessaie."
    },
    spins: "{n} tours à jouer", spinsOne: "1 tour à jouer", spinsNone: "Aucun tour : entre un code ou achète un tour.", buySpin: "Acheter un tour", buyShort: "Il te manque {n} points spé pour un tour.",
    spin: "Tourner la roue", spinning: "La roue tourne…", again: "Tourner encore",
    win: "Tu gagnes", odds: "Chances de gain",
    seg: { ps: "+{n} points spé", coupon: "Bon de réduction −{n} %", dye: "Teinture offerte" },
    detail: {
      costume: "Nouveau costume ! Il t'attend dans Mon héros › Apparence.",
      costumeDup: "Déjà à toi : le marchand te rend le prix du tour ({n} points spé).", costumeDupFree: "Déjà à toi : pas de doublon, ce tour était offert.", dyeDupFree: "Tu as déjà toutes les teintures : ce tour offert ne donne rien de plus.",
      ps: "Ajoutés à ta réserve, et ils comptent pour ton niveau.",
      coupon: "À utiliser au moment d'acheter à la Boutique.",
      dye: "À toi dans Mon héros › Apparence › Teintures.",
      dyeDup: "Tu as déjà toutes les teintures : le prix du tour t'est rendu ({n} points spé)."
    },
    see: { costume: "Essayer mon costume", dye: "Voir ma teinture", coupon: "Aller à la Boutique", ps: "Voir mon héros" },
    costumeShare: "Costumes"
  },
  en: {
    kicker: "The Iron Counter", title: "Gift wheel", close: "Close",
    closedTitle: "The wheel is gone", closedText: "This collection is over: a new one is coming soon to the Counter. Your costumes and coupons stay yours.",
    kept: "Your {n} spins are kept for the next collection.", keptOne: "Your spin is kept for the next collection.",
    codeLabel: "Gift code", codeHolder: "E.g. IRON-2026", validate: "Confirm", checking: "Checking…",
    ok: "Code accepted: +{n} wheel spins!", okOne: "Code accepted: +1 wheel spin!",
    okAdjust: "Account set: level {level}, {n} spec points.", okAdjustPs: "Account set: {n} spec points.",
    dupFreeName: "Already yours",
    days: "Your streak is repaired: {n} weigh-in days restored.", daysOne: "Your streak is repaired: 1 weigh-in day restored.",
    errors: {
      format: "This code doesn't look right: letters, digits and dashes only.",
      used: "You have already used this code.",
      unknown: "Unknown code. Check the spelling.",
      expired: "This code has expired.",
      wait: "Too many tries: wait a minute.",
      network: "No connection: try again in a moment.",
      closed: "Gift codes are not open yet.",
      save: "Can't save right now, try again."
    },
    spins: "{n} spins to play", spinsOne: "1 spin to play", spinsNone: "No spins: enter a code or buy a spin.", buySpin: "Buy a spin", buyShort: "You need {n} more spec points for a spin.",
    spin: "Spin the wheel", spinning: "The wheel is spinning…", again: "Spin again",
    win: "You win", odds: "Odds",
    seg: { ps: "+{n} spec points", coupon: "−{n} % voucher", dye: "Free dye" },
    detail: {
      costume: "New costume! It's waiting in My hero › Look.",
      costumeDup: "Already yours: the merchant gives back the spin price ({n} spec points).", costumeDupFree: "Already yours: no duplicate, this spin was free.", dyeDupFree: "You already have every dye: this free spin gives nothing more.",
      ps: "Added to your reserve, and they count for your level.",
      coupon: "Use it when buying at the Shop.",
      dye: "Yours in My hero › Look › Dyes.",
      dyeDup: "You already have every dye: the spin price is given back ({n} spec points)."
    },
    see: { costume: "Try my costume", dye: "See my dye", coupon: "Go to the Shop", ps: "See my hero" },
    costumeShare: "Costumes"
  }
};
const lang = () => (i18n.getLanguage() === "en" ? "en" : "fr");
const T = () => TEXT[lang()];
const fill = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const num = n => Number(n).toLocaleString(i18n.getLocale(), { maximumFractionDigits: 1 });
const randomInt = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;

/* ─── État : tours, bons ─────────────────────────────── */
const codeTag = code => `code:${code}`;
export function wheelState() {
  const list = DB.getPurchases();
  // tours gagnés : codes cadeaux, et tours achetés (spin:<id>, 1 tour chacun)
  const won = list.filter(p => String(p.id).startsWith("code:") || String(p.id).startsWith("spin:")).reduce((n, p) => n + Math.max(0, Math.min(MAX_SPINS, Math.floor(Number(p.spins) || 0))), 0);
  const played = list.filter(p => String(p.id).startsWith("wheel:"));
  const used = new Set(list.map(p => p.coupon).filter(Boolean));
  const coupons = played
    .filter(p => p.gift?.kind === "coupon" && !used.has(p.id))
    .map(p => ({ id: p.id, pct: Math.floor(Number(p.gift.pct) || 0) }))
    .filter(c => c.pct > 0 && c.pct < 100)
    .sort((a, b) => b.pct - a.pct);
  return { spins: Math.max(0, won - played.length), coupons };
}
/** Prix après un bon de réduction (arrondi au point près) */
export const discounted = (price, coupon) => (coupon ? Math.max(0, Math.round((price * (100 - coupon.pct)) / 100)) : price);

/* ─── Codes ──────────────────────────────────────────── */
export const normalizeCode = raw => String(raw || "").toUpperCase().replace(/\s+/g, "");
const CODE_RE = /^[A-Z0-9-]{3,32}$/;
/** Codes intégrés à l'appli : ils marchent même sans document dans la console */
const BUILT_IN = { TRACKLIFT10: { active: true, spins: 1 } };
let fails = [];
/** Vérifie un code et donne ses tours ; renvoie { ok, spins } ou { ok: false, reason } */
export async function redeemCode(raw) {
  const code = normalizeCode(raw);
  if (!CODE_RE.test(code)) return { ok: false, reason: "format" };
  if (DB.getPurchases().some(p => p.id === codeTag(code))) return { ok: false, reason: "used" };
  const now = Date.now();
  fails = fails.filter(t => now - t < 60000);
  if (fails.length >= 5) return { ok: false, reason: "wait" };
  // le code est cherché en majuscules, puis tel qu'il a pu être créé en minuscules dans la console ;
  // un code intégré à l'appli marche sans la console (un document du même nom le remplace)
  let data = null;
  try {
    for (const id of new Set([code, code.toLowerCase()])) {
      const snap = await firestore.doc(`giftCodes/${id}`).get();
      if (snap.exists) { data = snap.data() || {}; break; }
    }
  } catch (err) {
    if (!BUILT_IN[code]) return { ok: false, reason: err?.code === "permission-denied" ? "closed" : "network" };
  }
  if (!data) data = BUILT_IN[code] || null;
  if (!data) { fails.push(now); return { ok: false, reason: "unknown" }; }
  // code réservé à un seul compte : pour les autres, il n'existe pas
  if (data.uid && data.uid !== DB.currentUserId) { fails.push(now); return { ok: false, reason: "unknown" }; }
  if (data.active === false) return { ok: false, reason: "expired" };
  // réglage d'un compte (réservé à un seul compte : uid) : { level, balance } → niveau et réserve de points spé visés
  const adjusting = !!data.uid && (data.level != null || data.balance != null);
  const spins = adjusting && !Number(data.spins) ? 0 : Math.max(1, Math.min(MAX_SPINS, Math.floor(Number(data.spins) || 1)));
  let adjust = null;
  let target = null;
  if (adjusting) {
    const w = Shop.wallet();
    const level = data.level != null ? Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number(data.level) || 1))) : null;
    const earned = level ? xpForLevel(level) : w.earned;
    const balance = data.balance != null ? Math.max(0, Math.floor(Number(data.balance) || 0)) : Math.max(0, w.earned - w.spent);
    adjust = { earned: earned - w.earned, spent: earned - balance - w.spent };
    target = { level: level || null, balance };
  }
  if (!DB.addPurchase({ id: codeTag(code), price: 0, at: now, spins, ...(adjust ? { adjust } : {}) })) return { ok: false, reason: DB.getData() ? "used" : "save" };
  if (target) return { ok: true, spins, adjusted: target, days: 0 };
  // geste commercial : les jours de pesée perdus sont remis (une seule fois, le code est marqué utilisé)
  const days = data.uid && data.fillFrom && data.fillTo ? DB.fillMissingDays(String(data.fillFrom), String(data.fillTo)) : 0;
  return { ok: true, spins, days };
}

/* ─── Un tour de roue : le gain est tiré puis enregistré ─── */
function pick() {
  const wheel = WHEEL();
  let r = randomInt(TOTAL() * 1000) / 1000;
  for (const seg of wheel) { r -= seg.weight; if (r < 0) return seg; }
  return wheel[0];
}
/** paid : ce tour vient d'être acheté (un doublon rend alors son prix) */
export function spinOnce({ paid = false } = {}) {
  if (!wheelOpen() || wheelState().spins <= 0) return null;
  const seg = pick();
  const at = Date.now();
  const id = `wheel:${at.toString(36)}${randomInt(1e6).toString(36)}`;
  const extra = [];
  let gift;
  if (seg.kind === "ps") gift = { kind: "ps", seg: seg.key, ps: seg.ps };
  else if (seg.kind === "coupon") gift = { kind: "coupon", seg: seg.key, pct: seg.pct };
  else if (seg.kind === "costume") {
    const item = cosmeticById(seg.item);
    if (ownsLook(item.id, item.price)) gift = { kind: "costume", seg: seg.key, item: item.id, dup: true, refund: paid ? SPIN_PRICE : 0 };
    else { gift = { kind: "costume", seg: seg.key, item: item.id }; extra.push({ id: lookTag(item.id), price: 0, at, from: "wheel" }); }
  } else {
    const dyes = [...HAIR_COLORS.map(c => ["hairColor", c.id]), ...EYE_COLORS.map(c => ["eyeColor", c.id])]
      .filter(([key, color]) => priceOf(key, color) && !Shop.owned(key, color));
    if (dyes.length) {
      const [key, color] = dyes[randomInt(dyes.length)];
      gift = { kind: "dye", seg: seg.key, item: `${key === "hairColor" ? "hair" : "eyes"}:${color}` };
      extra.push({ id: `${key}:${color}`, price: 0, at, from: "wheel" });
    } else gift = { kind: "dye", seg: seg.key, dup: true, refund: paid ? SPIN_PRICE : 0 };
  }
  if (!DB.addPurchases([...extra, { id, price: 0, at, gift }])) return null;
  return { seg, gift };
}

/* ─── Dessin de la roue ──────────────────────────────── */
const R = 100;
const pt = (deg, r) => [+(r * Math.sin((deg * Math.PI) / 180)).toFixed(2), +(-r * Math.cos((deg * Math.PI) / 180)).toFixed(2)];
const STAR = `<path d="M0-9c.7 4.4 3.6 7.3 8 8-4.4.7-7.3 3.6-8 8-.7-4.4-3.6-7.3-8-8 4.4-.7 7.3-3.6 8-8z"/>`;
const POTION = `<path d="M-3-9h6v5c3.7 1.4 6 4.6 6 8.1a9 9 0 0 1-18 0c0-3.5 2.3-6.7 6-8.1z"/>`;
const costumeRarity = seg => rarityByKey(cosmeticById(seg.item)?.rarity);
const segColor = seg => (seg.kind === "costume" ? costumeRarity(seg).color : seg.color);

/** Angle de départ et de fin de chaque case (en degrés, depuis le haut, sens des aiguilles) */
const ARCS = () => {
  let a = 0;
  const total = TOTAL();
  return WHEEL().map(seg => { const from = a; a += (seg.weight / total) * 360; return { seg, from, to: a, mid: (from + a) / 2 }; });
};

function wheelSvg() {
  const t = T();
  const parts = ARCS().map(({ seg, from, to, mid }) => {
    const [x0, y0] = pt(from, R);
    const [x1, y1] = pt(to, R);
    const large = to - from > 180 ? 1 : 0;
    const span = to - from;
    const k = Math.min(1, span / 34);  // contenu plus petit dans les cases étroites
    let inner;
    if (seg.kind === "ps") inner = `<text class="gw-num" y="-4" style="font-size:${(15 * k + 4).toFixed(1)}px">+${seg.ps}</text><g class="gw-star" transform="translate(0 12) scale(${(0.8 * k + 0.2).toFixed(2)})">${STAR}</g>`;
    else if (seg.kind === "coupon") inner = `<text class="gw-num" y="-2" style="font-size:${(14 * k + 4).toFixed(1)}px">−${seg.pct}%</text><text class="gw-small" y="12">${lang() === "en" ? "voucher" : "bon"}</text>`;
    else if (seg.kind === "dye") inner = `<g class="gw-potion" transform="scale(${(1.1 * k + 0.3).toFixed(2)})">${POTION}</g>`;
    else {
      const w = (36 * k + 10).toFixed(1);
      const h = (w * 1.75).toFixed(1);
      const art = cosmeticById(seg.item).art;
      inner = `<image href="${art.outfit ? pieceUrl("outfit", art.outfit) : art.hat ? pieceUrl("hat", art.hat) : thumbUrl("weapon", art.weapon)}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    return `<g class="gw-slice gw-${seg.kind}">
      <path class="gw-seg" d="M0 0L${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}Z" fill="${segColor(seg)}"/>
      <g transform="rotate(${mid.toFixed(2)}) translate(0 -64)">${inner}</g>
    </g>`;
  }).join("");
  const bulbs = Array.from({ length: 24 }, (_, i) => { const [x, y] = pt(i * 15, R + 7); return `<circle class="gw-bulb" cx="${x}" cy="${y}" r="3.2"/>`; }).join("");
  const label = WHEEL().map(seg => segLabel(seg)).join(", ");
  return `<svg class="gw-wheel" viewBox="-118 -118 236 236" role="img" aria-label="${esc(`${t.title} : ${label}`)}" focusable="false">
    <circle class="gw-back" r="${R + 14}"/>
    <g class="gw-bulbs">${bulbs}</g>
    <g class="gw-rot">${parts}<circle class="gw-rim" r="${R}"/></g>
    <circle class="gw-hub" r="17"/><g class="gw-hub-star" transform="scale(1.25)">${STAR}</g>
  </svg>`;
}

function segLabel(seg) {
  const t = T();
  if (seg.kind === "ps") return fill(t.seg.ps, { n: seg.ps });
  if (seg.kind === "coupon") return fill(t.seg.coupon, { n: seg.pct });
  if (seg.kind === "dye") return t.seg.dye;
  return cosmeticById(seg.item)[lang()];
}

/* ─── La fenêtre ─────────────────────────────────────── */
export function openWheel({ onChange, onClose } = {}) {
  const { sheet } = openSheet({ onClose });
  sheet.classList.add("hx", "gw");
  const st = { rotation: 0, spinning: false, result: null, msg: null };
  const changed = () => { onChange?.(); syncProfileAvatar(); };

  const odds = () => {
    const t = T();
    const share = WHEEL().filter(s => s.kind === "costume").reduce((n, s) => n + s.weight, 0);
    return `<details class="gw-odds"><summary>${esc(t.odds)}</summary><ul>
      ${WHEEL().map(seg => `<li><i style="background:${segColor(seg)}"></i><span>${esc(segLabel(seg))}${seg.kind === "costume" ? ` · ${esc(costumeRarity(seg)[lang()])}` : ""}</span><b>${num((seg.weight / TOTAL()) * 100)} %</b></li>`).join("")}
      <li class="gw-odds-sum"><span>${esc(t.costumeShare)}</span><b>${num((share / TOTAL()) * 100)} %</b></li>
    </ul></details>`;
  };

  sheet.innerHTML = `
    <div class="tl-sheet-inner hx-wrap gw-wrap">
      <header class="hx-top">
        <div class="hx-titles"><p class="hx-kicker">${esc(T().kicker)}</p><h2 id="tl-sheet-title" class="hx-title" tabindex="-1">${esc(T().title)}</h2></div>
        <button type="button" class="icon-btn hx-close" data-sheet-close aria-label="${esc(T().close)}">✕</button>
      </header>
      <form class="hx-frame gw-code" novalidate>
        <label class="gw-code-label" for="gw-code-input">${esc(T().codeLabel)}</label>
        <div class="gw-code-row">
          <input id="gw-code-input" class="input" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="40" enterkeyhint="done" placeholder="${esc(T().codeHolder)}">
          <button type="submit" class="btn btn-ghost gw-validate">${esc(T().validate)}</button>
        </div>
        <p class="gw-msg" role="status" aria-live="polite"></p>
      </form>
      ${wheelOpen() ? "" : `<div class="hx-frame gw-closed"><p class="gw-closed-title">${esc(T().closedTitle)}</p><p class="hx-text">${esc(T().closedText)}</p></div>`}
      <div class="gw-stage"${wheelOpen() ? "" : " hidden"}>
        <div class="gw-wheel-wrap">
          <svg class="gw-pointer" viewBox="0 0 40 50" aria-hidden="true" focusable="false"><path d="M20 47L5 15a15 15 0 1 1 30 0z"/><circle cx="20" cy="15" r="5.5"/></svg>
          ${wheelSvg()}
        </div>
      </div>
      <p class="gw-spins" aria-live="polite"></p>
      <div class="gw-result" aria-live="polite"></div>
      <div class="gw-actions"></div>
      ${wheelOpen() ? odds() : ""}
    </div>`;

  const $ = s => sheet.querySelector(s);
  const rot = $(".gw-rot");
  const wrap = $(".gw-wheel-wrap");

  const renderBar = () => {
    const t = T();
    const { spins } = wheelState();
    const balance = Shop.wallet().balance;
    if (!wheelOpen()) {
      $(".gw-spins").textContent = spins ? fill(spins === 1 ? t.keptOne : t.kept, { n: spins }) : "";
      $(".gw-actions").innerHTML = "";
      return;
    }
    $(".gw-spins").textContent = (st.spinning ? t.spinning : spins === 1 ? t.spinsOne : spins ? fill(t.spins, { n: spins }) : t.spinsNone) + (st.spinning || !seasonUntil() ? "" : ` · ${seasonUntil()}`);
    $(".gw-spins").classList.toggle("is-lit", spins > 0 && !st.spinning);
    const r = st.result;
    const see = r ? (r.gift.kind === "costume" && !r.gift.dup ? "costume" : r.gift.kind === "dye" && !r.gift.dup ? "dye" : r.gift.kind === "coupon" ? "coupon" : "ps") : null;
    $(".gw-actions").innerHTML = st.spinning ? "" : `
      ${spins > 0 ? `<button type="button" class="btn btn-primary btn-block" data-gw-spin>${esc(r ? t.again : t.spin)} · ${spins}</button>`
        : balance >= SPIN_PRICE ? `<button type="button" class="btn btn-primary btn-block gw-buy" data-gw-buy>${esc(t.buySpin)}<span><svg class="hx-ps" viewBox="0 0 24 24" aria-hidden="true"><use href="#ps-icon"/></svg>${SPIN_PRICE}</span></button>`
        : `<p class="gw-short">${esc(fill(t.buyShort, { n: SPIN_PRICE - balance }))}</p>`}
      ${see ? `<button type="button" class="btn btn-surface btn-block" data-gw-see="${see}">${esc(t.see[see])}</button>` : ""}`;
  };

  const prizeHtml = ({ seg, gift }) => {
    const t = T();
    const L = lang();
    let art;
    let name;
    let detail;
    let rarity = null;
    if (gift.kind === "costume") {
      const item = cosmeticById(gift.item);
      rarity = rarityByKey(item.rarity);
      name = item[L];
      art = `<div class="gw-prize-fig">${figureSvg({ ...currentLook(), [item.slot]: item.id }, { view: "full", size: 112, frame: true, gear: wornGear(), label: name })}</div>`;
      detail = gift.dup ? (gift.refund ? fill(t.detail.costumeDup, { n: gift.refund }) : t.detail.costumeDupFree) : t.detail.costume;
    } else if (gift.kind === "ps") {
      name = fill(t.seg.ps, { n: gift.ps });
      art = `<svg class="gw-prize-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#ps-icon"/></svg>`;
      detail = t.detail.ps;
    } else if (gift.kind === "coupon") {
      name = fill(t.seg.coupon, { n: gift.pct });
      art = `<span class="gw-ticket" aria-hidden="true">−${gift.pct}%</span>`;
      detail = t.detail.coupon;
    } else {
      if (gift.dup) {
        name = gift.refund ? fill(t.seg.ps, { n: gift.refund }) : t.dupFreeName;
        art = `<svg class="gw-prize-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#ps-icon"/></svg>`;
        detail = gift.refund ? fill(t.detail.dyeDup, { n: gift.refund }) : t.detail.dyeDupFree;
      } else {
        const [part, color] = gift.item.split(":");
        const key = part === "hair" ? "hairColor" : "eyeColor";
        const c = (part === "hair" ? HAIR_COLORS : EYE_COLORS).find(x => x.id === color);
        const word = i18n.t(`avatarParts.${key}.${color}`);
        name = L === "en" ? `${word.charAt(0).toUpperCase()}${word.slice(1)} ${part === "hair" ? "hair" : "eyes"}` : `${part === "hair" ? "Cheveux" : "Yeux"} ${word}`;
        art = `<svg class="gw-prize-icon gw-prize-potion" viewBox="-12 -12 24 24" aria-hidden="true"><g fill="${c.color}">${POTION}</g></svg>`;
        detail = t.detail.dye;
      }
    }
    void seg;
    const key = rarity ? rarity.key : "common";
    return `
      <article class="gw-prize r-${key}${rarity ? " is-rare" : ""}">
        <div class="gw-prize-art r-${key}">${art}<span class="hx-burst" aria-hidden="true">${Array.from({ length: 12 }, (_, k) => `<i style="--a:${k * 30}deg"></i>`).join("")}</span></div>
        <div class="gw-prize-text">
          <p class="gw-prize-kicker">${esc(t.win)}</p>
          <h3 class="gw-prize-name r-${key}" tabindex="-1">${esc(name)}</h3>
          ${rarity ? `<span class="hx-rchip r-${key}">${esc(rarity[L])}</span>` : ""}
          <p class="hx-muted">${esc(detail)}</p>
        </div>
      </article>`;
  };

  const showResult = () => {
    st.spinning = false;
    wrap.classList.remove("is-spinning");
    $(".gw-result").innerHTML = st.result ? prizeHtml(st.result) : "";
    renderBar();
    $(".gw-prize-name")?.focus({ preventScroll: true });
    $(".gw-result")?.scrollIntoView({ block: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
    try { navigator.vibrate?.([18, 40, 30]); } catch { /* sans vibreur */ }
  };

  const spin = (paid = false) => {
    if (st.spinning) return;
    const res = spinOnce({ paid });
    if (!res) { renderBar(); return; }
    st.result = res;
    st.spinning = true;
    changed();
    $(".gw-result").innerHTML = "";
    const arc = ARCS().find(a => a.seg === res.seg);
    const jitter = (Math.random() - 0.5) * (arc.to - arc.from) * 0.7;
    const target = -(arc.mid + jitter);
    const current = ((st.rotation % 360) + 360) % 360;
    const delta = (((target - current) % 360) + 360) % 360;
    st.rotation += 360 * 5 + delta;
    renderBar();
    if (reducedMotion()) {
      rot.style.transition = "none";
      rot.style.transform = `rotate(${st.rotation}deg)`;
      showResult();
      return;
    }
    wrap.classList.add("is-spinning");
    rot.style.transition = "";
    rot.style.transform = `rotate(${st.rotation}deg)`;
    // fin de l'animation (et filet de sécurité si l'écran ne dessine plus d'images)
    let done = false;
    const finish = () => { if (done) return; done = true; showResult(); };
    rot.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, 5600);
  };

  $(".gw-code").addEventListener("submit", async event => {
    event.preventDefault();
    const t = T();
    const input = $("#gw-code-input");
    const btn = $(".gw-validate");
    const msg = $(".gw-msg");
    btn.disabled = true;
    msg.className = "gw-msg";
    msg.textContent = t.checking;
    const res = await redeemCode(input.value);
    btn.disabled = false;
    if (res.ok) {
      msg.className = "gw-msg is-ok";
      msg.textContent = res.adjusted ? fill(res.adjusted.level ? t.okAdjust : t.okAdjustPs, { level: res.adjusted.level, n: res.adjusted.balance }) : (res.spins === 1 ? t.okOne : fill(t.ok, { n: res.spins })) + (res.days ? ` ${fill(res.days === 1 ? t.daysOne : t.days, { n: res.days })}` : "");
      input.value = "";
      changed();
      renderBar();
      $("[data-gw-spin]")?.focus();
    } else {
      msg.className = "gw-msg is-error";
      msg.textContent = t.errors[res.reason] || t.errors.network;
      input.focus();
    }
  });

  sheet.addEventListener("click", event => {
    if (!wheelOpen() && event.target.closest("[data-gw-spin], [data-gw-buy]")) return;
    if (event.target.closest("[data-gw-spin]")) { spin(); return; }
    // acheter un tour puis le jouer tout de suite
    if (event.target.closest("[data-gw-buy]")) {
      if (st.spinning || wheelState().spins > 0 || Shop.wallet().balance < SPIN_PRICE) return;
      if (!DB.addPurchase({ id: `spin:${Date.now().toString(36)}${randomInt(1e6).toString(36)}`, price: SPIN_PRICE, at: Date.now(), spins: 1 })) return;
      changed();
      spin(true);
      return;
    }
    const see = event.target.closest("[data-gw-see]");
    if (see) {
      const tab = { costume: "look", dye: "look", coupon: "shop", ps: "hero" }[see.dataset.gwSee] || "hero";
      openHero({ tab, onChange });
    }
  });

  renderBar();
  $("#tl-sheet-title")?.focus();
  return sheet;
}
