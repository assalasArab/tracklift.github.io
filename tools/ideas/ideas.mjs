/* ═══════════════════════════════════════════════════════════
   Boîte à idées : lire et vider les idées envoyées depuis l'appli
   (collection Firestore « ideas », que personne ne peut lire depuis l'appli).
   Clé du compte de service : fichier hors du dépôt, jamais committé —
     variable TRACKLIFT_SERVICE_ACCOUNT (chemin), sinon ~/.tracklift/service-account.json

   node tools/ideas/ideas.mjs list            toutes les idées (numéro, date, texte)
   node tools/ideas/ideas.mjs clear <id…>     supprimer les idées réglées
   node tools/ideas/ideas.mjs hook            résumé court pour le début d'une session Claude Code
                                              (rien si pas d'idée ou pas de clé)
   ═══════════════════════════════════════════════════════════ */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const keyPath = process.env.TRACKLIFT_SERVICE_ACCOUNT || join(homedir(), ".tracklift", "service-account.json");
const [command = "list", ...args] = process.argv.slice(2);

if (!existsSync(keyPath)) {
  if (command !== "hook") console.error(`Clé introuvable : ${keyPath}`);
  process.exit(command === "hook" ? 0 : 1);
}

const { initializeApp, cert } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
initializeApp({ credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))) });
const db = getFirestore();

const day = ms => new Date(ms).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

if (command === "clear") {
  const ids = args.filter(Boolean);
  if (!ids.length) { console.error("Donne les identifiants des idées à supprimer."); process.exit(1); }
  const batch = db.batch();
  ids.forEach(id => batch.delete(db.doc(`ideas/${id}`)));
  await batch.commit();
  console.log(`${ids.length} idée(s) supprimée(s).`);
} else {
  const snap = await db.collection("ideas").orderBy("createdAt").get();
  if (command === "hook") {
    if (!snap.empty) {
      console.log(`Boîte à idées TrackLift : ${snap.size} idée(s) en attente (node tools/ideas/ideas.mjs list dans WEBAPP-Forge-main).`);
      snap.docs.slice(0, 10).forEach(doc => console.log(`- [${doc.id}] ${String(doc.data().text || "").replace(/\s+/g, " ").slice(0, 200)}`));
    }
  } else if (snap.empty) console.log("Aucune idée en attente.");
  else snap.docs.forEach((doc, i) => {
    const d = doc.data();
    // l'identifiant de l'auteur n'est jamais affiché
    console.log(`${i + 1}. [${doc.id}] ${day(d.createdAt || 0)} (${d.lang || "?"}, ${d.version || "?"})\n   ${String(d.text || "").trim()}\n`);
  });
}
process.exit(0);
