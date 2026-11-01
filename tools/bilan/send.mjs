/* ═══════════════════════════════════════════════════════════
   Envoi du bilan de la semaine par e-mail.
   Lancé par GitHub Actions chaque dimanche (.github/workflows/bilan-hebdo.yml).
   Mise en place : tools/bilan/LISEZMOI.md

   Variables :
     FIREBASE_SERVICE_ACCOUNT  clé JSON du compte de service Firebase (secret)
     GMAIL_USER                adresse Gmail d'envoi (secret)
     GMAIL_APP_PASSWORD        mot de passe d'application Gmail (secret)
     APP_URL                   adresse de l'appli (lien dans l'e-mail)
     DRY_RUN=1                 essai : calcule tout, n'envoie rien, n'écrit rien
     FORCE=1                   ne vérifie pas qu'on est dimanche après 7 h

   Aperçu local, sans rien installer :
     node tools/bilan/send.mjs --apercu <export TrackLift .json> [fr|en]

   Les journaux de GitHub Actions sont publics : on n'y écrit jamais
   d'adresse e-mail, de nom ni d'identifiant d'utilisateur.
   ═══════════════════════════════════════════════════════════ */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildBilan, bilanEmail, bilanWeek, parisTime } from "../../js/bilan-engine.js";

const STALE_MS = 30 * 60000; // un envoi « en cours » depuis 30 min a planté : on peut le refaire

const shortId = uid => createHash("sha256").update(String(uid)).digest("hex").slice(0, 6);
const clean = text => String(text || "").replace(/[^\s<>()"']+@[^\s<>()"']+/g, "[adresse]").slice(0, 160);

/**
 * Une passe d'envoi. db / auth : Firestore et Auth (firebase-admin) ; send(message) envoie un e-mail.
 * Renvoie les compteurs (aucune donnée personnelle).
 */
export async function run({ db, auth, send, now = Date.now(), dryRun = false, force = false, appUrl = "", log = console.log }) {
  const week = bilanWeek(now);
  const p = parisTime(now);
  if (!force && (p.wd !== 0 || p.h < 7)) {
    log("Pas encore dimanche 7 h à Paris : rien à envoyer.");
    return { skipped: "time" };
  }
  const snap = await db.collection("users").where("profile.bilan.email", "==", true).get();
  const stats = { asked: snap.size, sent: 0, already: 0, noEmail: 0, failed: 0 };

  for (const doc of snap.docs) {
    const uid = doc.id;
    const data = doc.data() || {};
    let user = null;
    try { user = await auth.getUser(uid); } catch { /* compte supprimé */ }
    // adresse du compte seulement, et vérifiée (connexion Google) : jamais une adresse tapée à la main
    if (!user?.email || !user.emailVerified || user.disabled) { stats.noEmail++; continue; }

    const lang = data.profile?.bilan?.lang === "en" ? "en" : "fr";
    const bilan = buildBilan(Array.isArray(data.sessionLogs) ? data.sessionLogs : [], now);
    const mail = bilanEmail(bilan, { lang, appUrl });
    if (dryRun) { stats.sent++; continue; }

    // un repère par semaine : un deuxième passage le même dimanche n'envoie rien en double
    const mark = db.collection("users").doc(uid).collection("bilans").doc(week.sunday);
    if (!(await claim(mark))) { stats.already++; continue; }
    try {
      await send({ to: user.email, subject: mail.subject, html: mail.html, text: mail.text });
      await mark.set({ status: "sent", sentAt: Date.now(), sessions: bilan.counts.sessions });
      stats.sent++;
    } catch (err) {
      stats.failed++;
      log(`Échec d'envoi pour ${shortId(uid)} : ${clean(err?.message)}`);
      await mark.delete().catch(() => {}); // pas de repère : le passage suivant réessaiera
    }
  }
  log(`Bilan du ${week.sunday}${dryRun ? " (essai, rien envoyé)" : ""} : ${stats.asked} demandé(s), ${stats.sent} ${dryRun ? "prêt(s)" : "envoyé(s)"}, ${stats.already} déjà envoyé(s), ${stats.noEmail} sans adresse vérifiée, ${stats.failed} échec(s).`);
  return stats;
}

async function claim(mark) {
  try {
    await mark.create({ status: "sending", startedAt: Date.now() });
    return true;
  } catch (err) {
    if (!(err?.code === 6 || err?.code === "already-exists" || /already exists/i.test(err?.message || ""))) throw err;
    const current = (await mark.get()).data() || {};
    if (current.status === "sending" && Date.now() - (current.startedAt || 0) > STALE_MS) {
      await mark.set({ status: "sending", startedAt: Date.now() });
      return true;
    }
    return false;
  }
}

/* ─── Aperçu local à partir d'un export TrackLift ──────── */
function preview(file, lang = "fr") {
  const data = JSON.parse(readFileSync(file, "utf8"));
  const bilan = buildBilan(data.sessionLogs || [], Date.now());
  const mail = bilanEmail(bilan, { lang, appUrl: process.env.APP_URL || "" });
  // à côté du fichier exporté, jamais dans le dossier de l'appli (il contient tes séances)
  const out = join(dirname(resolve(file)), "bilan-apercu.html");
  writeFileSync(out, mail.html);
  console.log(`${mail.subject}\n\n${mail.text}\n\nAperçu enregistré : ${out}`);
}

async function main() {
  if (process.argv[2] === "--apercu") return preview(process.argv[3], process.argv[4]);
  const { FIREBASE_SERVICE_ACCOUNT, GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
  const dryRun = process.env.DRY_RUN === "1";
  if (!FIREBASE_SERVICE_ACCOUNT || (!dryRun && (!GMAIL_USER || !GMAIL_APP_PASSWORD))) {
    console.log("Envoi des bilans pas encore configuré (secrets manquants) : voir tools/bilan/LISEZMOI.md.");
    return;
  }
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getAuth } = await import("firebase-admin/auth");
  initializeApp({ credential: cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });

  let send = async () => {};
  let transport = null;
  if (!dryRun) {
    const nodemailer = (await import("nodemailer")).default;
    transport = nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } });
    await transport.verify(); // mauvais mot de passe : on s'arrête avant de toucher aux repères
    send = message => transport.sendMail({ from: { name: "TrackLift", address: GMAIL_USER }, ...message });
  }
  try {
    const stats = await run({
      db: getFirestore(), auth: getAuth(), send, dryRun,
      force: process.env.FORCE === "1", appUrl: process.env.APP_URL || ""
    });
    if (stats.failed) process.exitCode = 1;
  } finally {
    transport?.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(err => { console.error(`Erreur : ${clean(err?.message)}`); process.exitCode = 1; });
}
