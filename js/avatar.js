/* ═══════════════════════════════════════════════════════════
   Avatar : petite config JSON → dessin SVG façon sticker, et l'éditeur.
   Config : { v, skin, hair, hairColor, eyes, mouth, beard, outfit, outfitColor, accessory, bg }
   Chaque valeur est l'identifiant d'une pièce de js/avatar-parts.js.
   ═══════════════════════════════════════════════════════════ */
import { i18n } from "./i18n.js?v=20261027a";
import { escapeHtml } from "./utils.js?v=20261027a";
import {
  INK, FACE, NECK, SKINS, HAIR_COLORS, OUTFIT_COLORS, BACKGROUNDS,
  HAIRS, EYES, MOUTHS, BEARDS, OUTFITS, ACCESSORIES, AVATAR_CATEGORIES, LAYER_ORDER
} from "./avatar-parts.js?v=20261027a";

const LISTS = {
  skin: SKINS, hair: HAIRS, hairColor: HAIR_COLORS, eyes: EYES, mouth: MOUTHS,
  beard: BEARDS, outfit: OUTFITS, outfitColor: OUTFIT_COLORS, accessory: ACCESSORIES, bg: BACKGROUNDS
};
export const AVATAR_KEYS = Object.keys(LISTS);

const t = (key, vars) => i18n.t(key, vars);
const pick = (list, id) => list.find(item => item.id === id) || list[0];

/** Toujours une config complète et valide (valeurs inconnues → première pièce) */
export function normalizeAvatar(config) {
  const out = { v: 1 };
  for (const key of AVATAR_KEYS) out[key] = pick(LISTS[key], config?.[key]).id;
  return out;
}

export function isAvatar(config) {
  return !!config && typeof config === "object" && AVATAR_KEYS.some(key => config[key]);
}

/** Tirage au sort, avec des probabilités qui donnent des têtes crédibles */
export function randomAvatar(rand = Math.random) {
  const any = list => list[Math.floor(rand() * list.length)].id;
  const often = (list, firstChance) => (rand() < firstChance ? list[0].id : list[1 + Math.floor(rand() * (list.length - 1))].id);
  return normalizeAvatar({
    skin: any(SKINS),
    hair: rand() < 0.06 ? "chauve" : HAIRS[1 + Math.floor(rand() * (HAIRS.length - 1))].id,
    hairColor: rand() < 0.85 ? HAIR_COLORS[Math.floor(rand() * 6)].id : any(HAIR_COLORS),
    eyes: any(EYES),
    mouth: any(MOUTHS),
    beard: often(BEARDS, 0.65),
    outfit: any(OUTFITS),
    outfitColor: any(OUTFIT_COLORS),
    accessory: often(ACCESSORIES, 0.45),
    bg: any(BACKGROUNDS)
  });
}

/* ombre franche : la couleur mélangée à un brun chaud */
function shadeOf(hex, amount = 0.17) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c, d) => Math.round(c + (d - c) * amount);
  const r = mix(n >> 16, 0x3b), g = mix((n >> 8) & 255, 0x1d), b = mix(n & 255, 0x10);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

let seq = 0;

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
    hair: pick(HAIR_COLORS, a.hairColor).color,
    outfit: pick(OUTFIT_COLORS, a.outfitColor).color,
    bg: pick(BACKGROUNDS, a.bg).color
  };
  const brush = {
    ...colors,
    /** aplat + ombre à droite + contour */
    shape(d, color, width = 2.4, rule = "nonzero") {
      return `<path d="${d}" fill="${color}" fill-rule="${rule}"/>`
        + `<path d="${d}" fill="${shadeOf(color)}" fill-rule="${rule}" clip-path="url(#${id}-r)"/>`
        + `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
    },
    line(d, width = 2.4) {
      return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  };
  const builtins = {
    "@ears": () => [28.6, 71.4].map(x => brush.shape(`M${x} 47.2 C${x + 2.6} 47.2 ${x + 4.4} 49.8 ${x + 4.4} 53 C${x + 4.4} 56.2 ${x + 2.6} 58.8 ${x} 58.8 C${x - 2.6} 58.8 ${x - 4.4} 56.2 ${x - 4.4} 53 C${x - 4.4} 49.8 ${x - 2.6} 47.2 ${x} 47.2 Z`, colors.skin, 2.2)).join("")
      + brush.line("M29.6 50.4 Q27.4 53 29.6 55.6", 1.5) + brush.line("M70.4 50.4 Q72.6 53 70.4 55.6", 1.5),
    "@face": () => brush.shape(FACE, colors.skin)
      + `<ellipse cx="36.4" cy="60.4" rx="3.6" ry="2.2" fill="#f0806e" opacity="0.32"/><ellipse cx="63.6" cy="60.4" rx="3.6" ry="2.2" fill="#f0806e" opacity="0.32"/>`,
    "@nose": () => brush.line("M50.6 55.4 Q47.6 59.4 50.8 60", 2)
  };
  const layer = (category, name) => {
    const part = pick(LISTS[category], a[category]);
    const png = part.png?.[name];
    if (png) return `<image href="${escapeHtml(png)}" x="0" y="0" width="100" height="100"/>`;
    const draw = part.layers?.[name];
    return draw ? draw(brush) : "";
  };
  let body = "";
  for (const [category, name] of LAYER_ORDER) {
    if (category === "outfit") body += brush.shape(NECK, shadeOf(colors.skin, 0.12), 2.2);
    body += category.startsWith("@") ? builtins[category]() : layer(category, name);
  }
  const a11y = label ? `role="img" aria-label="${escapeHtml(label)}"` : `aria-hidden="true"`;
  const defs = `<defs><clipPath id="${id}-r"><path d="M56.5 0 H120 V120 H63 Z"/></clipPath>`
    + (frame ? `<clipPath id="${id}-c"><circle cx="50" cy="50" r="46.6"/></clipPath>` : "") + `</defs>`;
  const inner = frame
    // dans le rond, le personnage est un peu agrandi pour que le visage se lise même en petit
    ? `<circle cx="50" cy="50" r="46.6" fill="${colors.bg}"/><g clip-path="url(#${id}-c)"><g transform="translate(50 58) scale(1.13) translate(-50 -58)">${body}</g></g><circle cx="50" cy="50" r="48" fill="none" stroke="#fff" stroke-width="3.6"/>`
    : body;
  return `<svg class="av${className ? ` ${className}` : ""}" viewBox="${view}" width="${size}" height="${size}" focusable="false" ${a11y}>${defs}${inner}</svg>`;
}

/* ═══════════════════════════════════════════════════════════
   Éditeur : onglets (peau, coiffure, yeux…), aperçu en direct, « au hasard ».
   ═══════════════════════════════════════════════════════════ */
// onglets : chaque onglet regroupe une forme et, si besoin, sa couleur (affichée en premier)
const TABS = [
  { key: "skin", fields: ["skin"] },
  { key: "hair", fields: ["hairColor", "hair"] },
  { key: "eyes", fields: ["eyes"] },
  { key: "mouth", fields: ["mouth"] },
  { key: "beard", fields: ["hairColor", "beard"] },
  { key: "outfit", fields: ["outfitColor", "outfit"] },
  { key: "accessory", fields: ["accessory"] },
  { key: "bg", fields: ["bg"] }
];
const CATEGORY = Object.fromEntries(AVATAR_CATEGORIES.map(cat => [cat.key, cat]));
const partLabel = (key, id) => t(`avatarParts.${key}.${id}`);
const DICE = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><circle cx="8.5" cy="8.5" r="1.4"/><circle cx="15.5" cy="15.5" r="1.4"/><circle cx="15.5" cy="8.5" r="1.4"/><circle cx="8.5" cy="15.5" r="1.4"/><circle cx="12" cy="12" r="1.4"/></svg>`;
let editorSeq = 0;

/**
 * Monte l'éditeur dans `root`. Renvoie { getValue, destroy }.
 * onChange(config) est appelé à chaque modification.
 */
export function mountAvatarEditor(root, { initial, onChange } = {}) {
  const uidPrefix = `ave${++editorSeq}`;
  let value = normalizeAvatar(isAvatar(initial) ? initial : randomAvatar());
  let tab = 0;
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.innerHTML = `
    <div class="ave">
      <div class="ave-stage">
        <div class="ave-preview" data-ave-preview></div>
        <button type="button" class="ave-dice" data-ave-dice aria-label="${escapeHtml(t("avatarRandom"))}">${DICE}<span>${escapeHtml(t("avatarRandom"))}</span></button>
      </div>
      <p class="ave-current" data-ave-current aria-live="polite"></p>
      <div class="ave-tabs" role="tablist" aria-label="${escapeHtml(t("avatarParts.title"))}">
        ${TABS.map((item, i) => `<button type="button" role="tab" class="ave-tab" id="${uidPrefix}-tab-${i}" aria-controls="${uidPrefix}-panel" data-ave-tab="${i}">${escapeHtml(t(`avatarTab.${item.key}`))}</button>`).join("")}
      </div>
      <div class="ave-panel" id="${uidPrefix}-panel" role="tabpanel" data-ave-panel></div>
    </div>`;

  const $ = sel => root.querySelector(sel);
  const preview = $("[data-ave-preview]");
  const current = $("[data-ave-current]");

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
    current.textContent = parts.join(" · ");
  }

  function fieldHtml(key) {
    const cat = CATEGORY[key];
    const name = `${uidPrefix}-${key}`;
    const options = cat.items.map(item => {
      const checked = value[key] === item.id ? " checked" : "";
      const label = escapeHtml(partLabel(key, item.id));
      const visual = cat.kind === "color"
        ? `<span class="ave-swatch" style="--c:${item.color}"></span>`
        : `<span class="ave-thumb">${avatarSvg({ ...value, [key]: item.id }, { size: 64, view: cat.view, frame: false })}</span>`;
      return `<label class="ave-opt ave-opt-${cat.kind}" title="${label}"><input type="radio" name="${name}" value="${item.id}" data-ave-key="${key}"${checked}>${visual}<span class="sr-only">${label}</span></label>`;
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
    if (event.target.closest("[data-ave-dice]")) {
      set(randomAvatar());
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
  return {
    getValue: () => ({ ...value }),
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
