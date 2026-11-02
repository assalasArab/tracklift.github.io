/* ═══════════════════════════════════════════════════════════
   Bilan de la semaine dans l'appli : une ligne sur l'accueil le
   dimanche, la fenêtre du bilan, et le choix « Dans l'appli » /
   « Par e-mail ». Les calculs sont dans bilan-engine.js (partagés
   avec l'envoi des e-mails).
   ═══════════════════════════════════════════════════════════ */
import { buildBilan, bilanContent, bilanWeek, dayOf, formatters, shiftDay } from "./bilan-engine.js?v=20261102a";
import { BILAN_EMAIL_READY } from "./bilan-config.js?v=20261102a";
import { i18n } from "./i18n.js?v=20261102a";
import { showToast } from "./utils.js?v=20261102a";
import { openSheet, sheetHead, esc } from "./potes-ui.js?v=20261102a";

const UI = {
  fr: {
    lineReady: "Ton bilan de la semaine est prêt",
    lineSessions: "{n} séance notée",
    lineSessionsMany: "{n} séances notées",
    lineUp: "{n} en hausse",
    lineEmpty: "Aucune séance notée cette semaine",
    receive: "Recevoir mon bilan chaque dimanche",
    inApp: "Dans l'appli",
    inAppHint: "Un rappel sur l'accueil le dimanche.",
    email: "Par e-mail",
    emailHint: "Envoyé le dimanche vers 7 h à {email}.",
    emailSoon: "Bientôt disponible.",
    emailNoAccount: "Il faut être connecté avec un compte qui a une adresse e-mail.",
    alwaysHere: "Ton bilan reste toujours disponible ici, depuis le menu.",
    saved: "C'est noté.",
    saveError: "Pas enregistré : vérifie ta connexion.",
    firstSoon: "Ton premier bilan arrivera le dimanche qui suit ta première séance.",
    next: "Prochain bilan : {date}."
  },
  en: {
    lineReady: "Your weekly summary is ready",
    lineSessions: "{n} workout logged",
    lineSessionsMany: "{n} workouts logged",
    lineUp: "{n} going up",
    lineEmpty: "No workout logged this week",
    receive: "Get my summary every Sunday",
    inApp: "In the app",
    inAppHint: "A reminder on the home screen on Sundays.",
    email: "By email",
    emailHint: "Sent on Sundays around 7 am to {email}.",
    emailSoon: "Coming soon.",
    emailNoAccount: "You need to be signed in with an account that has an email address.",
    alwaysHere: "Your summary is always available here, from the menu.",
    saved: "Saved.",
    saveError: "Not saved: check your connection.",
    firstSoon: "Your first summary arrives on the Sunday after your first workout.",
    next: "Next summary: {date}."
  }
};
const lang = () => (i18n.getLanguage() === "en" ? "en" : "fr");
const ui = () => UI[lang()];
const fill = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

/** Préférences : dans l'appli par défaut, e-mail seulement si l'utilisateur l'a demandé */
export function bilanPrefs(profile) {
  const p = profile?.bilan || {};
  return { inApp: p.inApp !== false, email: p.email === true };
}

/** L'utilisateur s'entraînait déjà avant la fin de la semaine du bilan (sinon le bilan n'a pas de sens) */
const hadLogsBefore = (logs, day) => (logs || []).some(log => Number.isFinite(Number(log?.date)) && dayOf(Number(log.date)) <= day);

/* ─── Ligne sur l'accueil ──────────────────────────────── */
export function renderBilanLine(el, { logs, profile, onOpen }) {
  if (!el) return;
  const week = bilanWeek();
  const show = bilanPrefs(profile).inApp && profile?.bilanSeen !== week.sunday && hadLogsBefore(logs, week.to);
  if (!show) { el.innerHTML = ""; el.classList.add("hidden"); return; }
  const bilan = buildBilan(logs);
  const U = ui();
  const sub = bilan.empty ? U.lineEmpty : [
    fill(bilan.counts.sessions === 1 ? U.lineSessions : U.lineSessionsMany, { n: bilan.counts.sessions }),
    bilan.counts.up ? fill(U.lineUp, { n: bilan.counts.up }) : ""
  ].filter(Boolean).join(" · ");
  el.classList.remove("hidden");
  el.innerHTML = `
    <button type="button" class="pl-main" data-bl-open>
      <span class="bl-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 19h16M7 15v-3M12 15V8M17 15V5"/></svg></span>
      <span class="pl-text"><b>${esc(U.lineReady)}</b><br><span class="bl-sub">${esc(sub)}</span></span>
      <svg class="pl-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
    </button>`;
  el.querySelector("[data-bl-open]").addEventListener("click", () => onOpen?.());
}

/* ─── Fenêtre du bilan ─────────────────────────────────── */
/**
 * opts : { logs, profile, email, saveProfile(patch) → profil enregistré, onSeen() }
 */
export function openBilan(opts) {
  const L = lang();
  const U = ui();
  const F = formatters(L);
  const week = bilanWeek();
  const bilan = buildBilan(opts.logs);
  const c = bilanContent(bilan, L);
  const prefs = bilanPrefs(opts.profile);
  const started = hadLogsBefore(opts.logs, week.to);
  const { sheet } = openSheet();

  const sessionsHtml = c.sessions.map(s => `
    <section class="bl-session">
      <h3 class="bl-label">${esc(s.name)}</h3>
      ${s.times ? `<p class="bl-muted">${esc(s.times)}</p>` : ""}
      <table class="bl-table">
        <thead><tr><th scope="col">${esc(c.cols.exercise)}</th><th scope="col">${esc(c.cols.top)}</th><th scope="col">${esc(c.cols.volume)}</th><th scope="col">${esc(c.cols.trend)}</th></tr></thead>
        <tbody>${s.rows.map(r => `<tr>
          <th scope="row">${esc(r.name)}</th>
          <td class="bl-num">${esc(r.top)}</td>
          <td class="bl-num">${esc(r.volume)}${r.delta ? `<small>${esc(r.delta)}</small>` : ""}</td>
          <td><span class="bl-trend is-${r.trend}">${esc(r.trendLabel)}</span>${r.note ? `<small>${esc(r.note)}</small>` : ""}</td>
        </tr>`).join("")}</tbody>
      </table>
    </section>`).join("");

  const report = started ? `
      <p class="bl-date">${esc(c.date)}</p>
      <p class="bl-intro">${esc(c.intro)}</p>
      ${c.emptyHelp ? `<p class="bl-intro">${esc(c.emptyHelp)}</p>` : ""}
      ${sessionsHtml}
      ${c.focus.length ? `<section class="bl-session"><h3 class="bl-label">${esc(c.focusTitle)}</h3>${c.focus.map(f => `<p class="bl-text">${esc(f)}</p>`).join("")}</section>` : ""}
      ${c.advice.length ? `<section class="card bl-prio"><h3 class="bl-label">${esc(c.prioritiesTitle)}</h3><ol>${c.advice.map(a => `<li>${esc(a)}</li>`).join("")}</ol></section>` : ""}
      <p class="bl-text bl-end">${esc(c.end)}</p>`
    : `<p class="bl-intro">${esc(U.firstSoon)}</p>`;

  const emailOk = BILAN_EMAIL_READY && Boolean(opts.email);
  const emailHint = !BILAN_EMAIL_READY ? U.emailSoon : !opts.email ? U.emailNoAccount : fill(U.emailHint, { email: opts.email });
  sheet.innerHTML = `
    <div class="tl-sheet-inner bl-sheet">
      ${sheetHead(c.title)}
      ${report}
      <section class="bl-prefs">
        <h3 class="bl-label">${esc(U.receive)}</h3>
        <div class="ps-row">
          <label class="ps-label" for="bl-inapp"><span class="ps-name">${esc(U.inApp)}</span><span class="ps-hint" id="bl-inapp-hint">${esc(U.inAppHint)}</span></label>
          <input type="checkbox" role="switch" class="ps-switch" id="bl-inapp" data-bl-pref="inApp" aria-describedby="bl-inapp-hint"${prefs.inApp ? " checked" : ""}>
        </div>
        <div class="ps-row">
          <label class="ps-label" for="bl-email"><span class="ps-name">${esc(U.email)}</span><span class="ps-hint" id="bl-email-hint">${esc(emailHint)}</span></label>
          <input type="checkbox" role="switch" class="ps-switch" id="bl-email" data-bl-pref="email" aria-describedby="bl-email-hint"${prefs.email && emailOk ? " checked" : ""}${emailOk ? "" : " disabled"}>
        </div>
        <p class="bl-muted">${esc(U.alwaysHere)} ${esc(fill(U.next, { date: F.dateShort(shiftDay(week.sunday, 7)) }))}</p>
      </section>
    </div>`;
  sheet.querySelector("#tl-sheet-title")?.focus();

  sheet.addEventListener("change", event => {
    const input = event.target.closest("[data-bl-pref]");
    if (!input) return;
    const current = bilanPrefs(opts.profile);
    const next = { ...current, [input.dataset.blPref]: input.checked, lang: L };
    try {
      opts.profile = opts.saveProfile({ bilan: next }) || opts.profile;
      showToast(U.saved);
    } catch (err) {
      console.error("[Bilan] réglage", err);
      input.checked = !input.checked;
      showToast(U.saveError);
    }
  });

  // vu : la ligne de l'accueil disparaît jusqu'au prochain dimanche
  if (started && opts.profile?.bilanSeen !== week.sunday) {
    try { opts.profile = opts.saveProfile({ bilanSeen: week.sunday }) || opts.profile; } catch (err) { console.error("[Bilan] vu", err); }
    opts.onSeen?.();
  }
}
