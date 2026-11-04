/* ═══════════════════════════════════════════════════════════
   Personnage : état enregistré, ligne « Ton héros » de l'accueil,
   annonce des niveaux et choix de classe obligatoire aux niveaux
   10 et 30. La fenêtre du héros est dans js/hero.js ;
   les calculs sont dans js/rpg.js.
   ═══════════════════════════════════════════════════════════ */
import { character, CLASSES, STAT_INFO, chooseClass, gearTag, className, CLASS_CHANGE_PRICE } from "./rpg.js?v=20261104d";
import { emblemSvg, BRANCH_COLORS } from "./rpg-art.js?v=20261104d";
import { BRANCH_LORE, loreText } from "./lore.js?v=20261104d";
import { i18n } from "./i18n.js?v=20261104d";
import { showToast } from "./utils.js?v=20261104d";
import { DB } from "./db.js?v=20261104d";
import { Shop } from "./shop.js?v=20261104d";
import { openSheet, esc, confirmSheet } from "./potes-ui.js?v=20261104d";
import { openHero } from "./hero.js?v=20261104d";

const CHEVRON = `<svg class="pl-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>`;

const UI = {
  fr: {
    menu: "Mon héros",
    close: "Fermer",
    choose: "Choisis ta voie",
    chooseSpec: "Choisis ta spécialité",
    pickKicker: "Niveau {n} atteint",
    pickHelp: "Ce choix fixe ta classe et ce qu'elle renforce. Tu pourras changer de voie plus tard pour {price} points spé.",
    strengthens: "Renforce : {list}",
    style: "Style : {ref}",
    pick: "Devenir {name}",
    confirmTitle: "Devenir {name} ?",
    confirmText: "Ta classe renforce {list}. Tu pourras changer de voie plus tard pour {price} points spé.",
    confirmOk: "Oui, devenir {name}",
    chosen: "Tu es maintenant {name} !",
    line: "Ton héros : niveau {n}",
    lineFree: "{n} points à répartir",
    lineChoose: "Choisis ta classe pour évoluer",
    levelUp: "Niveau {n} ! +{pts} points à répartir dans Mon héros",
    levelUpChoose: "Niveau {n} ! Choisis ta classe dans Mon héros"
  },
  en: {
    menu: "My hero",
    close: "Close",
    choose: "Choose your path",
    chooseSpec: "Choose your specialty",
    pickKicker: "Level {n} reached",
    pickHelp: "This choice sets your class and what it strengthens. You can change path later for {price} spec points.",
    strengthens: "Strengthens: {list}",
    style: "Style: {ref}",
    pick: "Become {name}",
    confirmTitle: "Become {name}?",
    confirmText: "Your class strengthens {list}. You can change path later for {price} spec points.",
    confirmOk: "Yes, become {name}",
    chosen: "You are now {name}!",
    line: "Your hero: level {n}",
    lineFree: "{n} points to assign",
    lineChoose: "Choose your class to evolve",
    levelUp: "Level {n}! +{pts} points to assign in My hero",
    levelUpChoose: "Level {n}! Choose your class in My hero"
  }
};
const lang = () => (i18n.getLanguage() === "en" ? "en" : "fr");
const U = () => UI[lang()];
const fill = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const statName = s => STAT_INFO[s][lang()];

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
/** Enregistre le personnage (pour la fenêtre du héros) */
export const saveRpg = save;

/* ─── Ligne sur l'accueil + passage de niveau ──────────── */
/** Ligne « Ton héros » : niveau gagné depuis la dernière visite, ou choix de classe à faire */
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

/* ─── Fenêtre du héros (js/hero.js) ────────────────────── */
export function openPerso({ onChange } = {}) { openHero({ tab: "hero", onChange }); }
/** Sac d'un emplacement d'équipement (arme, tenue, accessoire) */
export function openGear(slot, { onChange } = {}) { openHero({ tab: "hero", slot, onChange }); }

/* ─── Choix de classe ──────────────────────────────────── */
export function openClassChoice({ onChange } = {}) {
  const { ch } = rpgState();
  if (!ch.cls.pending) { openPerso({ onChange }); return; }
  const T = U();
  const L = lang();
  // fermer le choix ramène à la fenêtre du héros
  const { sheet } = openSheet({ onClose: () => openPerso({ onChange }) });
  sheet.classList.add("hx");
  const options = ch.cls.pending.map(id => {
    const cls = CLASSES[id];
    const list = cls.main.map(statName).join(", ");
    // la légende de la voie, pour le premier choix
    const lore = cls.tier === 1 ? loreText(BRANCH_LORE[id], L) : "";
    return `
      <li class="hx-frame hx-class-card hx-option" style="--hx-class:${BRANCH_COLORS[cls.branch]}">
        <div class="hx-class-head">${emblemSvg(id, { size: 72 })}<div><p class="hx-class-name">${esc(className(id, L))}</p>
          <p class="hx-muted">${esc(fill(T.strengthens, { list }))}</p></div></div>
        ${lore ? `<blockquote class="hx-lore">${esc(lore)}</blockquote>` : ""}
        ${cls.focus ? `<p class="hx-text">${esc(cls.focus[L])}</p>` : ""}
        ${cls.ref ? `<p class="hx-muted">${esc(fill(T.style, { ref: cls.ref }))}</p>` : ""}
        <button type="button" class="btn btn-ghost btn-block hx-pick" data-rp-pick="${id}">${esc(fill(T.pick, { name: className(id, L) }))}</button>
      </li>`;
  }).join("");
  sheet.innerHTML = `
    <div class="tl-sheet-inner hx-wrap">
      <header class="hx-top">
        <div class="hx-titles">
          <p class="hx-kicker">${esc(fill(T.pickKicker, { n: ch.level }))}</p>
          <h2 id="tl-sheet-title" class="hx-title" tabindex="-1">${esc(ch.cls.tier === 0 ? T.choose : T.chooseSpec)}</h2>
        </div>
        <button type="button" class="icon-btn hx-close" data-sheet-close aria-label="${esc(T.close)}">✕</button>
      </header>
      <p class="hx-text">${esc(fill(T.pickHelp, { price: CLASS_CHANGE_PRICE }))}</p>
      <ul class="hx-options">${options}</ul>
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

export const persoMenuLabel = () => U().menu;
