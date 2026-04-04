import { i18n } from "./i18n.js";

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

export function getExerciseImagePaths(exercise) {
  const folder = exercise?.image_folder || exercise?.id || slugify(exercise?.name || "exercise");
  // Candidats: image_folder original, puis id en lowercase
  const candidates = [folder];
  if (exercise?.id && exercise.id !== folder) candidates.push(exercise.id);

  const start = exercise?.wger_image || `./exercises/${folder}/0.jpg`;
  const end = `./exercises/${folder}/1.jpg`;
  return { folder, candidates, start, end };
}

export function fallbackImage() {
  const label = i18n.getLanguage() === "en" ? "image unavailable" : "image absente";
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="100%" height="100%" fill="#1a1a1e"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#686875" font-family="Arial" font-size="26">${label}</text></svg>`);
}

/**
 * Charge une image en testant plusieurs chemins possibles.
 * Retourne un <img> fonctionnel ou le fallback SVG.
 */
export function loadExerciseImage(exercise, position = "start") {
  const fb = fallbackImage();
  if (!exercise) return fb;

  const folder = exercise.image_folder || exercise.id || slugify(exercise.name || "exercise");
  const folders = [folder];
  if (exercise.id && exercise.id !== folder) folders.push(exercise.id);

  const fileNames = position === "start"
    ? ["0.jpg", "0.png", "0.webp", "start.jpg", "start.png"]
    : ["1.jpg", "1.png", "1.webp", "end.jpg", "end.png"];

  // Construire toutes les urls candidates
  const urls = [];

  // Si l'exercice a une image wger externe, la tester en premier
  if (exercise.wger_image) {
    urls.push(exercise.wger_image);
  }

  for (const f of folders) {
    for (const name of fileNames) {
      urls.push(`./exercises/${f}/${name}`);
    }
  }

  // Retourne un data-attribute avec les candidats pour le test en cascade
  return { urls, fallback: fb };
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
