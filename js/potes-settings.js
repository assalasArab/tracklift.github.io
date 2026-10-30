/* ═══════════════════════════════════════════════════════════
   « Ce que tes potes voient » : un interrupteur par élément,
   le classement critère par critère, l'objectif de la semaine
   et les notifications. Rien ne part tant qu'on n'a pas appuyé
   sur « Enregistrer » ; fermer sans enregistrer est signalé.
   ═══════════════════════════════════════════════════════════ */
import { showToast } from "./utils.js?v=20261030a";
import { Social, NOTIF_TYPES } from "./social.js?v=20261030a";
import { SHARE_KEYS, BOARD_KEYS } from "./social-stats.js?v=20261030a";
import { t, tn, esc, openSheet, sheetHead, Bridge } from "./potes-ui.js?v=20261030a";

const SENSITIVE = ["weight", "nutrition"];

function switchRow({ group, key, checked, label, hint = "", sensitive = false }) {
  const id = `ps-${group}-${key}`;
  return `
    <div class="ps-row${sensitive ? " is-sensitive" : ""}">
      <label class="ps-label" for="${id}">
        <span class="ps-name">${esc(label)}${sensitive ? ` <em class="ps-chip">${esc(t("psSensitive"))}</em>` : ""}</span>
        ${hint ? `<span class="ps-hint" id="${id}-hint">${esc(hint)}</span>` : ""}
      </label>
      <input type="checkbox" role="switch" class="ps-switch" id="${id}" data-group="${group}" data-key="${key}"${checked ? " checked" : ""}${hint ? ` aria-describedby="${id}-hint"` : ""}>
    </div>`;
}

/** Réglages réduits aux clés connues, en vrai/faux : sert à comparer brouillon et enregistré */
function canon(state) {
  const pick = (keys, obj) => Object.fromEntries(keys.map(key => [key, !!obj?.[key]]));
  return {
    share: pick(SHARE_KEYS, state.share),
    board: pick(BOARD_KEYS, state.board),
    mute: pick(NOTIF_TYPES, state.mute),
    weeklyGoal: Number(state.weeklyGoal) || 3
  };
}
const savedState = () => canon({ share: Social.share, board: Social.board, mute: Social.mute, weeklyGoal: Social.weeklyGoal });

export function openSettings() {
  const draft = savedState();
  let warn = false;
  let saving = false;
  const dirty = () => JSON.stringify(draft) !== JSON.stringify(savedState());

  const { sheet, close } = openSheet({
    // fermer avec des changements pas enregistrés : on prévient au lieu de fermer
    beforeClose: () => {
      if (!dirty()) return true;
      warn = true;
      drawDock();
      sheet.querySelector("[data-ps-save]")?.focus();
      return false;
    }
  });

  function drawDock() {
    const dock = sheet.querySelector("[data-ps-dock]");
    if (!dock) return;
    const changed = dirty();
    dock.innerHTML = `
      ${warn && changed ? `<p class="ps-unsaved" role="alert">${esc(t("psUnsaved"))}</p>` : ""}
      <button type="button" class="btn btn-primary btn-block" data-ps-save${changed && !saving ? "" : " disabled"}>${esc(t(saving ? "psSaving" : "psSave"))}</button>
      ${warn && changed ? `<button type="button" class="hero-other ps-discard" data-ps-discard>${esc(t("psDiscard"))}</button>` : ""}`;
  }

  sheet.innerHTML = `
    <div class="tl-sheet-inner">
      ${sheetHead(t("psTitle"))}
      <p class="tl-sheet-hand">${esc(t("psHand"))}</p>
      <button type="button" class="btn btn-surface btn-block ps-preview" data-ps-preview>${esc(t("psPreview"))}</button>

      <section class="ps-group" aria-labelledby="ps-share-title">
        <h3 class="ps-title" id="ps-share-title">${esc(t("psShareTitle"))}</h3>
        <p class="ps-intro">${esc(t("psShareIntro"))}</p>
        ${SHARE_KEYS.map(key => switchRow({
          group: "share", key, checked: draft.share[key], label: t(`psShare.${key}`),
          hint: SENSITIVE.includes(key) ? t(`psWhy.${key}`) : t(`psHint.${key}`), sensitive: SENSITIVE.includes(key)
        })).join("")}
      </section>

      <section class="ps-group" aria-labelledby="ps-board-title">
        <h3 class="ps-title" id="ps-board-title">${esc(t("psBoardTitle"))}</h3>
        <p class="ps-intro">${esc(t("psBoardIntro"))}</p>
        ${BOARD_KEYS.map(key => switchRow({ group: "board", key, checked: draft.board[key], label: t(`psBoard.${key}`) })).join("")}
      </section>

      <section class="ps-group" aria-labelledby="ps-goal-title">
        <h3 class="ps-title" id="ps-goal-title">${esc(t("psGoalTitle"))}</h3>
        <p class="ps-intro">${esc(t("psGoalIntro"))}</p>
        <div class="ps-goal" role="group" aria-labelledby="ps-goal-title">
          <button type="button" class="stepper-btn" data-goal="-1" aria-label="${esc(t("psGoalLess"))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>
          <output class="ps-goal-value" aria-live="polite">${esc(tn("psGoalValue", draft.weeklyGoal))}</output>
          <button type="button" class="stepper-btn" data-goal="1" aria-label="${esc(t("psGoalMore"))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
        </div>
      </section>

      <section class="ps-group" aria-labelledby="ps-notif-title">
        <h3 class="ps-title" id="ps-notif-title">${esc(t("psNotifTitle"))}</h3>
        <p class="ps-intro">${esc(t("psNotifIntro"))}</p>
        ${NOTIF_TYPES.map(key => switchRow({ group: "notif", key, checked: !draft.mute[key], label: t(`psNotif.${key}`) })).join("")}
      </section>
    </div>
    <div class="tl-dock ps-dock" data-ps-dock></div>`;
  drawDock();
  sheet.querySelector("#tl-sheet-title").focus();

  // les interrupteurs ne changent que le brouillon
  sheet.addEventListener("change", event => {
    const input = event.target.closest(".ps-switch");
    if (!input) return;
    const { group, key } = input.dataset;
    if (group === "notif") draft.mute[key] = !input.checked;
    else draft[group][key] = input.checked;
    drawDock();
  });

  sheet.addEventListener("click", async event => {
    if (event.target.closest("[data-ps-preview]")) {
      // l'aperçu montre ce qui est enregistré : on enregistre d'abord
      if (dirty()) { warn = true; drawDock(); showToast(t("psSaveFirst")); sheet.querySelector("[data-ps-save]")?.focus(); return; }
      Bridge.openMyProfile?.();
      return;
    }
    if (event.target.closest("[data-ps-discard]")) { close(true); return; }

    const step = event.target.closest("[data-goal]");
    if (step) {
      draft.weeklyGoal = Math.min(7, Math.max(1, draft.weeklyGoal + Number(step.dataset.goal)));
      sheet.querySelector(".ps-goal-value").textContent = tn("psGoalValue", draft.weeklyGoal);
      drawDock();
      return;
    }

    if (event.target.closest("[data-ps-save]") && dirty() && !saving) {
      saving = true;
      drawDock();
      try {
        await Social.updateSettings(draft);
        saving = false;
        showToast(t("psSavedToast"));
        close(true);
      } catch (err) {
        console.error("[TrackLift] réglages :", err);
        saving = false;
        drawDock();
        showToast(t(navigator.onLine === false ? "potesNeedOnline" : "potesJoinError"));
      }
    }
  });
}
