/* ═══════════════════════════════════════════════════════════
   Fenêtre du personnage (préprod), inspirée des fenêtres
   d'équipement des MMORPG : le personnage en entier au centre,
   les emplacements autour, et un menu qui glisse depuis le bas
   pour choisir ce qu'on met dans chaque emplacement.
   - onglet Équipement : arme, tenue, accessoire (avec bonus)
   - onglet Apparence : tenue entière, skin d'arme, compagnon, fond, style
     (une skin recouvre l'équipement mais garde ses bonus)
   ═══════════════════════════════════════════════════════════ */
import { GEAR, SLOTS, STAT_INFO, ATTR_INFO, equip, gearTag, canWear, className, gearName } from "./rpg.js?v=20261104a";
import { emblemSvg, gearIcon } from "./rpg-art.js?v=20261104a";
import { figureSvg, normalizeLook, FACE_OPTIONS } from "./avatar3.js?v=20261104a";
import { COSMETIC_BACKGROUNDS, cosmeticsFor, cosmeticById, lookTag } from "./cosmetics.js?v=20261104a";
import { SKINS, HAIR_COLORS, EYE_COLORS, priceOf } from "./avatar-parts.js?v=20261104a";
import { rpgState } from "./rpg-ui.js?v=20261104a";
import { i18n } from "./i18n.js?v=20261104a";
import { showToast } from "./utils.js?v=20261104a";
import { DB } from "./db.js?v=20261104a";
import { Shop } from "./shop.js?v=20261104a";
import { openSheet, sheetHead, esc } from "./potes-ui.js?v=20261104a";

const PS = `<svg class="rp-ps" viewBox="0 0 24 24" aria-hidden="true"><use href="#ps-icon"/></svg>`;
const TEXT = {
  fr: {
    title: "Mon personnage",
    level: "Niv. {n}",
    tabGear: "Équipement",
    tabLook: "Apparence",
    slot: { weapon: "Arme", outfit: "Tenue", accessory: "Accessoire", costume: "Tenue entière", weaponSkin: "Skin d'arme", companion: "Compagnon", bg: "Fond", style: "Style" },
    empty: "Vide",
    none: "Aucune",
    noneM: "Aucun",
    covered: "Apparence : {name}",
    keepsStats: "Garde les bonus de ton équipement",
    soon: "Bientôt : les dessins arrivent avec la prochaine mise à jour.",
    choose: "Choisis un emplacement",
    drawerHint: "Touche un emplacement autour de ton personnage",
    wearing: "Porté",
    owned: "À toi",
    buy: "Débloquer",
    bought: "{name} est à toi.",
    tooLow: "Niveau {n}",
    wrongClass: "{cls}",
    tooPoor: "Il manque {n}",
    free: "Libre",
    skin: "Peau",
    hair: "Cheveux",
    eyes: "Yeux",
    eyeColor: "Couleur des yeux",
    faceEyes: "Yeux",
    faceHair: "Coupe",
    faceMouth: "Bouche",
    styleSub: "Visage et couleurs",
    saved: "C'est enregistré.",
    open: "Ouvrir le menu",
    close: "Fermer le menu",
    inactive: "sans effet pour ta classe"
  },
  en: {
    title: "My character",
    level: "Lv. {n}",
    tabGear: "Gear",
    tabLook: "Appearance",
    slot: { weapon: "Weapon", outfit: "Outfit", accessory: "Accessory", costume: "Full outfit", weaponSkin: "Weapon skin", companion: "Companion", bg: "Background", style: "Style" },
    empty: "Empty",
    none: "None",
    noneM: "None",
    covered: "Look: {name}",
    keepsStats: "Keeps your gear's bonuses",
    soon: "Coming soon: the drawings arrive with the next update.",
    choose: "Choose a slot",
    drawerHint: "Tap a slot around your character",
    wearing: "Worn",
    owned: "Yours",
    buy: "Unlock",
    bought: "{name} is yours.",
    tooLow: "Level {n}",
    wrongClass: "{cls}",
    tooPoor: "{n} short",
    free: "Free",
    skin: "Skin",
    hair: "Hair",
    eyes: "Eyes",
    eyeColor: "Eye colour",
    faceEyes: "Eyes",
    faceHair: "Haircut",
    faceMouth: "Mouth",
    styleSub: "Face and colours",
    saved: "Saved.",
    open: "Open the menu",
    close: "Close the menu",
    inactive: "no effect for your class"
  }
};
const lang = () => (i18n.getLanguage() === "en" ? "en" : "fr");
const T = () => TEXT[lang()];
const fill = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const num = n => Number(n).toLocaleString(i18n.getLocale(), { maximumFractionDigits: 1 });
const bonusText = bonus => Object.entries(bonus).map(([s, n]) => `+${n} ${STAT_INFO[s].abbr[lang()]}`).join(" · ");

/* ─── Données : apparence enregistrée avec le personnage (users/<uid> → rpg.look) ─── */
export function currentLook() { return normalizeLook((DB.getRpg() || {}).look); }
function saveLook(patch) {
  const rpg = DB.getRpg() || {};
  DB.saveRpg({ ...rpg, look: { ...normalizeLook(rpg.look), ...patch } });
}
const ownsLook = (id, price) => !price || DB.getPurchases().some(p => p.id === lookTag(id));
const ownsGear = id => DB.getPurchases().some(p => p.id === gearTag(id));

/** Vignette de la tête (profil) ; size en px */
export function headHtml(size = 76, label = "") { return figureSvg(currentLook(), { view: "head", size, label }); }

/** Équipement porté (acheté), pour dessiner la tenue et l'arme sur le personnage */
function wornGear() {
  const { ch } = rpgState();
  return { outfit: ch.gear.outfit?.id || null, weapon: ch.gear.weapon?.id || null };
}

const GEAR_SIDES = { left: ["weapon"], right: ["outfit", "accessory"] };
const LOOK_SIDES = { left: ["weaponSkin", "companion", "style"], right: ["costume", "bg"] };

/* ─── La fenêtre ───────────────────────────────────────── */
export function openCharacterWindow({ onChange } = {}) {
  const { sheet } = openSheet({ labelledBy: "tl-sheet-title" });
  let tab = "gear";
  let slot = null;      // emplacement ouvert dans le menu
  let drawerOpen = false;
  let first = true;

  const slotButton = key => {
    const t = T();
    const { rpg, ch } = rpgState();
    const look = currentLook();
    let icon = `<span class="cw-slot-empty" aria-hidden="true">+</span>`;
    let sub = t.empty;
    let off = false;
    if (SLOTS.includes(key)) {
      const g = ch.gear[key];
      if (g) { icon = gearIcon(g.item.art, g.item.rarity, 30); sub = gearName(g.id, lang()); off = !g.active; }
      const skin = key === "outfit" ? cosmeticById(look.costume) : key === "weapon" ? cosmeticById(look.weaponSkin) : null;
      if (skin) sub += ` · ${fill(t.covered, { name: skin[lang()] })}`;
    } else if (key === "bg") {
      const bg = COSMETIC_BACKGROUNDS.find(b => b.id === look.bg);
      icon = `<span class="cw-swatch" style="background:${bg.stops ? `linear-gradient(${bg.stops.join(",")})` : bg.color}"></span>`;
      sub = bg[lang()];
    } else if (key === "style") {
      icon = `<span class="cw-style-dots" aria-hidden="true">${[SKINS.find(s => s.id === look.skin), HAIR_COLORS.find(s => s.id === look.hairColor), EYE_COLORS.find(s => s.id === look.eyeColor)].map(c => `<i style="background:${c.color}"></i>`).join("")}</span>`;
      sub = t.styleSub;
    } else {
      const item = cosmeticById(look[key]);
      sub = item ? item[lang()] : key === "companion" ? t.noneM : t.none;
    }
    void rpg;
    return `<button type="button" class="cw-slot${slot === key ? " is-open" : ""}${off ? " is-off" : ""}" data-cw-slot="${key}" aria-expanded="${slot === key && drawerOpen}">
      <span class="cw-slot-icon">${icon}</span>
      <span class="cw-slot-text"><b>${esc(t.slot[key])}</b><small>${esc(sub)}</small></span>
    </button>`;
  };

  const tile = ({ key, selected, locked, label, sub, visual, attrs = "" }) => `
    <button type="button" class="cw-tile${selected ? " is-on" : ""}${locked ? " is-locked" : ""}" ${attrs} aria-pressed="${!!selected}">
      <span class="cw-tile-visual">${visual}</span>
      <span class="cw-tile-name">${esc(label)}</span>
      ${sub ? `<span class="cw-tile-sub">${sub}</span>` : ""}
    </button>`;

  const drawerContent = () => {
    const t = T();
    const L = lang();
    const { wallet, rpg, ch } = rpgState();
    const look = currentLook();
    if (!slot) return `<p class="cw-hint">${esc(t.drawerHint)}</p>`;
    if (SLOTS.includes(slot)) {
      const items = Object.entries(GEAR).filter(([, g]) => g.slot === slot)
        .sort((a, b) => a[1].req.level - b[1].req.level || a[1].price - b[1].price);
      const tiles = items.map(([id, g]) => {
        const owned = ownsGear(id);
        const worn = rpg.gear?.[slot] === id;
        const wearable = canWear(g, ch.level, ch.cls.chain);
        const reason = !owned && (ch.level < g.req.level ? fill(t.tooLow, { n: g.req.level })
          : g.req.cls && !ch.cls.chain.includes(g.req.cls) ? fill(t.wrongClass, { cls: className(g.req.cls, L) })
          : wallet.balance < g.price ? `${fill(t.tooPoor, { n: g.price - wallet.balance })}` : "");
        const sub = worn ? esc(t.wearing) : owned ? esc(wearable ? bonusText(g.bonus) : t.inactive) : reason ? esc(reason) : `${PS}${num(g.price)}`;
        return tile({ key: id, selected: worn, locked: !owned && !!reason, label: gearName(id, L), sub, visual: gearIcon(g.art, g.rarity, 34), attrs: `data-cw-gear="${id}"` });
      }).join("");
      const noneTile = tile({ key: "none", selected: !rpg.gear?.[slot], label: t.empty, visual: `<span class="cw-slot-empty">∅</span>`, attrs: `data-cw-gear=""` });
      return `<div class="cw-grid">${noneTile}${tiles}</div>`;
    }
    if (slot === "bg") {
      return `<div class="cw-grid">${COSMETIC_BACKGROUNDS.map(bg => {
        const owned = ownsLook(bg.id, bg.price);
        const sub = look.bg === bg.id ? esc(t.wearing) : owned ? esc(bg.price ? t.owned : t.free) : wallet.balance < bg.price ? esc(fill(t.tooPoor, { n: bg.price - wallet.balance })) : `${PS}${num(bg.price)}`;
        return tile({ selected: look.bg === bg.id, locked: !owned && wallet.balance < bg.price, label: bg[L], sub,
          visual: `<span class="cw-swatch is-big" style="background:${bg.stops ? `linear-gradient(${bg.stops.join(",")})` : bg.color}"></span>`, attrs: `data-cw-bg="${bg.id}"` });
      }).join("")}</div>`;
    }
    if (slot === "style") {
      const row = (title, key, list, priceKey) => `
        <h4 class="cw-sub">${esc(title)}</h4>
        <div class="cw-colors">${list.map(c => {
          const price = priceKey ? priceOf(priceKey, c.id) : 0;
          const owned = !price || Shop.owned(priceKey, c.id);
          return `<button type="button" class="cw-color${look[key] === c.id ? " is-on" : ""}${owned ? "" : " is-locked"}" style="--c:${c.color}" data-cw-color="${key}|${c.id}|${priceKey || ""}" aria-pressed="${look[key] === c.id}" aria-label="${esc(c.id)}${owned ? "" : ` · ${price}`}">${owned ? "" : `<small>${PS}${price}</small>`}</button>`;
        }).join("")}</div>`;
      // visage : chaque choix montré sur ton propre visage (vignette zoomée)
      const faces = (title, key, view = "face") => `
        <h4 class="cw-sub">${esc(title)}</h4>
        <div class="cw-faces">${FACE_OPTIONS[key].map((opt, i) => `<button type="button" class="cw-face${look[key] === opt ? " is-on" : ""}" data-cw-face="${key}|${opt}" aria-pressed="${look[key] === opt}" aria-label="${esc(title)} ${i + 1}">${figureSvg({ ...look, [key]: opt }, { view, size: 64 })}</button>`).join("")}</div>`;
      return faces(t.faceHair, "hair", "head") + faces(t.faceEyes, "eyes") + faces(t.faceMouth, "mouth")
        + row(t.skin, "skin", SKINS, null) + row(t.hair, "hairColor", HAIR_COLORS, "hairColor") + row(t.eyeColor, "eyeColor", EYE_COLORS, "eyeColor");
    }
    // tenue entière, skin d'arme, compagnon : catalogue des dessins (vide pour l'instant)
    const list = cosmeticsFor(slot);
    const noneTile = tile({ selected: !look[slot], label: slot === "companion" ? t.noneM : t.none, visual: `<span class="cw-slot-empty">∅</span>`, attrs: `data-cw-look="${slot}|"` });
    const tiles = list.map(item => {
      const owned = ownsLook(item.id, item.price);
      const sub = look[slot] === item.id ? esc(t.wearing) : owned ? esc(t.owned) : `${PS}${num(item.price)}`;
      return tile({ selected: look[slot] === item.id, label: item[L], sub, visual: figureSvg({ ...look, [slot]: item.id }, { view: "full", size: 40, frame: false, gear: wornGear() }), attrs: `data-cw-look="${slot}|${item.id}"` });
    }).join("");
    const cover = slot === "costume" || slot === "weaponSkin" ? `<p class="cw-hint">${esc(t.keepsStats)}</p>` : "";
    return `${cover}<div class="cw-grid">${noneTile}${tiles}</div>${list.length ? "" : `<p class="cw-hint">${esc(t.soon)}</p>`}`;
  };

  const draw = () => {
    const t = T();
    const L = lang();
    const { ch } = rpgState();
    const look = currentLook();
    const sides = tab === "gear" ? GEAR_SIDES : LOOK_SIDES;
    const attrs = ["pv", "atqCac", "atqDist", "atqMag", "def", "defMag"].map(k => `<span><small>${esc(ATTR_INFO[k][L])}</small><b>${num(ch.attrs[k])}</b></span>`).join("");
    const keepScroll = sheet.querySelector(".cw-drawer-body")?.scrollTop || 0;
    sheet.innerHTML = `
      <div class="tl-sheet-inner cw-sheet">
        ${sheetHead(t.title, `${className(ch.cls.id, L)} · ${fill(t.level, { n: ch.level })}`)}
        <div class="pb-tabs cw-tabs" role="tablist">
          <button type="button" role="tab" class="pb-tab" aria-selected="${tab === "gear"}" aria-checked="${tab === "gear"}" data-cw-tab="gear">${esc(t.tabGear)}</button>
          <button type="button" role="tab" class="pb-tab" aria-selected="${tab === "look"}" aria-checked="${tab === "look"}" data-cw-tab="look">${esc(t.tabLook)}</button>
        </div>
        <div class="cw-stage">
          <div class="cw-col">${sides.left.map(slotButton).join("")}</div>
          <div class="cw-figure">
            ${figureSvg(look, { view: "full", size: 190, label: className(ch.cls.id, L), gear: wornGear() })}
            <span class="cw-emblem">${emblemSvg(ch.cls.id, { size: 40 })}</span>
          </div>
          <div class="cw-col">${sides.right.map(slotButton).join("")}</div>
        </div>
        ${tab === "gear" ? `<div class="cw-attrs">${attrs}</div>` : ""}
      </div>
      <div class="cw-drawer${drawerOpen ? " is-open" : ""}" data-cw-drawer>
        <button type="button" class="cw-handle" data-cw-handle aria-label="${esc(drawerOpen ? t.close : t.open)}" aria-expanded="${drawerOpen}"><span></span></button>
        <div class="cw-drawer-head"><b>${esc(slot ? t.slot[slot] : t.choose)}</b></div>
        <div class="cw-drawer-body">${drawerContent()}</div>
      </div>`;
    const body = sheet.querySelector(".cw-drawer-body");
    if (body) body.scrollTop = keepScroll;
    if (first) { sheet.querySelector("#tl-sheet-title")?.focus(); first = false; }
    bindDrag();
  };

  /* menu glissant : on le tire vers le haut ou le bas (ou on touche la poignée) */
  const bindDrag = () => {
    const drawer = sheet.querySelector("[data-cw-drawer]");
    const handle = sheet.querySelector("[data-cw-handle]");
    if (!drawer || !handle) return;
    let startY = null;
    let moved = 0;
    handle.addEventListener("pointerdown", e => { startY = e.clientY; moved = 0; handle.setPointerCapture(e.pointerId); drawer.classList.add("is-dragging"); });
    handle.addEventListener("pointermove", e => {
      if (startY == null) return;
      moved = e.clientY - startY;
      drawer.style.setProperty("--cw-drag", `${moved}px`);
    });
    const end = () => {
      if (startY == null) return;
      drawer.classList.remove("is-dragging");
      drawer.style.removeProperty("--cw-drag");
      if (Math.abs(moved) > 40) drawerOpen = moved < 0;
      else drawerOpen = !drawerOpen;
      startY = null;
      draw();
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  };

  const changed = () => { onChange?.(); draw(); };

  sheet.addEventListener("click", event => {
    const t = T();
    const L = lang();
    const tabBtn = event.target.closest("[data-cw-tab]");
    if (tabBtn) { tab = tabBtn.dataset.cwTab; slot = null; drawerOpen = false; draw(); return; }
    const slotBtn = event.target.closest("[data-cw-slot]");
    if (slotBtn) {
      const key = slotBtn.dataset.cwSlot;
      drawerOpen = !(slot === key && drawerOpen);
      slot = key;
      draw();
      return;
    }
    const gearBtn = event.target.closest("[data-cw-gear]");
    if (gearBtn && slot) {
      const id = gearBtn.dataset.cwGear;
      const { wallet, rpg, ch } = rpgState();
      if (!id) { DB.saveRpg(equip(rpg, slot, null)); changed(); return; }
      const g = GEAR[id];
      if (!ownsGear(id)) {
        if (!canWear(g, ch.level, ch.cls.chain) || wallet.balance < g.price) return;
        DB.addPurchase({ id: gearTag(id), price: g.price, at: Date.now() });
        showToast(fill(t.bought, { name: gearName(id, L) }));
      }
      DB.saveRpg(equip(rpgState().rpg, slot, rpg.gear?.[slot] === id ? null : id));
      changed();
      return;
    }
    const bgBtn = event.target.closest("[data-cw-bg]");
    if (bgBtn) {
      const bg = COSMETIC_BACKGROUNDS.find(b => b.id === bgBtn.dataset.cwBg);
      if (!ownsLook(bg.id, bg.price)) {
        if (Shop.wallet().balance < bg.price) return;
        DB.addPurchase({ id: lookTag(bg.id), price: bg.price, at: Date.now() });
        showToast(fill(t.bought, { name: bg[L] }));
      }
      saveLook({ bg: bg.id });
      changed();
      return;
    }
    const colorBtn = event.target.closest("[data-cw-color]");
    if (colorBtn) {
      const [key, id, priceKey] = colorBtn.dataset.cwColor.split("|");
      if (priceKey && !Shop.owned(priceKey, id)) {
        if (!Shop.buy(priceKey, id)) return; // pas assez de points spé
        showToast(fill(t.bought, { name: id }));
      }
      saveLook({ [key]: id });
      changed();
      return;
    }
    const faceBtn = event.target.closest("[data-cw-face]");
    if (faceBtn) {
      const [key, opt] = faceBtn.dataset.cwFace.split("|");
      saveLook({ [key]: opt });
      changed();
      return;
    }
    const lookBtn = event.target.closest("[data-cw-look]");
    if (lookBtn) {
      const [key, id] = lookBtn.dataset.cwLook.split("|");
      const item = cosmeticById(id);
      if (item && !ownsLook(item.id, item.price)) {
        if (Shop.wallet().balance < item.price) return;
        DB.addPurchase({ id: lookTag(item.id), price: item.price, at: Date.now() });
      }
      saveLook({ [key]: id || null });
      changed();
    }
  });

  draw();
}
