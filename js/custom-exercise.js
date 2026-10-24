/* ═══════════════════════════════════════════════════════════
   Exercices personnels : formulaire de création / modification.
   L'exercice produit a le même format que ceux de la base RepDB
   (muscles, type, matériel…), sans illustration.
   ═══════════════════════════════════════════════════════════ */
import { MUSCLE_GROUP, MUSCLE_REGIONS, muscleName } from "./muscles.js?v=20261024e";
import { uid } from "./utils.js?v=20261024e";

const GROUP_TYPE = {
  pectoraux: "push", epaules: "push", triceps: "push",
  dos: "pull", biceps: "pull", trapeces: "pull", avant_bras: "pull",
  quadriceps: "legs", ischio_jambiers: "legs", fessiers: "legs", mollets: "legs", adducteurs: "legs", abducteurs: "legs",
  abdominaux: "other", flechisseurs_hanche: "other", bas_dos: "pull"
};
const TYPES = ["push", "pull", "legs", "full", "other"];
const EQUIPMENT = ["barre", "halteres", "machine", "poulie", "smith", "barre_ez", "kettlebell", "poids_du_corps",
  "barre_traction", "barres_dips", "bandes", "suspension", "banc", "disques", "medecine_ball", "ballon", "cardio", "autre"];
const PROFILES = ["polyarticulaire", "isolation", "isometrique", "etirement", "explosif", "cardio"];

function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

/** Construit l'exercice à partir des champs du formulaire */
export function buildCustomExercise(fields, previous = null) {
  const primary = fields.primary;
  const secondary = fields.secondary.filter(key => key !== primary);
  const focus = MUSCLE_GROUP[primary] || "autre";
  const secondaryGroups = [...new Set(secondary.map(key => MUSCLE_GROUP[key]).filter(g => g && g !== focus))];
  return {
    id: previous?.id || `custom-${uid()}`,
    name: fields.name,
    name_fr: fields.name,
    type: fields.type,
    muscle_focus: focus,
    muscle_portion: primary,
    contraction_type: fields.profile,
    primary_muscles: [primary],
    secondary_muscles: secondaryGroups,
    secondary_detail: secondary,
    equipment: fields.equipment,
    difficulty: "intermediaire",
    bodyweight: fields.equipment === "poids_du_corps",
    unilateral: false,
    description: fields.notes,
    instructions: [],
    tips: [],
    img: null,
    similar_exercises: [],
    custom: true,
    createdAt: previous?.createdAt || Date.now()
  };
}

/**
 * Ouvre le formulaire.
 * opts: { exercise (à modifier), name (pré-rempli), lang, t(key), translate(category, value),
 *         onSave(exercise), onDelete(exercise) }
 */
export function openCustomExerciseForm(opts) {
  const { t, translate, lang = "fr", exercise = null } = opts;
  const editing = Boolean(exercise);
  const state = {
    primary: exercise?.primary_muscles?.[0] || "",
    secondary: new Set(exercise?.secondary_detail || []),
    typeTouched: editing
  };

  const el = document.createElement("div");
  el.className = "modal cx-modal";
  const muscleOptions = MUSCLE_REGIONS.map(region => `
    <optgroup label="${esc(region[lang] || region.fr)}">
      ${region.keys.map(key => `<option value="${key}"${state.primary === key ? " selected" : ""}>${esc(muscleName(key, lang))}</option>`).join("")}
    </optgroup>`).join("");
  const select = (name, values, category, current) => `
    <select id="cx-${name}" class="input">
      ${values.map(v => `<option value="${v}"${v === current ? " selected" : ""}>${esc(translate(category, v))}</option>`).join("")}
    </select>`;

  el.innerHTML = `
    <div class="modal-card cx-card" role="dialog" aria-modal="true" aria-labelledby="cx-title">
      <div class="modal-head">
        <h3 id="cx-title">${editing ? t("customEditTitle") : t("customCreateTitle")}</h3>
        <button type="button" class="icon-btn" data-cx="cancel" aria-label="${esc(t("cancel"))}">✕</button>
      </div>
      <form class="cx-form" novalidate>
        <div class="cx-field">
          <label class="label" for="cx-name">${t("customName")}</label>
          <input id="cx-name" class="input" type="text" maxlength="60" autocomplete="off" value="${esc(exercise?.name || opts.name || "")}" placeholder="${esc(t("customNamePlaceholder"))}">
          <p class="cx-error" id="cx-name-error" hidden>${t("customNameRequired")}</p>
        </div>
        <div class="cx-field">
          <label class="label" for="cx-primary">${t("primaryMuscles")}</label>
          <select id="cx-primary" class="input">
            <option value="" disabled${state.primary ? "" : " selected"}>${t("customChooseMuscle")}</option>
            ${muscleOptions}
          </select>
          <p class="cx-error" id="cx-primary-error" hidden>${t("customMuscleRequired")}</p>
        </div>
        <div class="cx-field">
          <span class="label" id="cx-secondary-label">${t("secondaryMuscles")}</span>
          <div class="cx-muscles" role="group" aria-labelledby="cx-secondary-label"></div>
        </div>
        <div class="cx-row">
          <div class="cx-field">
            <label class="label" for="cx-type">${t("type")}</label>
            ${select("type", TYPES, "type", exercise?.type || "full")}
          </div>
          <div class="cx-field">
            <label class="label" for="cx-equipment">${t("customEquipment")}</label>
            ${select("equipment", EQUIPMENT, "equipment", exercise?.equipment || "halteres")}
          </div>
        </div>
        <div class="cx-field">
          <label class="label" for="cx-profile">${t("customMovement")}</label>
          ${select("profile", PROFILES, "contraction_type", exercise?.contraction_type || "polyarticulaire")}
        </div>
        <div class="cx-field">
          <label class="label" for="cx-notes">${t("customNotes")}</label>
          <textarea id="cx-notes" class="input cx-notes" rows="3" maxlength="600" placeholder="${esc(t("customNotesPlaceholder"))}">${esc(exercise?.description || "")}</textarea>
        </div>
        <div class="cx-actions">
          ${editing ? `<button type="button" class="btn btn-danger" data-cx="delete">${t("delete")}</button>` : ""}
          <button type="button" class="btn btn-surface" data-cx="cancel">${t("cancel")}</button>
          <button type="submit" class="btn btn-primary">${t("save")}</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(el);

  const $ = sel => el.querySelector(sel);
  const renderSecondary = () => {
    $(".cx-muscles").innerHTML = MUSCLE_REGIONS.flatMap(region => region.keys)
      .filter(key => key !== state.primary)
      .map(key => `<button type="button" class="cx-muscle" data-muscle="${key}" aria-pressed="${state.secondary.has(key)}">${esc(muscleName(key, lang))}</button>`)
      .join("");
  };
  renderSecondary();

  const close = () => el.remove();

  el.addEventListener("click", event => {
    if (event.target === el) { close(); return; }
    const muscle = event.target.closest("[data-muscle]");
    if (muscle) {
      const key = muscle.dataset.muscle;
      state.secondary.has(key) ? state.secondary.delete(key) : state.secondary.add(key);
      muscle.setAttribute("aria-pressed", String(state.secondary.has(key)));
      return;
    }
    const action = event.target.closest("[data-cx]")?.dataset.cx;
    if (action === "cancel") close();
    if (action === "delete" && window.confirm(t("customDeleteConfirm"))) {
      close();
      opts.onDelete && opts.onDelete(exercise);
    }
  });

  $("#cx-primary").addEventListener("change", event => {
    state.primary = event.target.value;
    state.secondary.delete(state.primary);
    $("#cx-primary-error").hidden = true;
    // le type de séance suit le muscle principal tant que l'utilisateur ne l'a pas choisi
    if (!state.typeTouched) $("#cx-type").value = GROUP_TYPE[MUSCLE_GROUP[state.primary]] || "full";
    renderSecondary();
  });
  $("#cx-type").addEventListener("change", () => { state.typeTouched = true; });
  $("#cx-name").addEventListener("input", () => { $("#cx-name-error").hidden = true; });

  $(".cx-form").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("#cx-name").value.trim().replace(/\s+/g, " ");
    $("#cx-name-error").hidden = Boolean(name);
    $("#cx-primary-error").hidden = Boolean(state.primary);
    if (!name) { $("#cx-name").focus(); return; }
    if (!state.primary) { $("#cx-primary").focus(); return; }
    const saved = buildCustomExercise({
      name,
      primary: state.primary,
      secondary: [...state.secondary],
      type: $("#cx-type").value,
      equipment: $("#cx-equipment").value,
      profile: $("#cx-profile").value,
      notes: $("#cx-notes").value.trim()
    }, exercise);
    close();
    opts.onSave && opts.onSave(saved);
  });

  setTimeout(() => (editing || opts.name ? $("#cx-primary") : $("#cx-name")).focus(), 50);
}
