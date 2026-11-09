/* ═══════════════════════════════════════════════════════════
   Modifier une séance passée : corriger les répétitions et les
   charges, ajouter une série oubliée, retirer une série en trop.
   Rien n'est enregistré avant « Enregistrer ».
   ═══════════════════════════════════════════════════════════ */
import { i18n } from "./i18n.js?v=20261104i";
import { openSheet, esc } from "./potes-ui.js?v=20261104i";

const TEXT = {
  fr: {
    kicker: "Modifier la séance", set: "Série {n}", drop: "Sec.", reps: "rép.", seconds: "s",
    repsOf: "Répétitions de la série {n}", secondsOf: "Secondes de la série {n}", weightOf: "Charge de la série {n} en kg",
    remove: "Retirer la série {n}", add: "Ajouter une série", none: "Aucune série notée.",
    save: "Enregistrer", cancel: "Annuler", close: "Fermer"
  },
  en: {
    kicker: "Edit workout", set: "Set {n}", drop: "Drop", reps: "reps", seconds: "s",
    repsOf: "Reps of set {n}", secondsOf: "Seconds of set {n}", weightOf: "Weight of set {n} in kg",
    remove: "Remove set {n}", add: "Add a set", none: "No set logged.",
    save: "Save", cancel: "Cancel", close: "Close"
  }
};
const T = () => TEXT[i18n.getLanguage() === "en" ? "en" : "fr"];
const fill = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
const toNum = value => { const n = Number(String(value).replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : 0; };

/**
 * opts : { log, title, nameOf(exerciseId, fallback), isTimed(exerciseId), onSave(log) }
 * Seules les séries faites sont montrées ; les séries passées ou pas faites restent telles quelles.
 */
export function openLogEditor({ log, title, nameOf, isTimed, onSave }) {
  const draft = JSON.parse(JSON.stringify(log));
  const { sheet, close } = openSheet();
  sheet.classList.add("le");

  const row = (ex, e, set, s, n, timed) => `
    <div class="le-set">
      <span class="le-n">${esc(set.kind === "drop" ? T().drop : fill(T().set, { n }))}</span>
      <input class="input le-input" type="number" inputmode="numeric" min="0" step="1" value="${esc(set.reps)}" data-le="${e}:${s}:reps" aria-label="${esc(fill(timed ? T().secondsOf : T().repsOf, { n }))}">
      <span class="le-unit">${esc(timed ? T().seconds : T().reps)}</span>
      <span class="le-x" aria-hidden="true">×</span>
      <input class="input le-input" type="number" inputmode="decimal" min="0" step="0.5" value="${esc(set.weight)}" data-le="${e}:${s}:weight" aria-label="${esc(fill(T().weightOf, { n }))}">
      <span class="le-unit">kg</span>
      <button type="button" class="icon-btn le-remove" data-le-remove="${e}:${s}" aria-label="${esc(fill(T().remove, { n }))}">✕</button>
    </div>`;

  const draw = focus => {
    const t = T();
    const top = sheet.scrollTop;
    sheet.innerHTML = `
      <div class="tl-sheet-inner le-wrap">
        <div class="tl-sheet-head">
          <div><p class="tl-sheet-step">${esc(t.kicker)}</p><h2 id="tl-sheet-title" class="tl-sheet-title" tabindex="-1">${esc(title)}</h2></div>
          <button type="button" class="icon-btn" data-sheet-close aria-label="${esc(t.close)}">✕</button>
        </div>
        ${(draft.exercises || []).map((ex, e) => {
          const timed = isTimed(ex.exerciseId);
          let n = 0;
          const rows = (ex.sets || []).map((set, s) => (set.status === "done" ? row(ex, e, set, s, ++n, timed) : "")).join("");
          return `<section class="card le-ex">
            <h3 class="le-name">${esc(nameOf(ex.exerciseId, ex.exerciseName))}</h3>
            ${rows || `<p class="le-none">${esc(t.none)}</p>`}
            <button type="button" class="btn btn-ghost btn-sm le-add" data-le-add="${e}">+ ${esc(t.add)}</button>
          </section>`;
        }).join("")}
        <div class="le-dock">
          <button type="button" class="btn btn-surface" data-sheet-close>${esc(t.cancel)}</button>
          <button type="button" class="btn btn-primary" data-le-save>${esc(t.save)}</button>
        </div>
      </div>`;
    sheet.scrollTop = top;
    if (focus) sheet.querySelector(focus)?.focus();
    else sheet.querySelector("#tl-sheet-title")?.focus();
  };

  sheet.addEventListener("change", event => {
    const input = event.target.closest("[data-le]");
    if (!input) return;
    const [e, s, field] = input.dataset.le.split(":");
    const set = draft.exercises[Number(e)]?.sets?.[Number(s)];
    if (!set) return;
    set[field] = toNum(input.value);
    if (field === "reps" && set.targetReps == null) set.targetReps = set.reps;
    input.value = set[field];
  });

  sheet.addEventListener("click", event => {
    const add = event.target.closest("[data-le-add]");
    if (add) {
      const e = Number(add.dataset.leAdd);
      const ex = draft.exercises[e];
      ex.sets = ex.sets || [];
      // la nouvelle série reprend la dernière série faite (à corriger si besoin)
      const done = ex.sets.filter(set => set.status === "done");
      const model = done[done.length - 1] || {};
      const reps = toNum(model.reps ?? model.targetReps);
      let at = -1;
      ex.sets.forEach((set, i) => { if (set.status === "done") at = i; });
      ex.sets.splice(at + 1, 0, { targetReps: reps, reps, weight: toNum(model.weight), status: "done" });
      draw(`[data-le="${e}:${at + 1}:reps"]`);
      return;
    }
    const remove = event.target.closest("[data-le-remove]");
    if (remove) {
      const [e, s] = remove.dataset.leRemove.split(":").map(Number);
      draft.exercises[e].sets.splice(s, 1);
      draw(`[data-le-add="${e}"]`);
      return;
    }
    if (event.target.closest("[data-le-save]")) {
      // les champs encore en cours de saisie comptent aussi
      sheet.querySelectorAll("[data-le]").forEach(input => {
        const [e, s, field] = input.dataset.le.split(":");
        const set = draft.exercises[Number(e)]?.sets?.[Number(s)];
        if (set) set[field] = toNum(input.value);
      });
      onSave(draft);
      close(true);
    }
  });

  draw();
}
