/* ═══════════════════════════════════════════════════════════
   Nouveautés : à l'ouverture de l'appli, une fenêtre annonce la mise à jour
   (une seule fois par mise à jour et par téléphone). La plus récente en tête.
   ═══════════════════════════════════════════════════════════ */
import { i18n } from "./i18n.js?v=20261122a";
import { openSheet, esc, reducedMotion } from "./potes-ui.js?v=20261122a";

export const PATCHES = [
  {
    id: "2026-11-22", from: new Date(2026, 10, 22, 0, 0, 0).getTime(),
    fr: {
      title: "Saison 2 !",
      items: [
        "Nouvelle Roue des cadeaux : la Tunique du Héros des Bois, la Tunique du Héros du Temps et la Tenue de la Confrérie sont à gagner.",
        "Nouveau : un emplacement Tête dans Mon héros › Apparence, pour les capuches, casques et chapeaux.",
        "8 tenues d'équipement ont enfin leur propre dessin : Habit sacré, Tenue de l'archimage, Combinaison mécha, Armure de plates, Kimono de combat, Manteau du rôdeur, Armure du titan et Armure de légende.",
        "Les costumes de la saison 1 restent à ceux qui les ont gagnés. Les tours non joués servent pour la saison 2."
      ]
    },
    en: {
      title: "Season 2!",
      items: [
        "New Gift wheel: win the Woodland Hero tunic, the Hero of Time tunic and the Brotherhood attire.",
        "New: a Head slot in My hero › Look, for hoods, helmets and hats.",
        "8 equipment outfits finally have their own drawing: Holy vestment, Archmage attire, Mecha suit, Plate armour, Fighting gi, Prowler's coat, Titan armour and Armour of legend.",
        "Season 1 costumes stay with those who won them. Unplayed spins carry over to season 2."
      ]
    }
  },
  {
    id: "2026-11-19",
    fr: {
      title: "Vos retours, corrigés",
      items: [
        "Les charges proposées suivent la séance : un même exercice en Push et en Upper garde chacun ses poids.",
        "Le minuteur de repos continue de tourner même si tu changes de page ou quittes l'appli. Le bandeau « Séance en cours » l'affiche aussi.",
        "Pesées plus sûres : si l'envoi est coupé (appli fermée trop vite), ta pesée est gardée sur le téléphone et repart à la prochaine ouverture. Ta flamme ne se casse plus pour rien.",
        "Dernière chance pour la Roue des cadeaux : elle part dimanche 22 novembre à minuit. Une nouvelle collection arrive bientôt !",
        "30 nouveaux objets pour ton héros : kettlebell, barre olympique, armes de rang 4 et armes mythiques du niveau 90, armures, ceinture, chrono, plume de phénix…"
      ]
    },
    en: {
      title: "Your feedback, fixed",
      items: [
        "Suggested weights follow the workout: the same exercise in Push and Upper keeps its own weights.",
        "The rest timer keeps running even if you switch pages or leave the app. The “Workout in progress” banner shows it too.",
        "Safer weigh-ins: if sending is cut off (app closed too fast), your weigh-in is kept on the phone and sent the next time you open the app. Your streak no longer breaks for nothing.",
        "Last chance for the Gift wheel: it leaves on Sunday 22 November at midnight. A new collection is coming soon!",
        "30 new items for your hero: kettlebell, Olympic bar, rank 4 weapons and level 90 mythic weapons, armour, lifting belt, stopwatch, phoenix feather…"
      ]
    }
  },
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
  const latest = PATCHES.find(p => !p.from || Date.now() >= p.from);
  if (!latest) return false;
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
