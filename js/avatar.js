/* ═══════════════════════════════════════════════════════════
   Avatar : petite config JSON → dessin SVG façon sticker, et l'éditeur.
   Config : { v, skin, face, body, hair, hairColor, eyes, eyeColor, nose, mouth, beard, accessory, bg }
   Chaque valeur est l'identifiant d'une pièce de js/avatar-parts.js.
   Les pièces sont des calques PNG ; les zones de peau, de cheveux et d'iris
   sont recoloriées à l'affichage (masque SVG rempli de la couleur choisie).
   ═══════════════════════════════════════════════════════════ */
import { i18n } from "./i18n.js?v=20261030b";
import { escapeHtml, showToast } from "./utils.js?v=20261030b";
import {
  SKINS, HAIR_COLORS, EYE_COLORS, BACKGROUNDS,
  FACES, BODIES, HAIRS, EYES, NOSES, MOUTHS, BEARDS, ACCESSORIES,
  AVATAR_CATEGORIES, LAYER_ORDER, TINTS
} from "./avatar-parts.js?v=20261030b";

const LISTS = {
  skin: SKINS, face: FACES, body: BODIES, hair: HAIRS, hairColor: HAIR_COLORS, eyes: EYES, eyeColor: EYE_COLORS,
  nose: NOSES, mouth: MOUTHS, beard: BEARDS, accessory: ACCESSORIES, bg: BACKGROUNDS
};
export const AVATAR_KEYS = Object.keys(LISTS);
const ART_BASE = new URL("../assets/avatar/", import.meta.url).href;

const t = (key, vars) => i18n.t(key, vars);
const pick = (list, id) => list.find(item => item.id === id) || list[0];

// anciennes pièces dessinées en SVG (avatar v1) → pièce dessinée la plus proche
const LEGACY = {
  hair: { rase: "c3", court: "c3", boucles: "c7", meche: "c2", herisse: "c6", afro: "c7", chignon: "c4", queue: "c4", long: "c5", carre: "c8" },
  eyes: { grands: "y4", points: "y1", joyeux: "y5", clin: "y5", determine: "y9", zen: "y2" },
  mouth: { sourire: "m2", rire: "m6", neutre: "m1", langue: "m8", effort: "m9", souffle: "m8", malin: "m7" },
  beard: { "trois-jours": "x4", barbe: "x3", moustache: "x1", bouc: "x2" },
  accessory: { lunettes: "l1" }
};

/** Toujours une config complète et valide (valeurs inconnues → première pièce) */
export function normalizeAvatar(config) {
  const out = { v: 2 };
  for (const key of AVATAR_KEYS) {
    const value = config?.[key];
    out[key] = pick(LISTS[key], LEGACY[key]?.[value] ?? value).id;
  }
  return out;
}

export function isAvatar(config) {
  return !!config && typeof config === "object" && AVATAR_KEYS.some(key => config[key]);
}

/**
 * Boutique (branchée par shop.js) : certaines pièces se débloquent avec les flammes.
 * Sans branchement, tout est libre (avatars des potes, banc d'essai).
 */
export const AvatarLocks = {
  priceOf: () => 0,
  owned: () => true,
  balance: () => 0,
  buy: () => false
};
const isLocked = (key, id) => AvatarLocks.priceOf(key, id) > 0 && !AvatarLocks.owned(key, id);

/** Pièces verrouillées dans une config : à débloquer avant d'enregistrer */
export function lockedParts(config) {
  return AVATAR_KEYS.filter(key => isLocked(key, config?.[key]))
    .map(key => ({ key, id: config[key], price: AvatarLocks.priceOf(key, config[key]) }));
}

/** Tirage au sort, avec des probabilités qui donnent des têtes crédibles ; allow(clé, id) filtre les pièces permises */
export function randomAvatar(rand = Math.random, allow = () => true) {
  const ok = (key, list) => { const kept = list.filter(item => allow(key, item.id)); return kept.length ? kept : list.slice(0, 1); };
  const any = (key, list) => { const kept = ok(key, list); return kept[Math.floor(rand() * kept.length)].id; };
  const drawn = (key, list) => any(key, list.filter(item => item.art));
  return normalizeAvatar({
    skin: any("skin", SKINS),
    face: any("face", FACES),
    body: any("body", BODIES),
    hair: rand() < 0.05 ? "chauve" : drawn("hair", HAIRS),
    hairColor: rand() < 0.85 ? HAIR_COLORS[Math.floor(rand() * 6)].id : any("hairColor", HAIR_COLORS),
    eyes: any("eyes", EYES),
    eyeColor: any("eyeColor", EYE_COLORS),
    nose: any("nose", NOSES),
    mouth: any("mouth", MOUTHS),
    beard: rand() < 0.65 ? "aucune" : drawn("beard", BEARDS),
    accessory: rand() < 0.75 ? "aucun" : drawn("accessory", ACCESSORIES),
    bg: any("bg", BACKGROUNDS)
  });
}

/** Tirage au sort parmi les pièces déjà à soi */
export const randomOwnedAvatar = () => randomAvatar(Math.random, (key, id) => !isLocked(key, id));

let seq = 0;
const FLAME_MINI = `<svg class="ave-flame" viewBox="0 0 24 24" aria-hidden="true"><use href="#flame-icon"/></svg>`;

/**
 * Dessin SVG d'un avatar.
 * - size : taille affichée en px
 * - label : texte alternatif ; vide = décoratif (le nom est écrit à côté)
 * - view : cadrage (viewBox), pour les vignettes de l'éditeur
 * - frame : disque de couleur + bord blanc découpé (sticker)
 */
export function avatarSvg(config, { size = 40, label = "", view = "0 0 100 100", frame = true, className = "" } = {}) {
  const a = normalizeAvatar(config);
  const id = `av${++seq}`;
  const colors = {
    skin: pick(SKINS, a.skin).color,
    hairColor: pick(HAIR_COLORS, a.hairColor).color,
    eyeColor: pick(EYE_COLORS, a.eyeColor).color,
    bg: pick(BACKGROUNDS, a.bg).color
  };
  let defs = "", body = "";
  for (const category of LAYER_ORDER) {
    const part = pick(LISTS[category], a[category]);
    if (!part.art) continue;
    const [x, y, w, h] = part.art.box;
    const at = `x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"`;
    for (const layer of part.art.layers) {
      const href = `${ART_BASE}${category}-${part.id}-${layer}.png`;
      if (layer === "base") { body += `<image href="${href}" ${at}/>`; continue; }
      // zone à colorier : le PNG sert de masque à un aplat de la couleur choisie
      const maskId = `${id}-${category}-${layer}`;
      defs += `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}"><image href="${href}" ${at}/></mask>`;
      body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${colors[TINTS[layer]]}" mask="url(#${maskId})"/>`;
    }
  }
  const a11y = label ? `role="img" aria-label="${escapeHtml(label)}"` : `aria-hidden="true"`;
  if (frame) defs += `<clipPath id="${id}-c"><circle cx="50" cy="50" r="46.6"/></clipPath>`;
  const inner = frame
    // dans le rond : la tête et le haut des épaules, cadrés pour que le visage se lise même en petit
    ? `<circle cx="50" cy="50" r="46.6" fill="${colors.bg}"/><g clip-path="url(#${id}-c)"><g transform="translate(50 50) scale(1.04) translate(-50 -53)">${body}</g></g><circle cx="50" cy="50" r="48" fill="none" stroke="#fff" stroke-width="3.6"/>`
    : body;
  return `<svg class="av${className ? ` ${className}` : ""}" viewBox="${view}" width="${size}" height="${size}" focusable="false" ${a11y}><defs>${defs}</defs>${inner}</svg>`;
}

/* ═══════════════════════════════════════════════════════════
   Éditeur : onglets (visage, coiffure, yeux…), aperçu en direct, « au hasard ».
   ═══════════════════════════════════════════════════════════ */
// onglets : chaque onglet regroupe une forme et, si besoin, sa couleur (affichée en premier)
const TABS = [
  { key: "face", fields: ["skin", "face"] },
  { key: "hair", fields: ["hairColor", "hair"] },
  { key: "eyes", fields: ["eyeColor", "eyes"] },
  { key: "nose", fields: ["nose"] },
  { key: "mouth", fields: ["mouth"] },
  { key: "beard", fields: ["hairColor", "beard"] },
  { key: "body", fields: ["skin", "body"] },
  { key: "accessory", fields: ["accessory"] },
  { key: "bg", fields: ["bg"] }
];
const CATEGORY = Object.fromEntries(AVATAR_CATEGORIES.map(cat => [cat.key, cat]));
const partLabel = (key, id) => t(`avatarParts.${key}.${id}`);
const capFirst = text => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);
const partName = (key, id) => capFirst(partLabel(key, id));
const DICE = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="8.5" cy="8.5" r="1.4"/><circle cx="15.5" cy="15.5" r="1.4"/><circle cx="15.5" cy="8.5" r="1.4"/><circle cx="8.5" cy="15.5" r="1.4"/><circle cx="12" cy="12" r="1.4"/></svg>`;
let editorSeq = 0;

/**
 * Monte l'éditeur dans `root`. Renvoie { getValue, destroy }.
 * onChange(config) est appelé à chaque modification.
 */
const LOCK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>`;

export function mountAvatarEditor(root, { initial, onChange } = {}) {
  const uidPrefix = `ave${++editorSeq}`;
  let value = normalizeAvatar(isAvatar(initial) ? initial : randomOwnedAvatar());
  let confirming = null; // pièce dont le déblocage attend une confirmation
  let tab = 0;
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.innerHTML = `
    <div class="ave">
      <div class="ave-stage">
        <p class="ave-wallet" data-ave-wallet></p>
        <div class="ave-preview" data-ave-preview></div>
        <button type="button" class="ave-dice" data-ave-dice aria-label="${escapeHtml(t("avatarRandom"))}">${DICE}<span>${escapeHtml(t("avatarRandom"))}</span></button>
      </div>
      <p class="ave-current" data-ave-current aria-live="polite"></p>
      <div class="ave-lockbar" data-ave-lockbar hidden></div>
      <div class="ave-tabs" role="tablist" aria-label="${escapeHtml(t("avatarParts.title"))}">
        ${TABS.map((item, i) => `<button type="button" role="tab" class="ave-tab" id="${uidPrefix}-tab-${i}" aria-controls="${uidPrefix}-panel" data-ave-tab="${i}">${escapeHtml(t(`avatarTab.${item.key}`))}</button>`).join("")}
      </div>
      <div class="ave-panel" id="${uidPrefix}-panel" role="tabpanel" data-ave-panel></div>
    </div>`;

  const $ = sel => root.querySelector(sel);
  const preview = $("[data-ave-preview]");
  const current = $("[data-ave-current]");
  const lockbar = $("[data-ave-lockbar]");
  const wallet = $("[data-ave-wallet]");

  /** Réserve de flammes + barre « débloquer » quand on essaie une pièce verrouillée */
  function renderLocks() {
    const priced = AVATAR_KEYS.some(key => LISTS[key].some(item => AvatarLocks.priceOf(key, item.id) > 0));
    wallet.hidden = !priced;
    if (priced) wallet.innerHTML = `${FLAME_MINI}<b>${AvatarLocks.balance()}</b><span class="sr-only"> ${escapeHtml(t("shopFlames"))}</span>`;
    const locked = lockedParts(value);
    lockbar.hidden = !locked.length;
    if (!locked.length) { confirming = null; return; }
    const item = locked[0];
    const name = partName(item.key, item.id);
    const missing = item.price - AvatarLocks.balance();
    const tag = `${item.key}:${item.id}`;
    lockbar.innerHTML = `
      <p class="ave-lock-text">${LOCK_SVG}<span>${escapeHtml(t("shopTryOn", { name }))}</span></p>
      ${missing > 0
        ? `<p class="ave-lock-missing">${escapeHtml(t("shopMissing", { count: missing }))}</p>`
        : `<button type="button" class="btn btn-primary btn-sm ave-unlock" data-ave-unlock="${escapeHtml(tag)}">${escapeHtml(t(confirming === tag ? "shopConfirm" : "shopUnlock", { price: item.price }))}</button>`}`;
  }

  function renderPreview(animate) {
    preview.innerHTML = avatarSvg(value, { size: 168, label: t("avatarPreview") });
    if (animate && !reduced()) {
      preview.classList.remove("is-pop");
      void preview.offsetWidth;
      preview.classList.add("is-pop");
    }
  }

  function describe() {
    const fields = TABS[tab].fields;
    const shape = fields[fields.length - 1];
    const parts = fields.length > 1 ? [partLabel(shape, value[shape]), partLabel(fields[0], value[fields[0]])] : [partLabel(shape, value[shape])];
    current.textContent = capFirst(parts.join(" · "));
  }

  function fieldHtml(key) {
    const cat = CATEGORY[key];
    const name = `${uidPrefix}-${key}`;
    const options = cat.items.map(item => {
      const checked = value[key] === item.id ? " checked" : "";
      const label = escapeHtml(partLabel(key, item.id));
      const locked = isLocked(key, item.id);
      const price = AvatarLocks.priceOf(key, item.id);
      const visual = cat.kind === "color"
        ? `<span class="ave-swatch" style="--c:${item.color}"></span>`
        : `<span class="ave-thumb">${avatarSvg({ ...value, [key]: item.id }, { size: 64, view: cat.view, frame: false })}</span>`;
      const badge = locked ? `<span class="ave-lock" aria-hidden="true">${LOCK_SVG}${price}</span>` : "";
      const sr = locked ? `, ${escapeHtml(t("shopLockedSr", { price }))}` : "";
      return `<label class="ave-opt ave-opt-${cat.kind}${locked ? " is-locked" : ""}" title="${label}${locked ? ` · ${price}` : ""}"><input type="radio" name="${name}" value="${item.id}" data-ave-key="${key}"${checked}>${visual}${badge}<span class="sr-only">${label}${sr}</span></label>`;
    }).join("");
    return `<fieldset class="ave-field ave-field-${cat.kind}"><legend class="ave-legend">${escapeHtml(t(`avatarField.${key}`))}</legend><div class="ave-grid">${options}</div></fieldset>`;
  }

  function renderPanel() {
    root.querySelectorAll("[data-ave-tab]").forEach((btn, i) => {
      const on = i === tab;
      btn.setAttribute("aria-selected", String(on));
      btn.tabIndex = on ? 0 : -1;
    });
    const panel = $("[data-ave-panel]");
    panel.setAttribute("aria-labelledby", `${uidPrefix}-tab-${tab}`);
    panel.innerHTML = TABS[tab].fields.map(fieldHtml).join("");
    describe();
  }

  /** vignettes de formes redessinées quand une couleur change (même onglet) */
  function refreshThumbs() {
    root.querySelectorAll(".ave-field-shape input").forEach(input => {
      const key = input.dataset.aveKey;
      const thumb = input.nextElementSibling;
      thumb.innerHTML = avatarSvg({ ...value, [key]: input.value }, { size: 64, view: CATEGORY[key].view, frame: false });
    });
  }

  function set(next, animate = true) {
    value = normalizeAvatar(next);
    renderPreview(animate);
    renderLocks();
    onChange?.(value);
  }

  root.addEventListener("change", event => {
    const input = event.target.closest("[data-ave-key]");
    if (!input) return;
    // changement direct, sans animation : on peut parcourir les choix aux flèches sans attendre
    set({ ...value, [input.dataset.aveKey]: input.value }, false);
    if (CATEGORY[input.dataset.aveKey].kind === "color") refreshThumbs();
    describe();
  });

  root.addEventListener("click", event => {
    const tabBtn = event.target.closest("[data-ave-tab]");
    if (tabBtn) { tab = Number(tabBtn.dataset.aveTab); renderPanel(); tabBtn.scrollIntoView({ block: "nearest", inline: "nearest" }); return; }
    const unlock = event.target.closest("[data-ave-unlock]");
    if (unlock) {
      const tag = unlock.dataset.aveUnlock;
      // deux temps : un premier toucher demande confirmation, le second dépense
      if (confirming !== tag) { confirming = tag; renderLocks(); lockbar.querySelector("[data-ave-unlock]")?.focus(); return; }
      const [key, id] = tag.split(":");
      Promise.resolve(AvatarLocks.buy(key, id)).then(ok => {
        confirming = null;
        if (ok) { showToast(t("shopUnlocked", { name: partName(key, id) })); renderPanel(); }
        renderLocks();
      });
      return;
    }
    if (event.target.closest("[data-ave-dice]")) {
      set(randomOwnedAvatar());
      renderPanel();
      const dice = $("[data-ave-dice] svg");
      if (dice && !reduced()) { dice.classList.remove("is-roll"); void dice.offsetWidth; dice.classList.add("is-roll"); }
    }
  });

  // flèches gauche / droite entre les onglets (modèle ARIA « tabs »)
  root.querySelector(".ave-tabs").addEventListener("keydown", event => {
    const keys = { ArrowRight: 1, ArrowLeft: -1, Home: "first", End: "last" };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const move = keys[event.key];
    tab = move === "first" ? 0 : move === "last" ? TABS.length - 1 : (tab + move + TABS.length) % TABS.length;
    renderPanel();
    const btn = root.querySelector(`[data-ave-tab="${tab}"]`);
    btn.focus();
    btn.scrollIntoView({ block: "nearest", inline: "nearest" });
  });

  renderPreview(false);
  renderPanel();
  renderLocks();
  return {
    getValue: () => ({ ...value }),
    /** pièces encore verrouillées dans l'avatar choisi */
    locked: () => lockedParts(value),
    showLocks: () => { renderLocks(); lockbar.scrollIntoView({ block: "center", behavior: "smooth" }); },
    focus: () => root.querySelector(`[data-ave-tab="${tab}"]`)?.focus(),
    destroy: () => { root.innerHTML = ""; }
  };
}

/**
 * Éditeur plein écran. onSave(config) peut renvoyer une promesse :
 * l'écran se ferme quand elle aboutit, reste ouvert si elle échoue.
 */
export function openAvatarEditor({ initial, title = t("avatarTitle"), saveLabel = t("avatarSave"), onSave } = {}) {
  document.querySelector(".tl-sheet")?.remove();
  const opener = document.activeElement;
  const sheet = document.createElement("div");
  sheet.className = "tl-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "ave-sheet-title");
  sheet.innerHTML = `
    <div class="tl-sheet-inner">
      <div class="tl-sheet-head">
        <h2 id="ave-sheet-title" class="tl-sheet-title" tabindex="-1">${escapeHtml(title)}</h2>
        <button type="button" class="icon-btn" data-ave-close aria-label="${escapeHtml(t("close"))}">✕</button>
      </div>
      <div data-ave-root></div>
    </div>
    <div class="tl-dock">
      <button type="button" class="btn btn-primary btn-block" data-ave-save>${escapeHtml(saveLabel)}</button>
    </div>`;
  document.body.appendChild(sheet);
  document.documentElement.classList.add("ob-open");
  const editor = mountAvatarEditor(sheet.querySelector("[data-ave-root]"), { initial });

  const close = () => {
    sheet.remove();
    document.documentElement.classList.remove("ob-open");
    document.removeEventListener("keydown", onKey);
    opener?.focus?.();
  };
  const onKey = event => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  sheet.querySelector("[data-ave-close]").addEventListener("click", close);
  const saveBtn = sheet.querySelector("[data-ave-save]");
  saveBtn.addEventListener("click", async () => {
    // une pièce essayée mais pas encore débloquée : on le dit au lieu d'enregistrer
    const locked = editor.locked();
    if (locked.length) {
      editor.showLocks();
      showToast(t("shopUnlockFirst", { name: partName(locked[0].key, locked[0].id), price: locked[0].price }));
      return;
    }
    saveBtn.disabled = true;
    try {
      await onSave?.(editor.getValue());
      close();
    } catch {
      saveBtn.disabled = false;
    }
  });
  editor.focus();
  return { close };
}
