/* ═══════════════════════════════════════════════════════════
   Vue d'ensemble de la séance (« dézoomer ») : chaque exercice est
   une carte reliée à la suivante, avec ses séries en petits carrés.
   Toucher une carte montre ses séries : on corrige un poids ou des
   répétitions déjà validés, on valide une série passée par erreur,
   ou on passe directement à cet exercice.
   ═══════════════════════════════════════════════════════════ */
import { i18n } from "./i18n.js?v=20261031b";

const t = (key, vars) => i18n.t(key, vars);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const kg = value => String(Number(value) || 0).replace(".", i18n.getLanguage() === "fr" ? "," : ".");
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>`;

let map = null;

export const isWorkoutMapOpen = () => Boolean(map);

/**
 * opts : { container, layout, getWorkout(), exerciseOf(id) → { name, image, fallback, timed },
 *          onEdit(blockIndex, setIndex, patch), onJump(blockIndex), onDetails(exerciseId), onClose() }
 * Le minuteur de repos reste visible en bas de l'écran pendant la vue d'ensemble.
 */
export function openWorkoutMap(opts) {
  if (map) return;
  const workout = opts.getWorkout();
  if (!workout) return;
  const el = document.createElement("section");
  el.className = "wmap";
  el.setAttribute("aria-labelledby", "wmap-title");
  opts.container.appendChild(el);
  map = { el, opts, open: new Set([workout.currentExerciseIndex]) };
  document.body.classList.add("workout-map-open");
  bind();
  render();
  // l'exercice en cours « rétrécit » et la séance entière apparaît
  const layout = opts.layout;
  const swap = () => { layout.hidden = true; layout.classList.remove("is-leaving"); };
  if (reducedMotion()) swap();
  else { layout.classList.add("is-leaving"); setTimeout(swap, 180); }
  window.scrollTo(0, 0);
  requestAnimationFrame(() => {
    el.querySelector(".wm-item.is-now")?.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    el.querySelector("[data-wm-close]")?.focus({ preventScroll: true });
  });
}

/** silent : on quitte l'écran de séance, on range tout sans animation ni rappel */
export function closeWorkoutMap({ silent = false } = {}) {
  if (!map) return;
  const { el, opts } = map;
  map = null;
  document.body.classList.remove("workout-map-open");
  const layout = opts.layout;
  if (silent) {
    el.remove();
    layout.hidden = false;
    layout.classList.remove("is-leaving", "is-entering");
    return;
  }
  const done = () => {
    el.remove();
    layout.hidden = false;
    if (!reducedMotion()) {
      layout.classList.add("is-entering");
      setTimeout(() => layout.classList.remove("is-entering"), 260);
    }
    window.scrollTo(0, 0);
    opts.onClose?.();
  };
  if (reducedMotion()) done();
  else { el.classList.add("is-leaving"); setTimeout(done, 160); }
}

/** à appeler quand la séance change pendant que la vue est ouverte */
export function refreshWorkoutMap() { if (map) render(); }

function bind() {
  const { el } = map;
  el.addEventListener("click", event => {
    if (event.target.closest("[data-wm-close]")) return closeWorkoutMap();
    const toggle = event.target.closest("[data-wm-toggle]");
    if (toggle) {
      const index = Number(toggle.dataset.wmToggle);
      if (map.open.has(index)) map.open.delete(index); else map.open.add(index);
      render();
      el.querySelector(`[data-wm-toggle="${index}"]`)?.focus({ preventScroll: true });
      return;
    }
    const jump = event.target.closest("[data-wm-jump]");
    if (jump) {
      const index = Number(jump.dataset.wmJump);
      const { opts } = map;
      closeWorkoutMap();
      opts.onJump?.(index);
      return;
    }
    const details = event.target.closest("[data-wm-details]");
    if (details) return map.opts.onDetails?.(details.dataset.wmDetails);
    const didIt = event.target.closest("[data-wm-didit]");
    if (didIt) {
      const [b, s] = didIt.dataset.wmDidit.split(":").map(Number);
      const set = map.opts.getWorkout()?.blocks[b]?.sets[s];
      if (!set) return;
      map.opts.onEdit?.(b, s, { markDone: true, reps: set.targetReps ?? set.reps, weight: set.weight });
      render();
      el.querySelector(`[data-wm-edit="${b}:${s}:reps"]`)?.focus();
    }
  });
  el.addEventListener("change", event => {
    const input = event.target.closest("[data-wm-edit]");
    if (!input) return;
    const [b, s, field] = input.dataset.wmEdit.split(":");
    const value = Number(String(input.value).replace(",", "."));
    if (!Number.isFinite(value) || value < 0) { render(); return; }
    map.opts.onEdit?.(Number(b), Number(s), { [field]: value });
    render();
  });
}

function blockState(workout, block, index) {
  if (index === workout.currentExerciseIndex) return "now";
  const pending = block.sets.some(set => set.status === "pending");
  if (pending) return "next";
  return block.sets.some(set => set.status === "done") ? "done" : "skipped";
}

function render() {
  const workout = map.opts.getWorkout();
  if (!workout) { closeWorkoutMap(); return; }
  const total = workout.blocks.length;
  const finished = workout.blocks.filter(block => block.sets.every(set => set.status !== "pending")).length;
  const scroll = window.scrollY;
  map.el.innerHTML = `
    <div class="wm-head">
      <div>
        <h2 id="wmap-title" class="wm-title">${esc(t("wmTitle"))}</h2>
        <p class="wm-summary">${esc(workout.sessionName)} · ${esc(t("wmSummary", { done: finished, total }))}</p>
      </div>
      <button type="button" class="btn btn-surface btn-sm wm-close" data-wm-close>${esc(t("wmBack"))}</button>
    </div>
    <ol class="wm-list">${workout.blocks.map((block, index) => card(workout, block, index)).join("")}</ol>`;
  window.scrollTo(0, scroll);
}

function card(workout, block, index) {
  const exercise = map.opts.exerciseOf(block.exerciseId) || { name: t("exerciseFallback"), timed: false };
  const state = blockState(workout, block, index);
  const open = map.open.has(index);
  const doneSets = block.sets.filter(set => set.status === "done").length;
  // commencé puis laissé de côté : « à finir » plutôt que « à venir »
  const tag = state === "next" && doneSets ? t("wmToFinish") : { now: t("wmNow"), next: t("wmUpNext"), done: t("wmDone"), skipped: t("wmSkippedExercise") }[state];
  const squares = block.sets.map((set, s) => {
    const isNow = state === "now" && s === workout.currentSetIndex;
    const cls = isNow ? "is-now" : set.status === "done" ? "is-done" : set.status === "skipped" ? "is-skipped" : "";
    return `<i class="wm-sq ${cls}">${s + 1}</i>`;
  }).join("");
  const count = block.sets.length === 1 ? t("wmOneSet") : t("wmSetsCount", { count: block.sets.length });
  const doneText = doneSets === 0 ? t("wmSetsDoneNone") : doneSets === 1 ? t("wmSetsDoneOne") : t("wmSetsDone", { count: doneSets });
  const meta = state === "next" || state === "now" ? `${count} · ${doneText}` : count;
  const marker = state === "done" ? CHECK : String(index + 1);
  return `<li class="wm-item is-${state}${open ? " is-open" : ""}">
    <div class="wm-card">
      <button type="button" class="wm-card-head" data-wm-toggle="${index}" aria-expanded="${open}" aria-controls="wm-body-${index}">
        <span class="wm-marker" aria-hidden="true">${marker}</span>
        <span class="wm-card-text">
          <span class="wm-name">${esc(exercise.name)}</span>
          <span class="wm-meta"><span class="wm-tag">${esc(tag)}</span>${esc(meta)}</span>
          <span class="wm-squares" aria-hidden="true">${squares}</span>
        </span>
      </button>
      <div class="wm-body" id="wm-body-${index}"${open ? "" : " hidden"}>
        ${block.sets.map((set, s) => setRow(workout, state, index, set, s, exercise.timed)).join("")}
        <div class="wm-actions">
          ${state === "next" ? `<button type="button" class="btn btn-primary btn-sm" data-wm-jump="${index}">${esc(t("wmGoHere"))}</button>` : ""}
          ${state === "now" ? `<button type="button" class="btn btn-primary btn-sm" data-wm-close>${esc(t("wmContinue"))}</button>` : ""}
          <button type="button" class="btn btn-surface btn-sm" data-wm-details="${esc(block.exerciseId)}">${esc(t("wmDetails"))}</button>
        </div>
      </div>
    </div>
  </li>`;
}

function setRow(workout, state, b, set, s, timed) {
  const n = s + 1;
  const label = `<span class="wm-set-n">${esc(t("wmSetShort", { n }))}</span>`;
  const target = `${set.targetReps ?? set.reps}${timed ? " s" : ""}${Number(set.weight) ? ` × ${kg(set.weight)} kg` : ""}`;
  if (set.status === "done") {
    return `<div class="wm-set is-done">${label}
      <input class="input wm-input" type="number" inputmode="numeric" min="0" step="1" value="${esc(set.reps)}" data-wm-edit="${b}:${s}:reps" aria-label="${esc(t(timed ? "wmSecondsOf" : "wmRepsOf", { n }))}">
      <span class="wm-unit">${timed ? "s" : t("wmRepsUnit")}</span>
      <span class="wm-x" aria-hidden="true">×</span>
      <input class="input wm-input" type="number" inputmode="decimal" min="0" step="0.5" value="${esc(set.weight)}" data-wm-edit="${b}:${s}:weight" aria-label="${esc(t("wmWeightOf", { n }))}">
      <span class="wm-unit">kg</span>
      <span class="wm-check" aria-hidden="true">${CHECK}</span>
    </div>`;
  }
  if (set.status === "skipped") {
    return `<div class="wm-set is-skipped">${label}<span class="wm-set-text">${esc(t("wmSkipped"))}</span>
      <button type="button" class="wm-link" data-wm-didit="${b}:${s}">${esc(t("wmDidIt"))}</button></div>`;
  }
  const isNow = state === "now" && s === workout.currentSetIndex;
  return `<div class="wm-set${isNow ? " is-now" : ""}">${label}<span class="wm-set-text">${esc(isNow ? `${t("wmNow")} · ${t("wmTarget", { target })}` : t("wmTarget", { target }))}</span></div>`;
}
