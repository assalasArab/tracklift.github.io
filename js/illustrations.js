/* ═══════════════════════════════════════════════════════════
   Dessins de l'appli (présentation, création de programme, nutrition).
   Déposer les PNG dans assets/illustrations/ puis ajouter leur nom
   dans ILLU_READY. Tant qu'un nom n'y figure pas, son emplacement
   n'est pas affiché : l'appli ne montre jamais de trou.
   La liste complète des dessins attendus est dans assets/illustrations/README.txt.
   ═══════════════════════════════════════════════════════════ */
export const ILLU_DIR = "assets/illustrations/";
export const ILLU_READY = new Set([
  "intro-01-bienvenue.webp",
  "intro-03-progres.webp",
  "intro-04-flamme.webp",
  "intro-05-nutrition.webp",
  "nutri-01-objectif.webp"
]);

export function illu(file, cls = "illu") {
  if (!file || !ILLU_READY.has(file)) return "";
  return `<figure class="${cls}"><img src="${ILLU_DIR}${file}" alt="" loading="lazy" decoding="async"></figure>`;
}
