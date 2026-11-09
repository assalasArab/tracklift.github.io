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
import { firestore } from "./firebase-config.js?v=20261104h";
import { DB } from "./db.js?v=20261104h";
import { Shop } from "./shop.js?v=20261104h";
import { i18n } from "./i18n.js?v=20261104h";
import { cosmeticById, lookTag } from "./cosmetics.js?v=20261104h";
import { HAIR_COLORS, EYE_COLORS, priceOf } from "./avatar-parts.js?v=20261104h";
import { figureSvg, pieceUrl } from "./avatar3.js?v=20261104h";
import { rarityByKey } from "./rpg-art.js?v=20261104h";
import { ownsLook, currentLook, wornGear, syncProfileAvatar } from "./avatar3-ui.js?v=20261104h";
import { openHero } from "./hero.js?v=20261104h";
import { openSheet, esc, reducedMotion } from "./potes-ui.js?v=20261104h";

/* ─── La roue : 100 parts en tout (la taille d'une case = sa chance) ─── */
// dup : points spé donnés à la place d'un costume (ou d'une teinture) qu'on a déjà
export const WHEEL = [
  { key: "ps50", kind: "ps", ps: 50, weight: 22, color: "#bee7b8" },
  { key: "infini", kind: "costume", item: "costume-infini", dup: 150, weight: 13 },
  { key: "coupon20", kind: "coupon", pct: 20, weight: 15, color: "#fbe39a" },
  { key: "ps100", kind: "ps", ps: 100, weight: 15, color: "#d3dcbc" },
  { key: "nuages", kind: "costume", item: "costume-nuages", dup: 300, weight: 8 },
  { key: "dye", kind: "dye", dup: 80, weight: 10, color: "#f8d0d6" },
  { key: "coupon40", kind: "coupon", pct: 40, weight: 8, color: "#ffd5b0" },
  { key: "aura", kind: "costume", item: "costume-aura", dup: 600, weight: 4 },
  { key: "ps250", kind: "ps", ps: 250, weight: 5, color: "#cde4ee" }
];
const TOTAL = WHEEL.reduce((n, s) => n + s.weight, 0);
const MAX_SPINS = 10;

const TEXT = {
  fr: {
    kicker: "Comptoir de la Fonte", title: "Roue des cadeaux", close: "Fermer",
    codeLabel: "Code cadeau", codeHolder: "Ex. : FONTE-2026", validate: "Valider", checking: "Vérification…",
    ok: "Code accepté : +{n} tours de roue !", okOne: "Code accepté : +1 tour de roue !",
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
    spins: "{n} tours à jouer", spinsOne: "1 tour à jouer", spinsNone: "Aucun tour : entre un code pour tourner la roue.",
    spin: "Tourner la roue", spinning: "La roue tourne…", again: "Tourner encore",
    win: "Tu gagnes", odds: "Chances de gain",
    seg: { ps: "+{n} points spé", coupon: "Bon de réduction −{n} %", dye: "Teinture offerte" },
    detail: {
      costume: "Nouveau costume ! Il t'attend dans Mon héros › Apparence.",
      costumeDup: "Déjà à toi : le marchand te le reprend contre +{n} points spé.",
      ps: "Ajoutés à ta réserve, et ils comptent pour ton niveau.",
      coupon: "À utiliser au moment d'acheter à la Boutique.",
      dye: "À toi dans Mon héros › Apparence › Teintures.",
      dyeDup: "Tu as déjà toutes les teintures : +{n} points spé à la place."
    },
    see: { costume: "Essayer mon costume", dye: "Voir ma teinture", coupon: "Aller à la Boutique", ps: "Voir mon héros" },
    costumeShare: "Costumes"
  },
  en: {
    kicker: "The Iron Counter", title: "Gift wheel", close: "Close",
    codeLabel: "Gift code", codeHolder: "E.g. IRON-2026", validate: "Confirm", checking: "Checking…",
    ok: "Code accepted: +{n} wheel spins!", okOne: "Code accepted: +1 wheel spin!",
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
    spins: "{n} spins to play", spinsOne: "1 spin to play", spinsNone: "No spins: enter a code to spin the wheel.",
    spin: "Spin the wheel", spinning: "The wheel is spinning…", again: "Spin again",
    win: "You win", odds: "Odds",
    seg: { ps: "+{n} spec points", coupon: "−{n} % voucher", dye: "Free dye" },
    detail: {
      costume: "New costume! It's waiting in My hero › Look.",
      costumeDup: "Already yours: the merchant buys it back for +{n} spec points.",
      ps: "Added to your reserve, and they count for your level.",
      coupon: "Use it when buying at the Shop.",
      dye: "Yours in My hero › Look › Dyes.",
      dyeDup: "You already have every dye: +{n} spec points instead."
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
  const won = list.filter(p => String(p.id).startsWith("code:")).reduce((n, p) => n + Math.max(0, Math.min(MAX_SPINS, Math.floor(Number(p.spins) || 0))), 0);
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
  if (data.active === false) return { ok: false, reason: "expired" };
  const spins = Math.max(1, Math.min(MAX_SPINS, Math.floor(Number(data.spins) || 1)));
  if (!DB.addPurchase({ id: codeTag(code), price: 0, at: now, spins })) return { ok: false, reason: DB.getData() ? "used" : "save" };
  return { ok: true, spins };
}

/* ─── Un tour de roue : le gain est tiré puis enregistré ─── */
function pick() {
  let r = randomInt(TOTAL * 1000) / 1000;
  for (const seg of WHEEL) { r -= seg.weight; if (r < 0) return seg; }
  return WHEEL[0];
}
export function spinOnce() {
  if (wheelState().spins <= 0) return null;
  const seg = pick();
  const at = Date.now();
  const id = `wheel:${at.toString(36)}${randomInt(1e6).toString(36)}`;
  const extra = [];
  let gift;
  if (seg.kind === "ps") gift = { kind: "ps", seg: seg.key, ps: seg.ps };
  else if (seg.kind === "coupon") gift = { kind: "coupon", seg: seg.key, pct: seg.pct };
  else if (seg.kind === "costume") {
    const item = cosmeticById(seg.item);
    if (ownsLook(item.id, item.price)) gift = { kind: "costume", seg: seg.key, item: item.id, dup: true, ps: seg.dup };
    else { gift = { kind: "costume", seg: seg.key, item: item.id }; extra.push({ id: lookTag(item.id), price: 0, at, from: "wheel" }); }
  } else {
    const dyes = [...HAIR_COLORS.map(c => ["hairColor", c.id]), ...EYE_COLORS.map(c => ["eyeColor", c.id])]
      .filter(([key, color]) => priceOf(key, color) && !Shop.owned(key, color));
    if (dyes.length) {
      const [key, color] = dyes[randomInt(dyes.length)];
      gift = { kind: "dye", seg: seg.key, item: `${key === "hairColor" ? "hair" : "eyes"}:${color}` };
      extra.push({ id: `${key}:${color}`, price: 0, at, from: "wheel" });
    } else gift = { kind: "dye", seg: seg.key, dup: true, ps: seg.dup };
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
const ARCS = (() => {
  let a = 0;
  return WHEEL.map(seg => { const from = a; a += (seg.weight / TOTAL) * 360; return { seg, from, to: a, mid: (from + a) / 2 }; });
})();

function wheelSvg() {
  const t = T();
  const parts = ARCS.map(({ seg, from, to, mid }) => {
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
      inner = `<image href="${pieceUrl("outfit", cosmeticById(seg.item).art.outfit)}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    return `<g class="gw-slice gw-${seg.kind}">
      <path class="gw-seg" d="M0 0L${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}Z" fill="${segColor(seg)}"/>
      <g transform="rotate(${mid.toFixed(2)}) translate(0 -64)">${inner}</g>
    </g>`;
  }).join("");
  const bulbs = Array.from({ length: 24 }, (_, i) => { const [x, y] = pt(i * 15, R + 7); return `<circle class="gw-bulb" cx="${x}" cy="${y}" r="3.2"/>`; }).join("");
  const label = WHEEL.map(seg => segLabel(seg)).join(", ");
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
    const share = WHEEL.filter(s => s.kind === "costume").reduce((n, s) => n + s.weight, 0);
    return `<details class="gw-odds"><summary>${esc(t.odds)}</summary><ul>
      ${WHEEL.map(seg => `<li><i style="background:${segColor(seg)}"></i><span>${esc(segLabel(seg))}${seg.kind === "costume" ? ` · ${esc(costumeRarity(seg)[lang()])}` : ""}</span><b>${num((seg.weight / TOTAL) * 100)} %</b></li>`).join("")}
      <li class="gw-odds-sum"><span>${esc(t.costumeShare)}</span><b>${num((share / TOTAL) * 100)} %</b></li>
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
      <div class="gw-stage">
        <div class="gw-wheel-wrap">
          <svg class="gw-pointer" viewBox="0 0 40 50" aria-hidden="true" focusable="false"><path d="M20 47L5 15a15 15 0 1 1 30 0z"/><circle cx="20" cy="15" r="5.5"/></svg>
          ${wheelSvg()}
        </div>
      </div>
      <p class="gw-spins" aria-live="polite"></p>
      <div class="gw-result" aria-live="polite"></div>
      <div class="gw-actions"></div>
      ${odds()}
    </div>`;

  const $ = s => sheet.querySelector(s);
  const rot = $(".gw-rot");
  const wrap = $(".gw-wheel-wrap");

  const renderBar = () => {
    const t = T();
    const { spins } = wheelState();
    $(".gw-spins").textContent = st.spinning ? t.spinning : spins === 1 ? t.spinsOne : spins ? fill(t.spins, { n: spins }) : t.spinsNone;
    $(".gw-spins").classList.toggle("is-lit", spins > 0 && !st.spinning);
    const r = st.result;
    const see = r ? (r.gift.kind === "costume" && !r.gift.dup ? "costume" : r.gift.kind === "dye" && !r.gift.dup ? "dye" : r.gift.kind === "coupon" ? "coupon" : "ps") : null;
    $(".gw-actions").innerHTML = st.spinning ? "" : `
      ${spins > 0 ? `<button type="button" class="btn btn-primary btn-block" data-gw-spin>${esc(r ? t.again : t.spin)} · ${spins}</button>` : ""}
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
      art = `<div class="gw-prize-fig">${figureSvg({ ...currentLook(), costume: item.id }, { view: "full", size: 112, frame: true, gear: wornGear(), label: name })}</div>`;
      detail = gift.dup ? fill(t.detail.costumeDup, { n: gift.ps }) : t.detail.costume;
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
        name = fill(t.seg.ps, { n: gift.ps });
        art = `<svg class="gw-prize-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#ps-icon"/></svg>`;
        detail = fill(t.detail.dyeDup, { n: gift.ps });
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

  const spin = () => {
    if (st.spinning) return;
    const res = spinOnce();
    if (!res) { renderBar(); return; }
    st.result = res;
    st.spinning = true;
    changed();
    $(".gw-result").innerHTML = "";
    const arc = ARCS.find(a => a.seg === res.seg);
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
      msg.textContent = res.spins === 1 ? t.okOne : fill(t.ok, { n: res.spins });
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
    if (event.target.closest("[data-gw-spin]")) { spin(); return; }
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
