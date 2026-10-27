/* ═══════════════════════════════════════════════════════════
   « Ce que tes potes voient » : un interrupteur par élément,
   le classement critère par critère, l'objectif de la semaine
   et les notifications. Tout se change à tout moment.
   ═══════════════════════════════════════════════════════════ */
import { showToast } from "./utils.js?v=20261027a";
import { Social, NOTIF_TYPES } from "./social.js?v=20261027a";
import { SHARE_KEYS, BOARD_KEYS } from "./social-stats.js?v=20261027a";
import { t, tn, esc, openSheet, sheetHead, Bridge } from "./potes-ui.js?v=20261027a";

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

export function openSettings() {
  const { sheet } = openSheet();
  const draw = () => {
    const share = Social.share, board = Social.board, mute = Social.mute;
    sheet.innerHTML = `
      <div class="tl-sheet-inner">
        ${sheetHead(t("psTitle"))}
        <p class="tl-sheet-hand">${esc(t("psHand"))}</p>
        <button type="button" class="btn btn-surface btn-block ps-preview" data-ps-preview>${esc(t("psPreview"))}</button>

        <section class="ps-group" aria-labelledby="ps-share-title">
          <h3 class="ps-title" id="ps-share-title">${esc(t("psShareTitle"))}</h3>
          <p class="ps-intro">${esc(t("psShareIntro"))}</p>
          ${SHARE_KEYS.map(key => switchRow({
            group: "share", key, checked: share[key], label: t(`psShare.${key}`),
            hint: SENSITIVE.includes(key) ? t(`psWhy.${key}`) : t(`psHint.${key}`), sensitive: SENSITIVE.includes(key)
          })).join("")}
        </section>

        <section class="ps-group" aria-labelledby="ps-board-title">
          <h3 class="ps-title" id="ps-board-title">${esc(t("psBoardTitle"))}</h3>
          <p class="ps-intro">${esc(t("psBoardIntro"))}</p>
          ${BOARD_KEYS.map(key => switchRow({ group: "board", key, checked: board[key], label: t(`psBoard.${key}`) })).join("")}
        </section>

        <section class="ps-group" aria-labelledby="ps-goal-title">
          <h3 class="ps-title" id="ps-goal-title">${esc(t("psGoalTitle"))}</h3>
          <p class="ps-intro">${esc(t("psGoalIntro"))}</p>
          <div class="ps-goal" role="group" aria-labelledby="ps-goal-title">
            <button type="button" class="stepper-btn" data-goal="-1" aria-label="${esc(t("psGoalLess"))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg></button>
            <output class="ps-goal-value" aria-live="polite">${esc(tn("psGoalValue", Social.weeklyGoal))}</output>
            <button type="button" class="stepper-btn" data-goal="1" aria-label="${esc(t("psGoalMore"))}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
          </div>
        </section>

        <section class="ps-group" aria-labelledby="ps-notif-title">
          <h3 class="ps-title" id="ps-notif-title">${esc(t("psNotifTitle"))}</h3>
          <p class="ps-intro">${esc(t("psNotifIntro"))}</p>
          ${NOTIF_TYPES.map(key => switchRow({ group: "notif", key, checked: !mute[key], label: t(`psNotif.${key}`) })).join("")}
        </section>
      </div>`;
  };
  draw();
  sheet.querySelector("#tl-sheet-title").focus();

  sheet.addEventListener("change", async event => {
    const input = event.target.closest(".ps-switch");
    if (!input) return;
    const { group, key } = input.dataset;
    const on = input.checked;
    input.disabled = true;
    try {
      if (group === "notif") await Social.updateSettings({ mute: { [key]: !on } });
      else await Social.updateSettings({ [group]: { [key]: on } });
      if (group === "share") { const what = t(`psShare.${key}`); showToast(t(on ? "psShareOn" : "psShareOff", { what: what.charAt(0).toLowerCase() + what.slice(1) })); }
      if (group === "board") showToast(t(on ? "psBoardOn" : "psBoardOff"));
    } catch (err) {
      console.error("[TrackLift] réglages :", err);
      input.checked = !on;
      showToast(t(navigator.onLine === false ? "potesNeedOnline" : "potesJoinError"));
    }
    input.disabled = false;
  });

  sheet.addEventListener("click", async event => {
    if (event.target.closest("[data-ps-preview]")) { Bridge.openMyProfile?.(); return; }
    const step = event.target.closest("[data-goal]");
    if (!step) return;
    const next = Math.min(7, Math.max(1, Social.weeklyGoal + Number(step.dataset.goal)));
    if (next === Social.weeklyGoal) return;
    sheet.querySelector(".ps-goal-value").textContent = tn("psGoalValue", next);
    try { await Social.updateSettings({ weeklyGoal: next }); } catch { showToast(t("potesJoinError")); }
  });
}
