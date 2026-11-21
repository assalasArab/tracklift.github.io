/* ═══════════════════════════════════════════════════════════
   Boîte à idées : chacun envoie une idée ou un bug.
   Firestore ideas/<id> { text, uid, createdAt, lang } : écrit par l'appli,
   lu et vidé seulement par l'administrateur (tools/ideas/ideas.mjs).
   ═══════════════════════════════════════════════════════════ */
import { firestore } from "./firebase-config.js?v=20261122a";
import { i18n } from "./i18n.js?v=20261122a";
import { openSheet, esc } from "./potes-ui.js?v=20261122a";

const TEXT = {
  fr: {
    kicker: "Tu as une idée ?", title: "Boîte à idées", close: "Fermer",
    intro: "Une fonction qui manque, un bug, une envie : écris-le ici. Chaque idée est lue, et la boîte est vidée une fois l'idée réglée.",
    label: "Ton idée", holder: "Ex. : pouvoir combiner deux exercices…", send: "Envoyer", sending: "Envoi…",
    thanks: "Merci ! Ton idée est dans la boîte.", tooShort: "Écris au moins quelques mots.",
    wait: "Une idée par minute : attends un petit peu.", error: "Envoi impossible pour l'instant, réessaie.", count: "{n} / 1000",
    inbox: "Idées reçues ({n})", empty: "La boîte est vide.", done: "Réglé", copy: "Tout copier", copied: "Idées copiées"
  },
  en: {
    kicker: "Got an idea?", title: "Idea box", close: "Close",
    intro: "A missing feature, a bug, a wish: write it here. Every idea is read, and the box is emptied once the idea is handled.",
    label: "Your idea", holder: "E.g. combine two exercises…", send: "Send", sending: "Sending…",
    thanks: "Thanks! Your idea is in the box.", tooShort: "Write at least a few words.",
    wait: "One idea per minute: wait a little.", error: "Can't send right now, try again.", count: "{n} / 1000",
    inbox: "Ideas received ({n})", empty: "The box is empty.", done: "Done", copy: "Copy all", copied: "Ideas copied"
  }
};
const T = () => TEXT[i18n.getLanguage() === "en" ? "en" : "fr"];
const fill = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
let lastSent = 0;

/** uid : identifiant de l'utilisateur connecté (exigé par les règles, jamais montré) */
export function openIdeaBox({ uid }) {
  const t = T();
  const { sheet } = openSheet();
  sheet.innerHTML = `
    <div class="tl-sheet-inner ib-wrap">
      <div class="tl-sheet-head">
        <div><p class="tl-sheet-step">${esc(t.kicker)}</p><h2 id="tl-sheet-title" class="tl-sheet-title" tabindex="-1">${esc(t.title)}</h2></div>
        <button type="button" class="icon-btn" data-sheet-close aria-label="${esc(t.close)}">✕</button>
      </div>
      <p class="pt-text">${esc(t.intro)}</p>
      <form class="ib-form" novalidate>
        <label class="label" for="ib-text">${esc(t.label)}</label>
        <textarea id="ib-text" class="input ib-text" rows="6" maxlength="1000" placeholder="${esc(t.holder)}"></textarea>
        <p class="ib-count" aria-live="polite">${esc(fill(t.count, { n: 0 }))}</p>
        <p class="ib-msg" role="status"></p>
        <button type="submit" class="btn btn-primary btn-block ib-send">${esc(t.send)}</button>
      </form>
      <section class="ib-admin" hidden></section>
    </div>`;
  loadInbox(sheet.querySelector(".ib-admin"));
  const text = sheet.querySelector("#ib-text");
  const msg = sheet.querySelector(".ib-msg");
  const send = sheet.querySelector(".ib-send");
  sheet.querySelector("#tl-sheet-title")?.focus();
  text.addEventListener("input", () => { sheet.querySelector(".ib-count").textContent = fill(t.count, { n: text.value.length }); });
  sheet.querySelector(".ib-form").addEventListener("submit", async event => {
    event.preventDefault();
    const value = text.value.trim();
    msg.className = "ib-msg is-error";
    if (value.length < 3) { msg.textContent = t.tooShort; text.focus(); return; }
    if (Date.now() - lastSent < 60000) { msg.textContent = t.wait; return; }
    send.disabled = true;
    send.textContent = t.sending;
    try {
      await firestore.collection("ideas").add({ text: value.slice(0, 1000), uid, createdAt: Date.now(), lang: i18n.getLanguage() === "en" ? "en" : "fr" });
      lastSent = Date.now();
      text.value = "";
      sheet.querySelector(".ib-count").textContent = fill(t.count, { n: 0 });
      msg.className = "ib-msg is-ok";
      msg.textContent = t.thanks;
    } catch (err) {
      console.warn("[TrackLift] boîte à idées :", err?.code || err);
      msg.textContent = t.error;
    }
    send.disabled = false;
    send.textContent = t.send;
  });
}

/** Administrateur seulement (les règles refusent la lecture aux autres) : les idées reçues, à marquer « Réglé » */
async function loadInbox(box) {
  let docs;
  try { docs = (await firestore.collection("ideas").get()).docs; } catch { return; }
  const t = T();
  const ideas = docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  const draw = () => {
    box.hidden = false;
    box.innerHTML = `
      <div class="ib-admin-head"><h3 class="ib-admin-title">${esc(fill(t.inbox, { n: ideas.length }))}</h3>
        ${ideas.length ? `<button type="button" class="btn btn-surface btn-sm" data-ib-copy>${esc(t.copy)}</button>` : ""}</div>
      ${ideas.length ? `<ul class="ib-list">${ideas.map(idea => `<li class="ib-idea">
          <p class="ib-idea-date">${esc(new Date(idea.createdAt || 0).toLocaleString(i18n.getLocale(), { dateStyle: "medium", timeStyle: "short" }))}</p>
          <p class="ib-idea-text">${esc(idea.text)}</p>
          <button type="button" class="btn btn-ghost btn-sm" data-ib-done="${esc(idea.id)}">${esc(t.done)}</button></li>`).join("")}</ul>`
        : `<p class="pt-text">${esc(t.empty)}</p>`}`;
  };
  box.addEventListener("click", async event => {
    const done = event.target.closest("[data-ib-done]");
    if (done) {
      done.disabled = true;
      try {
        await firestore.doc(`ideas/${done.dataset.ibDone}`).delete();
        ideas.splice(ideas.findIndex(idea => idea.id === done.dataset.ibDone), 1);
        draw();
      } catch { done.disabled = false; }
      return;
    }
    const copy = event.target.closest("[data-ib-copy]");
    if (copy) {
      try { await navigator.clipboard.writeText(ideas.map((idea, i) => `${i + 1}. ${idea.text}`).join("\n")); copy.textContent = t.copied; } catch { /* presse-papiers indisponible */ }
    }
  });
  draw();
}
