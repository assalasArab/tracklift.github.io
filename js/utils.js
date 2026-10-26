import { i18n } from "./i18n.js?v=20261026e";

export function uid() {
  return Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function formatDate(input, locale = i18n.getLocale()) {
  const date = new Date(input);
  return date.toLocaleDateString(locale, { day: "2-digit", month: "short" });
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function slugify(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

let toastTimer = null;
/** Message bref. Avec `action` ({ label, onClick }), un bouton s'ajoute et le message reste plus longtemps. */
export function showToast(message, action = null) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = "";
  const text = document.createElement("span");
  text.textContent = message;
  toast.appendChild(text);
  toast.classList.toggle("has-action", !!action);
  if (action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-action";
    btn.textContent = action.label;
    btn.addEventListener("click", () => {
      clearTimeout(toastTimer);
      toast.classList.remove("show", "has-action");
      action.onClick();
    }, { once: true });
    toast.appendChild(btn);
  }
  // pendant la séance, le message se pose juste au-dessus des boutons du bas, sous le pouce
  const dock = document.body.classList.contains("in-workout") ? document.querySelector(".guided-dock") : null;
  toast.classList.toggle("toast-low", !!dock);
  toast.style.bottom = dock ? `${Math.round(window.innerHeight - dock.getBoundingClientRect().top + 10)}px` : "";
  toast.classList.add("show");
  const hide = () => toast.classList.remove("show", "has-action");
  const arm = ms => { clearTimeout(toastTimer); toastTimer = setTimeout(hide, ms); };
  arm(action ? 5000 : 2200);
  // tant qu'on touche ou qu'on vise le message, il reste affiché
  toast.onpointerenter = toast.onfocusin = action ? () => clearTimeout(toastTimer) : null;
  toast.onpointerleave = toast.onfocusout = action ? () => arm(2500) : null;
}

export function hideToast() {
  clearTimeout(toastTimer);
  $("#toast")?.classList.remove("show", "has-action");
}

export function showLoading(visible) {
  const overlay = $("#loading-overlay");
  if (!overlay) return;
  overlay.classList.toggle("hidden", !visible);
}

export function openModal(id) {
  const modal = typeof id === "string" ? document.getElementById(id) : id;
  if (!modal) return;
  const card = modal.querySelector(".modal-card, .modal-content");
  if (card && !card.hasAttribute("role")) {
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
  }
  modal.classList.remove("hidden");
}

export function closeModal(id) {
  const modal = typeof id === "string" ? document.getElementById(id) : id;
  if (modal) modal.classList.add("hidden");
}

// Illustrations RepDB (repdb.co) servies depuis assets/exercises :
// "start" + "peak" (positions de départ et d'arrivée) ou une seule image "main".
const EXERCISE_IMG_DIR = "./assets/exercises";
// à changer quand les images sont refaites, pour que les navigateurs oublient les anciennes
const EXERCISE_IMG_VERSION = "olive1";

export function getExerciseIllustration(exercise) {
  const img = exercise?.img;
  if (!img) return null;
  const start = img.start || img.main;
  if (!start) return null;
  const url = file => `${EXERCISE_IMG_DIR}/${file}?c=${EXERCISE_IMG_VERSION}`;
  return { start: url(start), end: img.peak ? url(img.peak) : null };
}

const ILLU_PLACEHOLDER = `<span class="ex-illu-ph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/></svg></span>`;

/** Vignette (thumb, photo de départ seule) ou illustration animée (hero, alterne départ / fin). */
export function illustrationHtml(exercise, size = "thumb") {
  const illu = getExerciseIllustration(exercise);
  const alt = String(exercise?.name || "").replace(/"/g, "&quot;");
  if (!illu) return `<div class="ex-illu ex-illu-${size} ex-illu-missing">${ILLU_PLACEHOLDER}</div>`;
  const animated = size !== "thumb" && illu.end;
  return `<div class="ex-illu ex-illu-${size}${animated ? "" : " ex-illu-static"}">
    <img src="${illu.start}" alt="${alt}" loading="lazy" decoding="async" onerror="this.closest('.ex-illu').classList.add('ex-illu-missing')">
    ${animated ? `<img class="ex-illu-end" src="${illu.end}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ""}
    ${ILLU_PLACEHOLDER}
  </div>`;
}

export function fallbackImage() {
  const label = i18n.getLanguage() === "en" ? "image unavailable" : "image absente";
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="100%" height="100%" fill="#f1ede8"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#a99ca5" font-family="-apple-system, Segoe UI, Arial" font-size="26">${label}</text></svg>`);
}

/** Urls à essayer pour la position de départ ou d'arrivée (l'arrivée retombe sur l'image unique). */
export function loadExerciseImage(exercise, position = "start") {
  const fb = fallbackImage();
  const illu = getExerciseIllustration(exercise);
  const url = illu && (position === "start" ? illu.start : illu.end || illu.start);
  return { urls: url ? [url] : [], fallback: fb, gifUrl: null };
}

/**
 * Applique la logique de test en cascade sur un element <img>.
 * A appeler apres insertion dans le DOM.
 */
export function applyImageFallback(imgElement, urls, fb) {
  if (!imgElement || !urls || urls.length === 0) {
    if (imgElement) imgElement.src = fb;
    return;
  }
  let idx = 0;
  function tryNext() {
    if (idx >= urls.length) {
      imgElement.src = fb;
      return;
    }
    imgElement.src = urls[idx];
    idx++;
  }
  imgElement.onerror = tryNext;
  tryNext();
}
