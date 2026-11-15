/* ═══════════════════════════════════════════════════════════
   Nouveautés : à l'ouverture de l'appli, une fenêtre annonce la mise à jour
   (une seule fois par mise à jour et par téléphone). La plus récente en tête.
   ═══════════════════════════════════════════════════════════ */
import { i18n } from "./i18n.js?v=20261115a";
import { openSheet, esc, reducedMotion } from "./potes-ui.js?v=20261115a";

export const PATCHES = [
  {
    id: "2026-11-15",
    fr: {
      title: "Séances plus souples",
      items: [
        "Ajoute un exercice en pleine séance (Vue d'ensemble › Ajouter un exercice).",
        "Change d'exercice pour n'importe lequel, pas seulement un similaire : cherche-le par son nom.",
        "Enchaîne deux exercices (superset) : une série de l'un, une série de l'autre, le repos après le second.",
        "Séance passée : ajoute un exercice oublié en plus des séries (Modifier la séance).",
        "Tes changements du jour ne modifient plus le programme : la fois suivante, l'appli te propose de les reprendre.",
        "Corrigé : quitter une séance en cours (profil, autre onglet) ne la fait plus disparaître. Un bandeau permet d'y revenir.",
        "Nouveau : la Boîte à idées dans le menu du profil. Dis-nous ce qui manque !"
      ]
    },
    en: {
      title: "More flexible workouts",
      items: [
        "Add an exercise in the middle of a workout (Overview › Add an exercise).",
        "Swap to any exercise, not only a similar one: search it by name.",
        "Chain two exercises (superset): one set of each, rest after the second.",
        "Past workout: add a forgotten exercise, not just sets (Edit this workout).",
        "Today's changes no longer modify your program: next time, the app offers to keep them.",
        "Fixed: leaving a running workout (profile, another tab) no longer makes it disappear. A banner brings you back.",
        "New: the Idea box in the profile menu. Tell us what's missing!"
      ]
    }
  }
];

const SEEN_KEY = "tl-patch-seen";
const TEXT = { fr: { kicker: "Mise à jour", ok: "C'est noté", close: "Fermer" }, en: { kicker: "Update", ok: "Got it", close: "Close" } };

/** À l'ouverture : montre la dernière mise à jour si elle n'a pas encore été vue sur ce téléphone */
export function maybeShowPatchNotes({ firstVisit = false } = {}) {
  const latest = PATCHES[0];
  let seen = null;
  try { seen = localStorage.getItem(SEEN_KEY); } catch { /* stockage indisponible */ }
  if (seen === latest.id) return false;
  const remember = () => { try { localStorage.setItem(SEEN_KEY, latest.id); } catch { /* rien */ } };
  // un nouveau compte n'a rien à « découvrir » : on note la version sans rien montrer
  if (firstVisit) { remember(); return false; }
  const L = i18n.getLanguage() === "en" ? "en" : "fr";
  const t = TEXT[L];
  const note = latest[L];
  const { sheet, close } = openSheet({ small: true, onClose: remember });
  sheet.classList.add("pn");
  sheet.innerHTML = `
    <div class="tl-sheet-inner pn-card${reducedMotion() ? "" : " is-pop"}">
      <div class="tl-sheet-head">
        <div><p class="tl-sheet-step">${esc(t.kicker)}</p><h2 id="tl-sheet-title" class="tl-sheet-title" tabindex="-1">${esc(note.title)}</h2></div>
        <button type="button" class="icon-btn" data-sheet-close aria-label="${esc(t.close)}">✕</button>
      </div>
      <ul class="pn-list">${note.items.map(item => `<li>${esc(item)}</li>`).join("")}</ul>
      <button type="button" class="btn btn-primary btn-block" data-pn-ok>${esc(t.ok)}</button>
    </div>`;
  sheet.querySelector("#tl-sheet-title")?.focus();
  sheet.querySelector("[data-pn-ok]").addEventListener("click", () => close());
  return true;
}
