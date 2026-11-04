/* ═══════════════════════════════════════════════════════════
   Écran « Mon perso » : niveau, classe et emblème, points à répartir,
   attributs, équipement, et le choix de classe obligatoire aux
   niveaux 10 et 30. Les calculs sont dans js/rpg.js.
   ═══════════════════════════════════════════════════════════ */
import { character, CLASSES, GEAR, SLOTS, STATS, STAT_INFO, ATTR_INFO, upcoming, allocate, chooseClass, resetClass, equip, gearTag, canWear, className, gearName, CLASS_CHANGE_PRICE } from "./rpg.js?v=20261104b";
import { emblemSvg, statIcon, gearIcon, BRANCH_COLORS } from "./rpg-art.js?v=20261104b";
import { i18n } from "./i18n.js?v=20261104b";
import { showToast } from "./utils.js?v=20261104b";
import { DB } from "./db.js?v=20261104b";
import { Shop } from "./shop.js?v=20261104b";
import { Social } from "./social.js?v=20261104b";
import { avatarSvg } from "./avatar.js?v=20261104b";
import { openSheet, sheetHead, esc, confirmSheet } from "./potes-ui.js?v=20261104b";
import { headHtml, openCharacterWindow } from "./avatar3-ui.js?v=20261104b";

const PS = `<svg class="rp-ps" viewBox="0 0 24 24" aria-hidden="true"><use href="#ps-icon"/></svg>`;
const CHEVRON = `<svg class="pl-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>`;

const UI = {
  fr: {
    menu: "Mon perso",
    title: "Mon perso",
    level: "Niveau {n}",
    levelMax: "Niveau maximum",
    toNext: "{have} / {need} points spé avant le niveau {n}",
    reserve: "points spé à dépenser",
    earnedAll: "{n} points spé gagnés depuis le début",
    choose: "Choisis ta voie",
    chooseSpec: "Choisis ta spécialité",
    chooseText: "Niveau {n} atteint : tu dois choisir pour continuer à évoluer.",
    chooseBtn: "Voir les choix",
    pickTitle: "Niveau {n} : ton choix",
    pickHelp: "Ce choix fixe ta classe et ce qu'elle renforce. Tu pourras changer de voie plus tard pour {price} points spé.",
    strengthens: "Renforce : {list}",
    style: "Style : {ref}",
    pick: "Choisir {name}",
    confirmTitle: "Devenir {name} ?",
    confirmText: "Ta classe renforce {list}. Tu pourras changer de voie plus tard pour {price} points spé.",
    confirmOk: "Oui, devenir {name}",
    chosen: "Tu es maintenant {name} !",
    stats: "Caractéristiques",
    free: "{n} point à répartir",
    freeMany: "{n} points à répartir",
    noFree: "Aucun point à répartir : chaque niveau en donne 5.",
    over: "{n} points répartis en trop (des séances ont été supprimées) : redistribue-les.",
    blocked: "Choisis d'abord ta classe pour répartir tes points.",
    add: "Ajouter un point en {name}",
    remove: "Retirer un point en {name}",
    breakdown: "{base} de base · {mine} placés · {cls} classe · {gear} équipement",
    save: "Valider ({n})",
    cancel: "Annuler",
    saved: "Points répartis.",
    reset: "Tout redistribuer",
    resetTitle: "Redistribuer tes points ?",
    resetText: "Tous tes points placés reviennent à répartir. C'est gratuit.",
    resetOk: "Redistribuer",
    resetDone: "Tes points sont à répartir.",
    attrs: "Attributs",
    gear: "Équipement",
    slot: { weapon: "Arme", outfit: "Tenue", accessory: "Accessoire" },
    empty: "Vide",
    inactive: "sans effet pour ta classe",
    path: "Ta voie",
    atLevel: "Niv. {n}",
    choiceAt: "Choix au niveau {n}",
    now: "maintenant",
    change: "Changer de voie ({price} points spé)",
    changeTitle: "Changer de voie ?",
    changeText: "Tu redeviens Novice et tu choisis une nouvelle voie tout de suite. Coût : {price} points spé. Tes points répartis et tes achats restent.",
    changeOk: "Changer pour {price} points spé",
    changeShort: "Il te faut {price} points spé pour changer de voie.",
    changed: "Choisis ta nouvelle voie.",
    how: "Gagner des points spé",
    howText: "Pesée du jour : +10, multiplié par le bonus de ta série (jusqu'à ×6). Séance du jour (3 séries ou plus) : +15. Les deux le même jour : +5 en plus. Ton niveau vient de tout ce que tu as gagné : dépenser ne le fait pas baisser.",
    shopGear: "Équipement : {slot}",
    req: "Niveau {n}",
    reqCls: "Niveau {n} · {cls}",
    owned: "À toi",
    wearing: "Porté",
    wear: "Porter",
    takeOff: "Retirer",
    buy: "Acheter",
    buyFor: "Acheter {name} pour {price} points spé",
    bought: "{name} est à toi.",
    tooLow: "Niveau {n} requis",
    wrongClass: "Réservé : {cls}",
    tooPoor: "Il te manque {n} points spé",
    line: "Ton perso : niveau {n}",
    lineFree: "{n} points à répartir",
    lineChoose: "Choisis ta classe pour évoluer",
    levelUp: "Niveau {n} ! +{pts} points à répartir dans Mon perso",
    levelUpChoose: "Niveau {n} ! Choisis ta classe dans Mon perso"
  },
  en: {
    menu: "My character",
    title: "My character",
    level: "Level {n}",
    levelMax: "Max level",
    toNext: "{have} / {need} spec points before level {n}",
    reserve: "spec points to spend",
    earnedAll: "{n} spec points earned in total",
    choose: "Choose your path",
    chooseSpec: "Choose your specialty",
    chooseText: "Level {n} reached: choose to keep evolving.",
    chooseBtn: "See the choices",
    pickTitle: "Level {n}: your choice",
    pickHelp: "This choice sets your class and what it strengthens. You can change path later for {price} spec points.",
    strengthens: "Strengthens: {list}",
    style: "Style: {ref}",
    pick: "Choose {name}",
    confirmTitle: "Become {name}?",
    confirmText: "Your class strengthens {list}. You can change path later for {price} spec points.",
    confirmOk: "Yes, become {name}",
    chosen: "You are now {name}!",
    stats: "Attributes",
    free: "{n} point to assign",
    freeMany: "{n} points to assign",
    noFree: "No point to assign: each level gives 5.",
    over: "{n} points too many (workouts were deleted): reassign them.",
    blocked: "Choose your class first to assign your points.",
    add: "Add a point to {name}",
    remove: "Remove a point from {name}",
    breakdown: "{base} base · {mine} assigned · {cls} class · {gear} gear",
    save: "Confirm ({n})",
    cancel: "Cancel",
    saved: "Points assigned.",
    reset: "Reassign everything",
    resetTitle: "Reassign your points?",
    resetText: "All your assigned points go back to the pool. It's free.",
    resetOk: "Reassign",
    resetDone: "Your points are back in the pool.",
    attrs: "Stats",
    gear: "Gear",
    slot: { weapon: "Weapon", outfit: "Outfit", accessory: "Accessory" },
    empty: "Empty",
    inactive: "no effect for your class",
    path: "Your path",
    atLevel: "Lv. {n}",
    choiceAt: "Choice at level {n}",
    now: "now",
    change: "Change path ({price} spec points)",
    changeTitle: "Change path?",
    changeText: "You become a Novice again and choose a new path right away. Cost: {price} spec points. Your assigned points and purchases stay.",
    changeOk: "Change for {price} spec points",
    changeShort: "You need {price} spec points to change path.",
    changed: "Choose your new path.",
    how: "Earning spec points",
    howText: "Daily weigh-in: +10, multiplied by your streak bonus (up to ×6). Daily workout (3 sets or more): +15. Both on the same day: +5 more. Your level comes from everything you've earned: spending never lowers it.",
    shopGear: "Gear: {slot}",
    req: "Level {n}",
    reqCls: "Level {n} · {cls}",
    owned: "Yours",
    wearing: "Worn",
    wear: "Wear",
    takeOff: "Take off",
    buy: "Buy",
    buyFor: "Buy {name} for {price} spec points",
    bought: "{name} is yours.",
    tooLow: "Level {n} required",
    wrongClass: "Reserved: {cls}",
    tooPoor: "You need {n} more spec points",
    line: "Your character: level {n}",
    lineFree: "{n} points to assign",
    lineChoose: "Choose your class to evolve",
    levelUp: "Level {n}! +{pts} points to assign in My character",
    levelUpChoose: "Level {n}! Choose your class in My character"
  }
};
const lang = () => (i18n.getLanguage() === "en" ? "en" : "fr");
const U = () => UI[lang()];
const fill = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const num = n => Number(n).toLocaleString(i18n.getLocale(), { maximumFractionDigits: 1 });
const statName = s => STAT_INFO[s][lang()];
const statAbbr = s => STAT_INFO[s].abbr[lang()];
const bonusText = bonus => Object.entries(bonus).map(([s, n]) => `+${n} ${statAbbr(s)}`).join(" · ");

/* ─── État ─────────────────────────────────────────────── */
const ownsGear = id => DB.getPurchases().some(p => p.id === gearTag(id));
export function rpgState() {
  const wallet = Shop.wallet();
  const rpg = DB.getRpg() || {};
  return { wallet, rpg, ch: character({ xp: wallet.earned, rpg, owned: ownsGear }) };
}
const listeners = new Set();
export const onRpgChange = fn => { listeners.add(fn); return () => listeners.delete(fn); };
function save(rpg) {
  DB.saveRpg(rpg);
  listeners.forEach(fn => { try { fn(); } catch (err) { console.error(err); } });
}

/* ─── Ligne sur l'accueil + passage de niveau ──────────── */
/** Ligne « Ton perso » : niveau gagné depuis la dernière visite, ou choix de classe à faire */
export function renderPersoLine(el, { onOpen } = {}) {
  if (!el) return;
  const { rpg, ch } = rpgState();
  const seen = Number(rpg.seenLevel) || 1;
  const show = ch.cls.pending || ch.level > seen;
  if (!show) { el.innerHTML = ""; el.classList.add("hidden"); return; }
  const T = U();
  const sub = ch.cls.pending ? T.lineChoose : ch.points.free > 0 ? fill(T.lineFree, { n: ch.points.free }) : "";
  el.classList.remove("hidden");
  el.innerHTML = `
    <button type="button" class="pl-main" data-rp-open>
      <span class="rp-line-emblem">${emblemSvg(ch.cls.id, { size: 38 })}</span>
      <span class="pl-text"><b>${esc(fill(T.line, { n: ch.level }))}</b>${sub ? `<br><span class="bl-sub">${esc(sub)}</span>` : ""}</span>
      ${CHEVRON}
    </button>`;
  el.querySelector("[data-rp-open]").addEventListener("click", () => onOpen?.());
}

/** À appeler après une pesée ou une séance : annonce un niveau gagné (une fois) */
export function announceLevel(before) {
  const { ch } = rpgState();
  if (before == null || ch.level <= before) return;
  const T = U();
  const pts = (ch.level - before) * 5;
  showToast(ch.cls.pending ? fill(T.levelUpChoose, { n: ch.level }) : fill(T.levelUp, { n: ch.level, pts }));
}
export const currentLevel = () => rpgState().ch.level;

/* ─── Écran « Mon perso » ──────────────────────────────── */
export function openPerso({ onChange } = {}) {
  const { sheet } = openSheet();
  let draft = Object.fromEntries(STATS.map(s => [s, 0]));
  let first = true;

  const draw = () => {
    const T = U();
    const L = lang();
    const { wallet, rpg, ch } = rpgState();
    // la visite marque le niveau comme vu (la ligne de l'accueil disparaît)
    if ((Number(rpg.seenLevel) || 1) < ch.level) save({ ...rpg, seenLevel: ch.level });
    const pendingFree = STATS.reduce((n, s) => n + draft[s], 0);
    const left = ch.points.free - pendingFree;
    const color = BRANCH_COLORS[CLASSES[ch.cls.id].branch || "novice"];
    // la tête du personnage ; un toucher ouvre le corps entier
    const avatar = `<button type="button" class="rp-avatar-btn" data-rp-figure aria-label="${esc(T.title)}">${headHtml(76)}</button>`;

    const pending = ch.cls.pending ? `
      <div class="card rp-choose" style="--rp-color:${color}">
        <p class="rp-choose-title">${esc(ch.cls.tier === 0 ? T.choose : T.chooseSpec)}</p>
        <p class="bl-muted">${esc(fill(T.chooseText, { n: ch.level }))}</p>
        <button type="button" class="btn btn-primary btn-sm" data-rp-choose>${esc(T.chooseBtn)}</button>
      </div>` : "";

    const pointsLine = ch.points.free < 0 ? fill(T.over, { n: -ch.points.free })
      : ch.cls.pending && ch.points.free > 0 ? T.blocked
      : ch.points.free > 0 ? fill(ch.points.free === 1 ? T.free : T.freeMany, { n: left }) : T.noFree;
    const canAdd = !ch.cls.pending && left > 0;
    const statsHtml = STATS.map(s => `
      <li class="rp-stat">
        <span class="rp-stat-icon">${statIcon(s, 22)}</span>
        <span class="rp-stat-name"><b>${esc(statName(s))}</b> <small>${esc(statAbbr(s))}</small>
          <small class="rp-stat-detail">${esc(fill(T.breakdown, { base: 5, mine: ch.alloc[s] + draft[s], cls: ch.classBonus[s], gear: ch.gearBonus[s] }))}</small></span>
        <b class="rp-stat-value">${ch.stats[s] + draft[s]}</b>
        <span class="rp-stat-btns">
          ${draft[s] ? `<button type="button" class="rp-step" data-rp-minus="${s}" aria-label="${esc(fill(T.remove, { name: statName(s) }))}">−</button>` : ""}
          <button type="button" class="rp-step is-plus" data-rp-plus="${s}" aria-label="${esc(fill(T.add, { name: statName(s) }))}"${canAdd ? "" : " disabled"}>+</button>
        </span>
      </li>`).join("");

    // attributs avec les points en attente de validation
    const preview = character({ xp: ch.xp, rpg: { ...rpg, alloc: Object.fromEntries(STATS.map(s => [s, ch.alloc[s] + draft[s]])) }, owned: ownsGear }).attrs;
    const attrsHtml = Object.entries(ATTR_INFO).map(([k, info]) => `
      <div class="rp-attr"><span>${esc(info[L])}</span><b>${num(preview[k])}${info.unit || ""}</b></div>`).join("");

    const gearHtml = SLOTS.map(slot => {
      const g = ch.gear[slot];
      return `<button type="button" class="rp-slot${g && !g.active ? " is-off" : ""}" data-rp-slot="${slot}">
        <span class="rp-slot-icon">${g ? gearIcon(g.item.art, g.item.rarity, 34) : `<span class="rp-slot-empty" aria-hidden="true">+</span>`}</span>
        <span class="rp-slot-text"><small>${esc(T.slot[slot])}</small><b>${esc(g ? gearName(g.id, L) : T.empty)}</b>
          ${g ? `<small>${esc(g.active ? bonusText(g.item.bonus) : T.inactive)}</small>` : ""}</span>
        ${CHEVRON}
      </button>`;
    }).join("");

    const next = upcoming(ch.cls.id);
    const pathHtml = `
      <ol class="rp-path">
        ${ch.cls.chain.map((id, i) => `<li class="rp-step-cls${id === ch.cls.id ? " is-now" : " is-done"}">${emblemSvg(id, { size: 44 })}<span>${esc(className(id, L))}</span><small>${esc(i === 0 ? fill(T.atLevel, { n: 1 }) : fill(T.atLevel, { n: [10, 30, 65, 85, 90][i - 1] }))}</small></li>`).join("")}
        ${next.map(step => step.id
          ? `<li class="rp-step-cls is-next">${emblemSvg(step.id, { size: 44 })}<span>${esc(className(step.id, L))}</span><small>${esc(fill(T.atLevel, { n: step.level }))}</small></li>`
          : `<li class="rp-step-cls is-next"><span class="rp-choice-dot" aria-hidden="true">?</span><span>${esc(step.options.map(o => className(o, L)).join(" / "))}</span><small>${esc(fill(T.choiceAt, { n: step.level }))}</small></li>`).join("")}
      </ol>
      ${CLASSES[ch.cls.id].focus ? `<p class="bl-text">${esc(CLASSES[ch.cls.id].focus[L])}</p>` : ""}
      ${ch.cls.tier > 0 ? `<button type="button" class="hero-other rp-change" data-rp-change>${esc(fill(T.change, { price: CLASS_CHANGE_PRICE }))}</button>` : ""}`;

    sheet.innerHTML = `
      <div class="tl-sheet-inner rp-sheet">
        ${sheetHead(T.title)}
        <div class="rp-hero" style="--rp-color:${color}">
          ${avatar ? `<div class="rp-avatar">${avatar}</div>` : ""}
          <div class="rp-emblem">${emblemSvg(ch.cls.id, { size: 76, title: className(ch.cls.id, L) })}</div>
          <div class="rp-id">
            <p class="rp-class">${esc(className(ch.cls.id, L))}</p>
            <p class="rp-level">${esc(ch.maxed ? T.levelMax : fill(T.level, { n: ch.level }))}</p>
          </div>
        </div>
        <div class="rp-xp">
          <div class="rp-xp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(ch.progress * 100)}" aria-label="${esc(fill(T.level, { n: ch.level + 1 }))}"><div style="width:${Math.round(ch.progress * 100)}%"></div></div>
          <p class="bl-muted">${esc(ch.maxed ? fill(T.earnedAll, { n: num(ch.xp) }) : fill(T.toNext, { have: num(ch.xp - ch.levelStart), need: num(ch.levelNext - ch.levelStart), n: ch.level + 1 }))}</p>
          <p class="rp-reserve">${PS}<b>${num(wallet.balance)}</b> <span>${esc(T.reserve)}</span></p>
        </div>
        ${pending}
        <section class="rp-section">
          <div class="rp-section-head"><h3 class="bl-label">${esc(T.stats)}</h3>
            ${ch.points.used ? `<button type="button" class="hero-other" data-rp-reset>${esc(T.reset)}</button>` : ""}</div>
          <p class="rp-points${left > 0 && !ch.cls.pending ? " has-free" : ""}">${esc(pointsLine)}</p>
          <ul class="rp-stats">${statsHtml}</ul>
          ${pendingFree ? `<div class="rp-draft-actions">
            <button type="button" class="btn btn-surface btn-sm" data-rp-cancel>${esc(T.cancel)}</button>
            <button type="button" class="btn btn-primary btn-sm" data-rp-save>${esc(fill(T.save, { n: pendingFree }))}</button></div>` : ""}
        </section>
        <section class="rp-section">
          <h3 class="bl-label">${esc(T.attrs)}</h3>
          <div class="rp-attrs">${attrsHtml}</div>
        </section>
        <section class="rp-section">
          <h3 class="bl-label">${esc(T.gear)}</h3>
          <div class="rp-slots">${gearHtml}</div>
        </section>
        <section class="rp-section">
          <h3 class="bl-label">${esc(T.path)}</h3>
          ${pathHtml}
        </section>
        <section class="rp-section">
          <h3 class="bl-label">${esc(T.how)}</h3>
          <p class="bl-text">${esc(T.howText)}</p>
        </section>
      </div>`;
    if (first) { sheet.querySelector("#tl-sheet-title")?.focus(); first = false; }
  };

  const changed = () => { onChange?.(); if (sheet.isConnected) draw(); };

  sheet.addEventListener("click", async event => {
    const T = U();
    const plus = event.target.closest("[data-rp-plus]");
    const minus = event.target.closest("[data-rp-minus]");
    if (plus || minus) {
      const s = (plus || minus).dataset.rpPlus || (plus || minus).dataset.rpMinus;
      const { ch } = rpgState();
      const used = STATS.reduce((n, k) => n + draft[k], 0);
      if (plus && !ch.cls.pending && used < ch.points.free) draft[s] += 1;
      if (minus && draft[s] > 0) draft[s] -= 1;
      draw();
      sheet.querySelector(`[data-rp-${plus ? "plus" : "minus"}="${s}"]`)?.focus();
      return;
    }
    if (event.target.closest("[data-rp-cancel]")) { draft = Object.fromEntries(STATS.map(s => [s, 0])); draw(); return; }
    if (event.target.closest("[data-rp-save]")) {
      const { rpg, ch } = rpgState();
      const next = allocate(rpg, draft, ch.points.free);
      if (next) { save(next); showToast(T.saved); }
      draft = Object.fromEntries(STATS.map(s => [s, 0]));
      changed();
      return;
    }
    if (event.target.closest("[data-rp-reset]")) {
      const ok = await confirmSheet({ title: T.resetTitle, text: T.resetText, confirmLabel: T.resetOk, danger: false });
      if (ok) { const { rpg } = rpgState(); save({ ...rpg, alloc: {} }); showToast(T.resetDone); onChange?.(); }
      openPerso({ onChange });
      return;
    }
    if (event.target.closest("[data-rp-choose]")) { openClassChoice({ onChange }); return; }
    if (event.target.closest("[data-rp-figure]")) { openCharacterWindow({ onChange: () => { onChange?.(); } }); return; }
    if (event.target.closest("[data-rp-change]")) {
      const { wallet } = rpgState();
      if (wallet.balance < CLASS_CHANGE_PRICE) { showToast(fill(T.changeShort, { price: CLASS_CHANGE_PRICE })); return; }
      const ok = await confirmSheet({ title: T.changeTitle, text: fill(T.changeText, { price: CLASS_CHANGE_PRICE }), confirmLabel: fill(T.changeOk, { price: CLASS_CHANGE_PRICE }) });
      if (!ok) { openPerso({ onChange }); return; }
      const fresh = rpgState();
      if (fresh.wallet.balance < CLASS_CHANGE_PRICE) { showToast(fill(T.changeShort, { price: CLASS_CHANGE_PRICE })); openPerso({ onChange }); return; }
      DB.addPurchase({ id: `respec:${Date.now()}`, price: CLASS_CHANGE_PRICE, at: Date.now() });
      save(resetClass(fresh.rpg));
      showToast(T.changed);
      onChange?.();
      openClassChoice({ onChange });
      return;
    }
    const slot = event.target.closest("[data-rp-slot]");
    if (slot) { openGear(slot.dataset.rpSlot, { onChange }); }
  });

  draw();
}

/* ─── Choix de classe ──────────────────────────────────── */
export function openClassChoice({ onChange } = {}) {
  const { ch } = rpgState();
  if (!ch.cls.pending) { openPerso({ onChange }); return; }
  const T = U();
  const L = lang();
  const { sheet } = openSheet({ onClose: () => {} });
  const options = ch.cls.pending.map(id => {
    const cls = CLASSES[id];
    const list = cls.main.map(statName).join(", ");
    return `
      <li class="card rp-option" style="--rp-color:${BRANCH_COLORS[cls.branch]}">
        <div class="rp-option-head">${emblemSvg(id, { size: 60 })}<div><p class="rp-class">${esc(className(id, L))}</p>
          <p class="bl-muted">${esc(fill(T.strengthens, { list }))}</p></div></div>
        ${cls.focus ? `<p class="bl-text">${esc(cls.focus[L])}</p>` : ""}
        ${cls.ref ? `<p class="bl-muted">${esc(fill(T.style, { ref: cls.ref }))}</p>` : ""}
        <button type="button" class="btn btn-ghost btn-sm" data-rp-pick="${id}">${esc(fill(T.pick, { name: className(id, L) }))}</button>
      </li>`;
  }).join("");
  sheet.innerHTML = `
    <div class="tl-sheet-inner rp-sheet">
      ${sheetHead(fill(T.pickTitle, { n: ch.level }))}
      <p class="bl-text">${esc(fill(T.pickHelp, { price: CLASS_CHANGE_PRICE }))}</p>
      <ul class="rp-options">${options}</ul>
    </div>`;
  sheet.querySelector("#tl-sheet-title")?.focus();
  sheet.addEventListener("click", async event => {
    const btn = event.target.closest("[data-rp-pick]");
    if (!btn) return;
    const id = btn.dataset.rpPick;
    const name = className(id, L);
    const list = CLASSES[id].main.map(statName).join(", ");
    const ok = await confirmSheet({ title: fill(T.confirmTitle, { name }), text: fill(T.confirmText, { list, price: CLASS_CHANGE_PRICE }), confirmLabel: fill(T.confirmOk, { name }), danger: false });
    if (!ok) { openClassChoice({ onChange }); return; }
    const state = rpgState();
    const next = chooseClass(state.rpg, state.ch.level, id);
    if (next) { save(next); showToast(fill(T.chosen, { name })); onChange?.(); }
    // une autre étape à choisir tout de suite (ex. niveau 30 atteint d'un coup) : on enchaîne
    if (rpgState().ch.cls.pending) openClassChoice({ onChange });
    else openPerso({ onChange });
  });
}

/* ─── Équipement d'un emplacement ──────────────────────── */
export function openGear(slot, { onChange } = {}) {
  const { sheet } = openSheet({ onClose: () => openPerso({ onChange }) });
  let first = true;
  const draw = () => {
    const T = U();
    const L = lang();
    const { wallet, rpg, ch } = rpgState();
    const items = Object.entries(GEAR).filter(([, g]) => g.slot === slot && reachable(g, ch.cls))
      .sort((a, b) => a[1].req.level - b[1].req.level || a[1].price - b[1].price);
    const rows = items.map(([id, g]) => {
      const owned = ownsGear(id);
      const worn = rpg.gear?.[slot] === id;
      const req = g.req.cls ? fill(T.reqCls, { n: g.req.level, cls: className(g.req.cls, L) }) : fill(T.req, { n: g.req.level });
      const wearable = canWear(g, ch.level, ch.cls.chain);
      let action;
      if (owned) {
        action = worn
          ? `<button type="button" class="btn btn-surface btn-sm" data-rp-off>${esc(T.takeOff)}</button>`
          : `<button type="button" class="btn btn-ghost btn-sm" data-rp-wear="${id}">${esc(T.wear)}</button>`;
      } else {
        const reason = ch.level < g.req.level ? fill(T.tooLow, { n: g.req.level })
          : g.req.cls && !ch.cls.chain.includes(g.req.cls) ? fill(T.wrongClass, { cls: className(g.req.cls, L) })
          : wallet.balance < g.price ? fill(T.tooPoor, { n: g.price - wallet.balance }) : "";
        action = reason
          ? `<span class="rp-reason">${esc(reason)}</span>`
          : `<button type="button" class="btn btn-primary btn-sm" data-rp-buy="${id}" aria-label="${esc(fill(T.buyFor, { name: gearName(id, L), price: g.price }))}">${esc(T.buy)}</button>`;
      }
      return `
        <li class="rp-item${worn ? " is-worn" : ""}${!wearable ? " is-locked" : ""}">
          <span class="rp-item-icon rarity-${g.rarity}">${gearIcon(g.art, g.rarity, 34)}</span>
          <span class="rp-item-text"><b>${esc(gearName(id, L))}</b>
            <small>${esc(bonusText(g.bonus))}</small>
            <small>${esc(req)}${owned ? ` · ${esc(worn ? T.wearing : T.owned)}` : ` · ${PS_TEXT(g.price)}`}</small></span>
          ${action}
        </li>`;
    }).join("");
    sheet.innerHTML = `
      <div class="tl-sheet-inner rp-sheet">
        ${sheetHead(fill(T.shopGear, { slot: T.slot[slot] }))}
        <p class="rp-reserve">${PS}<b>${num(wallet.balance)}</b> <span>${esc(T.reserve)}</span></p>
        <ul class="rp-items">${rows}</ul>
      </div>`;
    if (first) { sheet.querySelector("#tl-sheet-title")?.focus(); first = false; }
  };
  sheet.addEventListener("click", event => {
    const T = U();
    const L = lang();
    const buy = event.target.closest("[data-rp-buy]");
    const wear = event.target.closest("[data-rp-wear]");
    if (buy) {
      const id = buy.dataset.rpBuy;
      const g = GEAR[id];
      const { wallet, rpg, ch } = rpgState();
      if (ownsGear(id) || wallet.balance < g.price || !canWear(g, ch.level, ch.cls.chain)) return;
      DB.addPurchase({ id: gearTag(id), price: g.price, at: Date.now() });
      if (!rpg.gear?.[slot]) save(equip(rpg, slot, id)); // emplacement vide : on le porte tout de suite
      showToast(fill(T.bought, { name: gearName(id, L) }));
      onChange?.();
      draw();
      return;
    }
    if (wear) { save(equip(rpgState().rpg, slot, wear.dataset.rpWear)); onChange?.(); draw(); return; }
    if (event.target.closest("[data-rp-off]")) { save(equip(rpgState().rpg, slot, null)); onChange?.(); draw(); }
  });
  draw();
}
/** Objet utile pour ma voie : sans classe, de ma classe, ou d'une classe que je pourrai devenir (un Novice voit tout) */
function reachable(item, cls) {
  if (!item.req.cls || cls.id === "novice") return true;
  if (cls.chain.includes(item.req.cls)) return true;
  const below = id => CLASSES[id].next.some(n => n === item.req.cls || below(n));
  return below(cls.id);
}
const PS_TEXT = price => `${PS}${esc(num(price))}`;

export const persoMenuLabel = () => U().menu;
