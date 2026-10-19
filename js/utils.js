import { i18n } from "./i18n.js?v=20261019c";

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
export function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

export function showLoading(visible) {
  const overlay = $("#loading-overlay");
  if (!overlay) return;
  overlay.classList.toggle("hidden", !visible);
}

export function openModal(id) {
  const modal = typeof id === "string" ? document.getElementById(id) : id;
  if (modal) modal.classList.remove("hidden");
}

export function closeModal(id) {
  const modal = typeof id === "string" ? document.getElementById(id) : id;
  if (modal) modal.classList.add("hidden");
}

// Photos libres de droits (free-exercise-db, licence Unlicense) servies par jsDelivr.
// Chaque exercice a deux photos : 0.jpg (position de départ) et 1.jpg (position finale).
const FREE_EXERCISE_DB_CDN = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises";

export function getExerciseIllustration(exercise) {
  if (!exercise) return null;
  const folder = exercise.image_folder;
  if (folder && !folder.startsWith("wger_")) {
    const base = `${FREE_EXERCISE_DB_CDN}/${encodeURIComponent(folder)}`;
    return { start: `${base}/0.jpg`, end: `${base}/1.jpg` };
  }
  if (exercise.wger_image) return { start: exercise.wger_image, end: null };
  return null;
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

export function getExerciseImagePaths(exercise) {
  const folder = exercise?.image_folder || exercise?.id || slugify(exercise?.name || "exercise");
  // Candidats: image_folder original, puis id en lowercase
  const candidates = [folder];
  if (exercise?.id && exercise.id !== folder) candidates.push(exercise.id);

  const start = exercise?.wger_image || `./exercises/${folder}/0.jpg`;
  const end = `./exercises/${folder}/1.jpg`;
  return { folder, candidates, start, end, gifUrl: exercise?.gifUrl || null };
}

export function fallbackImage() {
  const label = i18n.getLanguage() === "en" ? "image unavailable" : "image absente";
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="100%" height="100%" fill="#1b1b29"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6e6e88" font-family="-apple-system, Segoe UI, Arial" font-size="26">${label}</text></svg>`);
}

/**
 * Charge une image en testant plusieurs chemins possibles.
 * Retourne un <img> fonctionnel ou le fallback SVG.
 * Si l'exercice a un gifUrl (ExerciseDB), il est prioritaire.
 */
export function loadExerciseImage(exercise, position = "start") {
  const fb = fallbackImage();
  if (!exercise) return { urls: [], fallback: fb, gifUrl: null };

  const folder = exercise.image_folder || exercise.id || slugify(exercise.name || "exercise");
  const folders = [folder];
  if (exercise.id && exercise.id !== folder) folders.push(exercise.id);

  const fileNames = position === "start"
    ? ["0.jpg", "0.png", "0.webp", "start.jpg", "start.png"]
    : ["1.jpg", "1.png", "1.webp", "end.jpg", "end.png"];

  // Construire toutes les urls candidates
  const urls = [];

  // Source principale : free-exercise-db via CDN
  const illu = getExerciseIllustration(exercise);
  const cdnUrl = illu && (position === "start" ? illu.start : illu.end);
  if (cdnUrl) urls.push(cdnUrl);

  // Puis l'image wger externe éventuelle
  if (exercise.wger_image) {
    urls.push(exercise.wger_image);
  }

  for (const f of folders) {
    for (const name of fileNames) {
      urls.push(`./exercises/${f}/${name}`);
    }
  }

  return { urls, fallback: fb, gifUrl: exercise.gifUrl || null };
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
      console.warn(`[TrackLift] aucune image trouvee, essais: ${urls.join(", ")}`);
      imgElement.src = fb;
      return;
    }
    imgElement.src = urls[idx];
    idx++;
  }
  imgElement.onerror = tryNext;
  tryNext();
}
