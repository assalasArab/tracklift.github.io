/* ═══════════════════════════════════════════════════════════
   Nutrition — moteur de calcul énergétique (sèche / maintien / masse)
   Mifflin · Katch-McArdle · Cunningham · Harris-Benedict · Compendium MET 2024
   Monté à la demande dans #view-nutrition. IDs et classes préfixés nx-.
   ═══════════════════════════════════════════════════════════ */

import { illu as illuHtml } from "./illustrations.js?v=20261025a";

/* ---------- catalogue MET (Compendium of Physical Activities 2024) ---------- */
const MET = [
  { g: "Musculation", items: [
    { n: "Musculation modérée", m: 5.0, s: 1 },
    { n: "Musculation lourde / vigoureuse", m: 6.0, s: 1 },
    { n: "Circuit training / CrossFit", m: 8.0, s: 1 },
    { n: "Calisthenics vigoureux", m: 8.0, s: 1 }
  ] },
  { g: "Cardio léger à modéré", items: [
    { n: "Marche rapide 6 km/h", m: 4.3 },
    { n: "Vélo modéré", m: 6.8 },
    { n: "Rameur modéré", m: 7.0 },
    { n: "Elliptique", m: 5.0 },
    { n: "Natation modérée", m: 7.0 },
    { n: "Stepmill / escaliers", m: 9.0 }
  ] },
  { g: "Cardio intense", items: [
    { n: "Course 10 km/h", m: 9.8 },
    { n: "Course 12 km/h", m: 11.5 },
    { n: "HIIT / sprints", m: 10.0 },
    { n: "Vélo intense", m: 10.0 },
    { n: "Rameur intense", m: 12.0 },
    { n: "Corde à sauter", m: 11.8 }
  ] },
  { g: "Sports", items: [
    { n: "Football / basket", m: 7.5 },
    { n: "Boxe / sac de frappe", m: 7.8 },
    { n: "Tennis / padel", m: 7.3 },
    { n: "Yoga / mobilité", m: 2.5 }
  ] },
  { g: "Autre", items: [
    { n: "Personnalisé", m: 6.0, custom: 1 }
  ] }
];
const FLAT = {};
MET.forEach(g => g.items.forEach(i => { FLAT[i.n] = i; }));

/* ---------- catalogue compléments ---------- */
const SUPPS = [
  { id: "cafe", n: "Café", on: true, dose: 2, u: "tasses", mg: 95 },
  { id: "pwo", n: "Pre-workout", on: false, dose: 200, u: "mg caf." },
  { id: "whey", n: "Whey", on: true, dose: 30, u: "g/dose" },
  { id: "casein", n: "Caséine", on: false, dose: 30, u: "g/dose" },
  { id: "crea", n: "Créatine mono.", on: true, dose: 5, u: "g/j" },
  { id: "ba", n: "Bêta-alanine", on: false, dose: 3.2, u: "g/j" },
  { id: "citr", n: "Citrulline malate", on: false, dose: 8, u: "g" },
  { id: "eaa", n: "EAA / BCAA", on: false, dose: 10, u: "g" },
  { id: "omega", n: "Oméga-3", on: false, dose: 2, u: "g EPA+DHA" },
  { id: "vitd", n: "Vitamine D", on: false, dose: 2000, u: "UI" },
  { id: "magn", n: "Magnésium", on: false, dose: 300, u: "mg" },
  { id: "multi", n: "Multivitamines", on: false, dose: 1, u: "dose" },
  { id: "elec", n: "Électrolytes / sel", on: false, dose: 1, u: "dose" },
  { id: "burner", n: "Brûleur de graisse", on: false, dose: 200, u: "mg caf." }
];

const DEFAULT_S = () => ({
  sex: "h", bfMode: "known", goal: "rate", protBase: "bw", tab: "wkON", phase: "cut",
  quizStep: 0, quizDone: false,
  days: [1, 0, 1, 0, 1, 1, 0],
  acts: [
    { n: "Musculation lourde / vigoureuse", min: 75, sess: 4, met: 6.0 },
    { n: "Marche rapide 6 km/h", min: 35, sess: 3, met: 4.3 }
  ]
});
const DEFAULT_SUP = () => {
  const o = {};
  SUPPS.forEach(s => { o[s.id] = { on: s.on, dose: s.dose }; });
  return o;
};

const FIELDS = ["age", "height", "weight", "bf", "neck", "waist", "hip", "formula", "steps", "job", "fidget",
  "rate", "pct", "kcalDef", "targetBf", "recal", "prot", "fat", "cyc", "meals",
  "wkWake", "wkBed", "wkTrain", "wkWorkStart", "wkWorkEnd", "wkDur",
  "weWake", "weBed", "weTrain", "weDur", "caffSens", "exper", "maintAdj"];

const DNAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/* ---------- questionnaire ---------- */
const RESULT_ILLU = "nutri-10-resultat.png";
const illu = (file, cls = "nx-illu") => illuHtml(file, cls);

const PHASE_CHOICES = [
  ["cut", "Sèche", "Perdre du gras en gardant mon muscle", "nutri-choix-seche.png"],
  ["maint", "Maintien", "Garder mon poids et continuer à progresser", "nutri-choix-maintien.png"],
  ["gain", "Prise de masse", "Construire du muscle avec un léger surplus", "nutri-choix-masse.png"]
];

const STEPS = [
  { tag: "Ton objectif", img: "nutri-01-objectif.webp",
    q: () => "Qu'est-ce que tu veux faire en ce moment ?", hand: () => "tout le calcul s'adapte à ça",
    x: () => "<b>Sèche</b> : tu manges un peu moins que ce que tu dépenses, pour perdre du gras sans perdre ton muscle. <b>Maintien</b> : ton poids reste stable pendant que tu progresses. <b>Prise de masse</b> : un léger surplus pour construire du muscle. Tu pourras changer d'objectif plus tard sans tout refaire." },
  { tag: "Ton profil", img: "nutri-02-profil.png",
    q: () => "Parle-moi un peu de toi", hand: () => "sexe, âge, taille, poids",
    x: () => "Ces infos servent à calculer ton <b>métabolisme de base</b> : l'énergie que ton corps brûle au repos, juste pour fonctionner (cœur, cerveau, respiration). C'est en général 60 à 70 % de ce que tu dépenses dans une journée. Ton poids est repris de ta dernière pesée." },
  { tag: "Composition", img: "nutri-03-masse-grasse.png",
    q: () => "Tu connais ton taux de masse grasse ?", hand: () => "pas grave si non",
    x: () => "Ton muscle brûle bien plus d'énergie que ton gras. Connaître ton % de masse grasse rend le calcul plus précis. Pas d'idée ? Choisis <b>Ruban</b> et mesure ton tour de cou et ton tour de taille au niveau du nombril (2 minutes), ou <b>Aucune idée</b> : l'appli l'estimera." },
  { tag: "Au quotidien", img: "nutri-04-quotidien.png",
    q: () => "Tu bouges combien en dehors du sport ?", hand: () => "marche, boulot, bougeotte",
    x: () => "C'est le <b>NEAT</b> : tout ce que tu dépenses hors entraînement, en marchant, en restant debout ou en gigotant. D'une personne à l'autre, l'écart dépasse souvent 500 kcal par jour. Ta moyenne de pas est dans l'appli Santé ou Google Fit de ton téléphone." },
  { tag: "Entraînement", img: "nutri-05-entrainement.png",
    q: () => "Quelles séances fais-tu chaque semaine ?", hand: () => "muscu, cardio, sports…",
    x: () => "Ajoute chaque activité avec sa durée et son nombre de séances par semaine. Chaque sport a une intensité (sa valeur <b>MET</b>). L'appli compte seulement l'énergie dépensée en plus de ce que tu aurais brûlé au repos, pour ne rien compter deux fois." },
  { tag: "Le rythme", img: "nutri-06-rythme.png",
    q: () => S.phase === "cut" ? "À quelle vitesse veux-tu perdre ?" : S.phase === "gain" ? "À quelle vitesse veux-tu prendre ?" : "On garde ton poids stable",
    hand: () => S.phase === "cut" ? "doucement, c'est plus de muscle gardé" : S.phase === "gain" ? "trop vite, c'est surtout du gras" : "ajuste si besoin",
    x: () => S.phase === "cut"
      ? "Le plus simple : une vitesse en % de ton poids par semaine. Entre <b>0,5 et 1 %</b>, tu perds du gras sans sacrifier ton muscle ni ta force. Le <b>%MG visé</b> sert à estimer quand tu atteindras ton objectif. Avec le recalibrage, les calories s'ajustent toutes les 2 semaines, au fur et à mesure que ton poids baisse."
      : S.phase === "gain"
        ? "Ton muscle ne peut se construire qu'à une certaine vitesse : au-delà, le surplus part en gras. Entre <b>0,25 et 0,5 %</b> de ton poids par semaine, c'est l'idéal pour la plupart des gens. Ton expérience compte : un débutant progresse plus vite qu'un pratiquant avancé."
        : "Tes calories sont calées sur ta dépense : ton poids ne bouge pas, ton entraînement continue de progresser. Si ta balance monte ou descend sur 2 à 3 semaines, ajoute ou retire 100 à 200 kcal ici." },
  { tag: "Macros", img: "nutri-07-macros.png",
    q: () => "Comment répartir tes calories ?", hand: () => "les réglages par défaut sont bons",
    x: () => "<b>Protéines</b> : 1,8 à 2,4 g par kg de poids, pour garder et construire ton muscle. <b>Lipides</b> : au moins 0,6 à 0,8 g/kg, pour tes hormones. Le reste va aux <b>glucides</b>, ton carburant à l'entraînement. Le <b>cyclage</b> met plus de glucides les jours de séance et moins les jours de repos, sans changer le total de la semaine." },
  { tag: "Ta journée", img: "nutri-08-journee.png",
    q: () => "À quoi ressemble ta journée type ?", hand: () => "pour placer tes repas",
    x: () => "Choisis tes jours d'entraînement et tes horaires. Ça ne change pas tes calories : ça sert à construire ton <b>plan de journée</b>, avec les repas placés autour de ta séance et la caféine coupée assez tôt pour que tu dormes bien." },
  { tag: "Compléments", img: "nutri-09-complements.png",
    q: () => "Tu prends des compléments ?", hand: () => "le café compte aussi",
    x: () => "Coche ce que tu prends vraiment et ajuste la dose. L'appli les place au bon moment dans ta journée et te prévient en cas de souci, par exemple un pre-workout trop tard pour ton heure de coucher. Rien n'est obligatoire : ton alimentation passe avant." }
];

/* ---------- état du module ---------- */
let S = DEFAULT_S();
let SUP = DEFAULT_SUP();
let root = null;
let opts = {};
let lastR = null;
let lastFlags = [];
let proj = null;
let saveT = null;
let defaults = null;

/* ---------- helpers ---------- */
const $ = id => document.getElementById("nx-" + id);
const val = id => $(id).value;
const num = id => parseFloat(val(id)) || 0;
const nf = (v, d = 0) => Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const T = {
  parse(v) { const m = /^(\d{1,2}):(\d{2})/.exec(v || ""); return m ? (+m[1]) * 60 + (+m[2]) : 0; },
  fmt(min) { let m = Math.round(min); m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + "h" + String(m % 60).padStart(2, "0"); },
  // fin de journée : le coucher après minuit est ramené sur la même échelle
  bed(wake, bed) { return bed <= wake ? bed + 1440 : bed; }
};

/* ---------- gabarit ---------- */
function seg(id, items) {
  return `<div class="nx-seg" id="nx-${id}">` + items.map(([v, l, on]) =>
    `<button type="button" data-v="${v}" aria-pressed="${!!on}">${l}</button>`).join("") + `</div>`;
}
function ticks(list, id = "") {
  return `<div class="nx-ticks"${id ? ` id="nx-${id}"` : ""}>${list.map(t => `<span>${t}</span>`).join("")}</div>`;
}
function field(id, lab, attrs, extra = "") {
  return `<label class="nx-f"${extra}><span class="nx-lab">${lab}</span><input id="nx-${id}" ${attrs}></label>`;
}

function markup() {
  return `
  <div class="page-head">
    <h1 class="page-title" id="nx-title">Sèche</h1>
    <p class="page-subtitle" id="nx-sub"></p>
  </div>

  <div class="nx-phase">${seg("phaseSeg", [["cut", "Sèche", 1], ["maint", "Maintien"], ["gain", "Prise de masse"]])}</div>

  <div class="nx-quiz-head" id="nx-quizHead"></div>

  <div class="nx-layout">
  <!-- ================= ENTRÉES ================= -->
  <div class="nx-in">

    <div class="nx-group" data-step="0">
      <div class="nx-choices" id="nx-phaseChoices">
        ${PHASE_CHOICES.map(([v, l, d, img]) => `
          <button type="button" class="nx-choice" data-phase="${v}" aria-pressed="false">
            ${illu(img, "nx-choice-illu")}
            <span class="nx-choice-t"><b>${l}</b><span>${d}</span></span>
          </button>`).join("")}
      </div>
    </div>

    <div class="nx-group" data-step="1">
      <div class="nx-group-h"><h2>Profil</h2></div>
      <div class="nx-card">
        <label class="nx-f" style="margin-bottom:12px"><span class="nx-lab">Sexe</span>${seg("sexSeg", [["h", "Homme", 1], ["f", "Femme"]])}</label>
        <div class="nx-grid nx-g3">
          ${field("age", "Âge", 'type="number" inputmode="numeric" value="26" min="14" max="90" step="1"')}
          ${field("height", "Taille (cm)", 'type="number" inputmode="decimal" value="178" min="130" max="220" step="0.5"')}
          ${field("weight", "Poids (kg)", 'type="number" inputmode="decimal" value="82" min="35" max="250" step="0.1"')}
        </div>
      </div>
    </div>

    <div class="nx-group" data-step="2">
      <div class="nx-group-h"><h2>Composition corporelle</h2><span class="nx-hint" id="nx-lbmHint"></span></div>
      <div class="nx-card">
        ${seg("bfSeg", [["known", "%MG connu", 1], ["tape", "Ruban"], ["none", "Aucune idée"]])}
        <div style="margin-top:16px">
          <div id="nx-bfKnown" class="nx-slider">
            <div class="nx-slider-head"><span class="nx-lab">Masse grasse</span><span class="nx-val" id="nx-bfVal">18 %</span></div>
            <input type="range" id="nx-bf" min="4" max="50" step="0.5" value="18">
            ${ticks(["4", "10", "15", "20", "30", "40", "50"])}
          </div>
          <div id="nx-bfTape" hidden>
            <div class="nx-grid nx-g3">
              ${field("neck", "Cou (cm)", 'type="number" inputmode="decimal" value="39" step="0.5"')}
              ${field("waist", "Taille/nombril", 'type="number" inputmode="decimal" value="86" step="0.5"')}
              ${field("hip", "Hanches (cm)", 'type="number" inputmode="decimal" value="98" step="0.5"', ' id="nx-hipWrap" hidden')}
            </div>
            <p class="nx-note" style="margin-top:10px">Formule US Navy (Hodgdon-Beckett). Mesure le matin à jeun, ruban à plat sans serrer, marge d'erreur ~3–4 points.</p>
          </div>
          <p id="nx-bfNone" class="nx-note" hidden>Sans %MG, le moteur bascule automatiquement sur Mifflin-St Jeor et estime la masse maigre pour les protéines. Une simple mesure au ruban gagne en précision.</p>
        </div>
        <details class="nx-adv">
        <summary>Options avancées</summary>
        <label class="nx-f"><span class="nx-lab">Formule de métabolisme de base</span>
          <select id="nx-formula">
            <option value="auto" selected>Auto — Katch-McArdle si %MG connu, sinon Mifflin</option>
            <option value="mifflin">Mifflin-St Jeor (1990)</option>
            <option value="katch">Katch-McArdle (masse maigre)</option>
            <option value="cunningham">Cunningham (sportifs entraînés)</option>
            <option value="harris">Harris-Benedict révisée (Roza 1984)</option>
            <option value="avg">Moyenne des formules applicables</option>
          </select>
        </label>
        </details>
      </div>
    </div>

    <div class="nx-group" data-step="3">
      <div class="nx-group-h"><h2>Vie quotidienne — NEAT</h2><span class="nx-hint" id="nx-neatHint"></span></div>
      <div class="nx-card">
        <div class="nx-slider">
          <div class="nx-slider-head"><span class="nx-lab">Pas par jour</span><span class="nx-val" id="nx-stepsVal">8 000</span></div>
          <input type="range" id="nx-steps" min="1000" max="25000" step="250" value="8000">
          ${ticks(["1k", "5k", "10k", "15k", "20k", "25k"])}
        </div>
        <div class="nx-grid nx-g2" style="margin-top:16px">
          <label class="nx-f"><span class="nx-lab">Type de journée / travail</span>
            <select id="nx-job">
              <option value="0">Assis, bureau, télétravail</option>
              <option value="90" selected>Mixte, quelques déplacements</option>
              <option value="220">Debout la majorité du temps</option>
              <option value="400">Travail physique / port de charges</option>
            </select>
          </label>
          <label class="nx-f"><span class="nx-lab">Agitation spontanée</span>
            <select id="nx-fidget">
              <option value="0.88">Faible — je bouge peu</option>
              <option value="1" selected>Normale</option>
              <option value="1.15">Élevée — jamais en place</option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <div class="nx-group" data-step="4">
      <div class="nx-group-h"><h2>Entraînement — EAT</h2><span class="nx-hint" id="nx-eatHint"></span></div>
      <div class="nx-card">
        <div class="nx-act-head"><span>Activité (MET)</span><span>Min</span><span>×/sem</span><span></span></div>
        <div id="nx-acts"></div>
        <button type="button" class="nx-add" id="nx-addAct">Ajouter une activité</button>
      </div>
      <p class="nx-foot">Chaque séance est comptée en <b>MET net</b> — la dépense de repos est déduite pour ne pas la compter deux fois. Les séances ≥ 8 MET reçoivent +6 % d'EPOC.</p>
    </div>

    <div class="nx-group" data-step="5">
      <div class="nx-group-h"><h2>Objectif</h2><span class="nx-hint" id="nx-phaseHint"></span></div>
      <div class="nx-card">
        <div id="nx-expWrap" hidden style="margin-bottom:16px">
          <label class="nx-f"><span class="nx-lab">Expérience à l'entraînement</span>
            <select id="nx-exper">
              <option value="beg">Débutant — moins d'un an de pratique régulière</option>
              <option value="int" selected>Intermédiaire — 1 à 3 ans, progression encore nette</option>
              <option value="adv">Avancé — 3 ans et plus, progression lente</option>
            </select>
          </label>
        </div>

        <div id="nx-goalBox">
          ${seg("goalSeg", [["rate", "Par vitesse", 1], ["pct", "Par %"], ["kcal", "Écart fixe"]])}
          <div style="margin-top:16px">
            <div id="nx-goalRate" class="nx-slider">
              <div class="nx-slider-head"><span class="nx-lab" id="nx-rateLab">Perte hebdomadaire</span><span class="nx-val" id="nx-rateVal"></span></div>
              <input type="range" id="nx-rate" min="0.15" max="1.5" step="0.05" value="0.7">
              ${ticks(["0,15", "0,5", "0,75", "1,0", "1,25", "1,5"], "rateTicks")}
              <p class="nx-note" id="nx-rateNote" style="margin-top:8px"></p>
            </div>
            <div id="nx-goalPct" class="nx-slider" hidden>
              <div class="nx-slider-head"><span class="nx-lab" id="nx-pctLab">Déficit sous la maintenance</span><span class="nx-val" id="nx-pctVal">20 %</span></div>
              <input type="range" id="nx-pct" min="2" max="35" step="1" value="20">
              ${ticks(["2", "10", "20", "28", "35"])}
            </div>
            <div id="nx-goalKcal" hidden>
              <label class="nx-f"><span class="nx-lab" id="nx-kcalLab">Déficit (kcal/jour)</span><input type="number" inputmode="numeric" id="nx-kcalDef" value="500" min="50" max="1500" step="25"></label>
            </div>
          </div>
        </div>

        <div id="nx-maintBox" hidden>
          <p class="nx-note">Apport calé sur la maintenance : le poids reste stable, l'entraînement continue de progresser. C'est la phase à privilégier après une longue sèche, pendant une période chargée, ou pour laisser la composition corporelle évoluer lentement sans jouer sur la balance.</p>
          <label class="nx-f" style="margin-top:14px;max-width:260px"><span class="nx-lab">Ajustement manuel (kcal/jour)</span>
            <input type="number" inputmode="numeric" id="nx-maintAdj" value="0" min="-300" max="300" step="25">
          </label>
        </div>

        <div class="nx-sep"></div>
        <div class="nx-grid nx-g2">
          <label class="nx-f" id="nx-targetBfWrap"><span class="nx-lab" id="nx-targetBfLab">%MG visé</span><input type="number" inputmode="decimal" id="nx-targetBf" value="12" min="4" max="45" step="0.5"></label>
          <label class="nx-f"><span class="nx-lab">Pilotage</span>
            <select id="nx-recal">
              <option value="1" selected>Recalibrage toutes les 2 semaines</option>
              <option value="0">Calories figées jusqu'au bout</option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <div class="nx-group" data-step="6">
      <div class="nx-group-h"><h2>Macros &amp; répartition</h2></div>
      <div class="nx-card">
        <label class="nx-f" style="margin-bottom:16px"><span class="nx-lab">Base de calcul des protéines</span>
          ${seg("protBaseSeg", [["bw", "Poids total", 1], ["lbm", "Masse maigre"]])}
        </label>
        <div class="nx-slider">
          <div class="nx-slider-head"><span class="nx-lab" id="nx-protLab">Protéines (g/kg poids)</span><span class="nx-val" id="nx-protVal">2,20</span></div>
          <input type="range" id="nx-prot" min="1.4" max="3.4" step="0.05" value="2.2">
          ${ticks(["1,4", "1,9", "2,2", "2,6", "3,0", "3,4"])}
        </div>
        <div class="nx-slider">
          <div class="nx-slider-head"><span class="nx-lab">Lipides (g/kg poids)</span><span class="nx-val" id="nx-fatVal">0,80</span></div>
          <input type="range" id="nx-fat" min="0.4" max="1.6" step="0.05" value="0.8">
          ${ticks(["0,4", "0,6", "0,8", "1,0", "1,3", "1,6"])}
        </div>
        <div class="nx-slider">
          <div class="nx-slider-head"><span class="nx-lab">Cyclage glucidique ON/OFF</span><span class="nx-val" id="nx-cycVal">±15 %</span></div>
          <input type="range" id="nx-cyc" min="0" max="30" step="1" value="15">
          ${ticks(["0 (linéaire)", "15", "30"])}
        </div>
        <div class="nx-sep"></div>
        ${field("meals", "Repas par jour", 'type="number" inputmode="numeric" value="4" min="2" max="8" step="1"', ' style="max-width:180px"')}
      </div>
    </div>

    <div class="nx-group" data-step="7">
      <div class="nx-group-h"><h2>Rythme de journée</h2><span class="nx-hint" id="nx-dayHint"></span></div>
      <div class="nx-card">
        <span class="nx-lab">Jours d'entraînement</span>
        <div class="nx-days" id="nx-daysGrid"></div>

        <div class="nx-subhead">En semaine</div>
        <div class="nx-grid nx-g3">
          ${field("wkWake", "Réveil", 'type="time" value="06:45"')}
          ${field("wkBed", "Coucher", 'type="time" value="23:00"')}
          ${field("wkTrain", "Séance", 'type="time" value="18:30"')}
          ${field("wkWorkStart", "Début travail", 'type="time" value="09:00"')}
          ${field("wkWorkEnd", "Fin travail", 'type="time" value="17:30"')}
          ${field("wkDur", "Durée (min)", 'type="number" inputmode="numeric" value="75" min="20" max="180" step="5"')}
        </div>

        <div class="nx-subhead">Le week-end</div>
        <div class="nx-grid nx-g3">
          ${field("weWake", "Réveil", 'type="time" value="09:00"')}
          ${field("weBed", "Coucher", 'type="time" value="00:30"')}
          ${field("weTrain", "Séance", 'type="time" value="11:00"')}
          ${field("weDur", "Durée (min)", 'type="number" inputmode="numeric" value="80" min="20" max="180" step="5"')}
          <label class="nx-f" style="grid-column:span 2"><span class="nx-lab">Sensibilité à la caféine</span>
            <select id="nx-caffSens">
              <option value="4">Rapide — elle ne me tient pas</option>
              <option value="5.5" selected>Normale</option>
              <option value="8">Lente — un café à 16h me gâche la nuit</option>
            </select>
          </label>
        </div>
      </div>
    </div>

    <div class="nx-group" data-step="8">
      <div class="nx-group-h"><h2>Ce que tu consommes</h2><span class="nx-hint" id="nx-suppHint"></span></div>
      <div class="nx-card"><div class="nx-supps" id="nx-supps"></div></div>
      <p class="nx-foot">Active ce que tu prends réellement. Le plan de journée place chaque produit au bon moment et signale les conflits — typiquement une dose de caféine trop tardive pour ton heure de coucher.</p>
    </div>

    <div class="nx-quiz-nav">
      <button type="button" class="btn btn-ghost" id="nx-prev">Retour</button>
      <button type="button" class="btn btn-primary" id="nx-next">Continuer</button>
    </div>
  </div>

  <!-- ================= RÉSULTATS ================= -->
  <div class="nx-out">
   <div class="nx-sticky">

    <div class="nx-recap" id="nx-recap">
      ${illu(RESULT_ILLU, "nx-recap-illu")}
      <div class="nx-recap-t">
        <span class="nx-sticker">Ton plan est prêt</span>
        <p>Calculé à partir de tes réponses. Change une réponse et tout se recalcule.</p>
      </div>
      <div class="nx-recap-steps" id="nx-recapSteps"></div>
    </div>

    <div class="nx-hero">
      <span class="nx-hero-lab">Cible quotidienne</span>
      <div class="nx-kcal" id="nx-outKcal">0<small>kcal</small></div>
      <div class="nx-chips">
        <span class="nx-chip">Maintenance<b id="nx-outTdee">0</b></span>
        <span class="nx-chip"><span id="nx-outDefLab">Déficit</span><b><span id="nx-outDef">0</span> · <span id="nx-outDefPct">0</span> %</b></span>
        <span class="nx-chip"><span id="nx-outLossLab">Perte</span><b><span id="nx-outLoss">0</span> kg/sem</b></span>
      </div>
    </div>

    <div class="nx-block">
      <div class="nx-block-h"><h3>Décomposition de la dépense</h3><span id="nx-barTotal"></span></div>
      <svg id="nx-bar" class="nx-svg" viewBox="0 0 600 76" width="100%" role="img" aria-label="Décomposition de la dépense énergétique"></svg>
      <div class="nx-legend">
        <span><i style="background:var(--c-bmr)"></i>Métabolisme de base</span>
        <span><i style="background:var(--c-neat)"></i>NEAT</span>
        <span><i style="background:var(--c-eat)"></i>Entraînement</span>
        <span><i style="background:var(--c-tef)"></i>Effet thermique</span>
        <span><i style="background:var(--c-delta)"></i><span id="nx-legDelta">Déficit</span></span>
      </div>
    </div>

    <div class="nx-block">
      <div class="nx-block-h"><h3>Macros</h3><span id="nx-macroMeta"></span></div>
      <div class="nx-macros" id="nx-macros"></div>
      <p class="nx-note" id="nx-mealNote" style="margin-top:12px"></p>
      <table class="nx-cyc" id="nx-cycTable"></table>
    </div>

    <div class="nx-block">
      <div class="nx-block-h"><h3>Détail du calcul</h3></div>
      <div class="nx-stats" id="nx-stats"></div>
    </div>

    <div class="nx-block">
      <div class="nx-block-h"><h3>Projection sur 24 semaines</h3><span id="nx-chartMeta"></span></div>
      <div class="nx-chart">
        <div class="nx-chart-t"><i style="background:var(--c-weight)"></i>Poids (kg)</div>
        <svg id="nx-chartW" class="nx-svg" viewBox="0 0 620 150" width="100%" role="img" aria-label="Projection du poids"></svg>
        <div class="nx-tip" id="nx-tipW"></div>
      </div>
      <div class="nx-chart">
        <div class="nx-chart-t"><i style="background:var(--c-bf)"></i>Masse grasse (%)</div>
        <svg id="nx-chartBf" class="nx-svg" viewBox="0 0 620 150" width="100%" role="img" aria-label="Projection du taux de masse grasse"></svg>
        <div class="nx-tip" id="nx-tipBf"></div>
      </div>
      <div class="nx-legend">
        <span><i class="line" style="background:var(--c-weight)"></i>Avec recalibrage</span>
        <span><i class="dash"></i>Calories figées</span>
        <span><i class="line" style="background:var(--c-target)"></i><span id="nx-legTarget">%MG visé</span></span>
      </div>
      <div class="nx-eta" id="nx-eta"></div>
    </div>

    <div class="nx-block">
      <div class="nx-block-h"><h3>Plan de journée</h3><span id="nx-planMeta"></span></div>
      <div class="nx-seg nx-tabs" id="nx-planTabs"></div>
      <div class="nx-tl-meta" id="nx-planNote"></div>
      <div class="nx-tl" id="nx-timeline"></div>
    </div>

    <div class="nx-flags" id="nx-flags"></div>

    <div class="nx-actions">
      <button type="button" class="btn btn-primary" id="nx-pdfBtn">Exporter en PDF</button>
      <button type="button" class="btn btn-ghost" id="nx-copyBtn">Copier le résumé</button>
      <button type="button" class="btn btn-surface" id="nx-resetBtn">Réinitialiser</button>
    </div>
   </div>
  </div>
  </div>

  <div class="nx-about">
    <p><b>Ce que fait le moteur.</b> Métabolisme de base par la formule choisie · NEAT calculé à partir des pas (longueur de foulée dérivée de la taille, 3,5 MET) et de la posture de travail · entraînement en MET net issu du Compendium 2024 · effet thermique des aliments recalculé sur tes macros réelles (25 % protéines, 8 % glucides, 2 % lipides) par convergence · densité énergétique du tissu gagné ou perdu ajustée selon %MG, protéines, expérience et volume de musculation · adaptation métabolique en déficit, majoration du NEAT en surplus, appliquées semaine par semaine.</p>
    <p><b>Sur les protéines par repas.</b> Le plafond de 20 à 30 g par prise, longtemps répété, vient d'études qui arrêtaient de mesurer après 4 à 5 h. En suivant la réponse sur 12 h, Trommelen et al. (2023) trouvent une synthèse musculaire nettement supérieure avec 100 g qu'avec 25 g, sans limite haute, et une oxydation des acides aminés restant marginale. L'app répartit les protéines pour le confort et la satiété, pas parce qu'il y aurait un plafond à respecter.</p>
    <p><b>Ce qu'il ne fait pas.</b> Toute équation de métabolisme reste une estimation à ±10 %. Le vrai réglage se fait sur 2 à 3 semaines de poids moyens : si la balance ne bouge pas comme prévu, ce sont les calories réelles qu'il faut ajuster, pas la formule. Outil informatif, pas un avis médical ou diététique — pour un déficit long, un %MG bas ou un antécédent de trouble alimentaire, passe par un professionnel.</p>
  </div>`;
}

/* ---------- contrôles segmentés ---------- */
function syncSeg(id, key) {
  $(id).querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === S[key])));
}
function bindSeg(id, key, cb) {
  $(id).addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    S[key] = b.dataset.v; syncSeg(id, key);
    if (cb) cb();
    run();
  });
}
function syncVisibility() {
  $("hipWrap").hidden = S.sex !== "f";
  $("bfKnown").hidden = S.bfMode !== "known";
  $("bfTape").hidden = S.bfMode !== "tape";
  $("bfNone").hidden = S.bfMode !== "none";
  $("goalRate").hidden = S.goal !== "rate";
  $("goalPct").hidden = S.goal !== "pct";
  $("goalKcal").hidden = S.goal !== "kcal";
  $("protLab").textContent = S.protBase === "bw" ? "Protéines (g/kg poids)" : "Protéines (g/kg masse maigre)";
}
function syncAllSegs() {
  [["sexSeg", "sex"], ["bfSeg", "bfMode"], ["goalSeg", "goal"], ["protBaseSeg", "protBase"], ["phaseSeg", "phase"]]
    .forEach(([id, key]) => syncSeg(id, key));
}

/* ---------- reconfiguration selon la phase ---------- */
const PHASE = {
  cut: { t: "Sèche", sub: "Pas un multiplicateur d'activité à la louche. Métabolisme de base, marche, chaque séance en MET net, effet thermique réel des aliments, adaptation métabolique semaine par semaine.",
    rateLab: "Perte hebdomadaire", pctLab: "Déficit sous la maintenance", kcalLab: "Déficit (kcal/jour)",
    deltaLab: "Déficit", lossLab: "Perte", leg: "Déficit", bfLab: "%MG visé",
    rMin: 0.15, rMax: 1.5, rStep: 0.05, rDef: 0.7, pMin: 5, pMax: 35, pDef: 20,
    ticks: ["0,15", "0,5", "0,75", "1,0", "1,25", "1,5"] },
  maint: { t: "Maintien", sub: "Le poids reste stable, l'entraînement continue. La dépense est calculée poste par poste — base, marche, séances, digestion — pour que la maintenance soit un vrai chiffre et pas une devinette.",
    deltaLab: "Écart", lossLab: "Variation", leg: "Écart", bfLab: "%MG actuel" },
  gain: { t: "Prise de masse", sub: "Surplus mesuré, pas un chèque en blanc. Au-delà de ce que le muscle peut construire, chaque calorie en trop part en gras — le moteur cale le surplus sur ton expérience et ta vitesse de gain réelle.",
    rateLab: "Gain hebdomadaire", pctLab: "Surplus au-dessus de la maintenance", kcalLab: "Surplus (kcal/jour)",
    deltaLab: "Surplus", lossLab: "Gain", leg: "Surplus", bfLab: "%MG plafond",
    rMin: 0.05, rMax: 0.8, rStep: 0.05, rDef: 0.3, pMin: 2, pMax: 25, pDef: 10,
    ticks: ["0,05", "0,2", "0,35", "0,5", "0,65", "0,8"] }
};
function applyPhase() {
  const P = PHASE[S.phase], cut = S.phase === "cut", gain = S.phase === "gain", maint = S.phase === "maint";
  $("title").textContent = P.t;
  $("sub").textContent = P.sub;
  $("goalBox").hidden = maint; $("maintBox").hidden = !maint; $("expWrap").hidden = !gain;
  $("outDefLab").textContent = P.deltaLab; $("outLossLab").textContent = P.lossLab;
  $("legDelta").textContent = P.leg; $("targetBfLab").textContent = P.bfLab;
  $("legTarget").textContent = gain ? "%MG plafond" : "%MG visé";
  $("targetBfWrap").hidden = maint;
  if (!maint) {
    const r = $("rate");
    const wasDefault = Math.abs(parseFloat(r.value) - (cut ? PHASE.gain.rDef : PHASE.cut.rDef)) < 1e-9;
    r.min = P.rMin; r.max = P.rMax; r.step = P.rStep;
    if (wasDefault || parseFloat(r.value) < P.rMin || parseFloat(r.value) > P.rMax) r.value = P.rDef;
    $("rateTicks").innerHTML = P.ticks.map(t => `<span>${t}</span>`).join("");
    $("rateLab").textContent = P.rateLab; $("pctLab").textContent = P.pctLab; $("kcalLab").textContent = P.kcalLab;
    const p = $("pct");
    if (parseFloat(p.value) < P.pMin || parseFloat(p.value) > P.pMax) p.value = P.pDef;
    p.min = P.pMin; p.max = P.pMax;
    if (gain && num("kcalDef") > 600) $("kcalDef").value = 300;
    if (cut && num("kcalDef") < 200) $("kcalDef").value = 500;
    if (gain && num("targetBf") < num("bf")) $("targetBf").value = Math.round((parseFloat(val("bf")) + 5) * 2) / 2;
    if (cut && num("targetBf") > num("bf")) $("targetBf").value = Math.max(5, Math.round((parseFloat(val("bf")) - 6) * 2) / 2);
  }
}

/* ---------- lignes d'activité ---------- */
function optionsHtml(sel) {
  return MET.map(g => `<optgroup label="${g.g}">` +
    g.items.map(i => `<option value="${i.n}" ${i.n === sel ? "selected" : ""}>${i.n} — ${i.m} MET</option>`).join("") +
    `</optgroup>`).join("");
}
function renderActs() {
  const box = $("acts"); box.innerHTML = "";
  S.acts.forEach((a, idx) => {
    const row = document.createElement("div"); row.className = "nx-act";
    const custom = FLAT[a.n] && FLAT[a.n].custom;
    row.innerHTML =
      `<select data-i="${idx}" data-f="n" aria-label="Activité">${optionsHtml(a.n)}</select>` +
      `<label class="nx-mini"><input type="number" inputmode="numeric" data-i="${idx}" data-f="min" value="${a.min}" min="5" max="300" step="5" aria-label="Minutes par séance"><span>min</span></label>` +
      `<label class="nx-mini"><input type="number" inputmode="numeric" data-i="${idx}" data-f="sess" value="${a.sess}" min="0" max="14" step="1" aria-label="Séances par semaine"><span>×/sem</span></label>` +
      `<button type="button" class="nx-x" data-del="${idx}" aria-label="Supprimer">−</button>`;
    box.appendChild(row);
    if (custom) {
      const c = document.createElement("div"); c.className = "nx-act";
      c.innerHTML = `<span class="nx-note">Valeur MET personnalisée</span>
        <input type="number" inputmode="decimal" data-i="${idx}" data-f="met" value="${a.met}" min="1.5" max="20" step="0.1" aria-label="MET">`;
      box.appendChild(c);
    }
  });
}

/* ---------- physiologie ---------- */
function navyBF(sex, h, waist, neck, hip) {
  if (sex === "h") {
    const d = waist - neck; if (d <= 0) return null;
    return 495 / (1.0324 - 0.19077 * Math.log10(d) + 0.15456 * Math.log10(h)) - 450;
  }
  const d = waist + hip - neck; if (d <= 0) return null;
  return 495 / (1.29579 - 0.35004 * Math.log10(d) + 0.22100 * Math.log10(h)) - 450;
}
function estimateBF(sex, age, bmi) { // Deurenberg, filet de sécurité
  return 1.20 * bmi + 0.23 * age - 10.8 * (sex === "h" ? 1 : 0) - 5.4;
}
function bmrOf(f, sex, w, h, age, lbm) {
  const mifflin = 10 * w + 6.25 * h - 5 * age + (sex === "h" ? 5 : -161);
  const harris = sex === "h" ? 88.362 + 13.397 * w + 4.799 * h - 5.677 * age
    : 447.593 + 9.247 * w + 3.098 * h - 4.330 * age;
  const katch = lbm ? 370 + 21.6 * lbm : null;
  const cunn = lbm ? 500 + 22 * lbm : null;
  const map = { mifflin, harris, katch, cunningham: cunn };
  if (f === "auto") return { v: katch || mifflin, name: katch ? "Katch-McArdle" : "Mifflin-St Jeor", all: map };
  if (f === "avg") {
    const vals = [mifflin, harris].concat(katch ? [katch, cunn] : []);
    return { v: vals.reduce((a, b) => a + b, 0) / vals.length, name: "Moyenne", all: map };
  }
  const names = { mifflin: "Mifflin-St Jeor", harris: "Harris-Benedict", katch: "Katch-McArdle", cunningham: "Cunningham" };
  return { v: map[f] || mifflin, name: names[f] || "Mifflin-St Jeor", all: map };
}
function neatOf(sex, w, h, steps, job, fidget) {
  const stride = (sex === "h" ? 0.415 : 0.413) * h / 100; // m par pas
  const km = steps * stride / 1000;
  const hours = km / 4.8; // 4,8 km/h
  const walk = (3.5 - 1) * w * hours; // MET net
  const posture = job * (w / 75);
  return { walk, posture, km, total: (walk + posture) * fidget };
}
function eatOf(w, acts) {
  let wk = 0, strengthDays = 0;
  acts.forEach(a => {
    const met = a.met || 6, hrs = (a.min || 0) / 60, s = a.sess || 0;
    let k = (met - 1) * w * hrs * s;
    if (met >= 8) k *= 1.06; // EPOC
    wk += k;
    if (FLAT[a.n] && FLAT[a.n].s) strengthDays += s;
  });
  return { perDay: wk / 7, week: wk, strengthDays: Math.min(7, Math.round(strengthDays)) };
}
const tefOf = (p, c, f) => 0.25 * p * 4 + 0.08 * c * 4 + 0.02 * f * 9;

/* ---------- moteur ---------- */
function compute() {
  const sex = S.sex, age = num("age"), h = num("height"), w = num("weight");
  const bmi = w / Math.pow(h / 100, 2);

  // %MG
  let bf = null, bfSource = "";
  if (S.bfMode === "known") { bf = num("bf"); bfSource = "saisi"; }
  else if (S.bfMode === "tape") {
    bf = navyBF(sex, h, num("waist"), num("neck"), num("hip"));
    bfSource = "US Navy";
    if (bf !== null && isFinite(bf)) bf = clamp(bf, 3, 60); else bf = null;
  }
  const bfEst = bf !== null ? bf : clamp(estimateBF(sex, age, bmi), 3, 60);
  const lbm = w * (1 - bfEst / 100);
  const fm = w - lbm;

  // BMR / NEAT / EAT
  const B = bmrOf(val("formula"), sex, w, h, age, bf !== null ? lbm : null);
  const N = neatOf(sex, w, h, num("steps"), num("job"), parseFloat(val("fidget")));
  const E = eatOf(w, S.acts);
  const base = B.v + N.total + E.perDay; // hors TEF

  // macros fixes
  const pGkg = num("prot"), fGkg = num("fat");
  const protG = pGkg * (S.protBase === "bw" ? w : lbm);
  const fatG = fGkg * w;

  // maintenance : point fixe sur le TEF
  let maint0 = base * 1.12;
  for (let i = 0; i < 12; i++) {
    const carbKcal = Math.max(0, maint0 - protG * 4 - fatG * 9);
    maint0 = base + tefOf(protG, carbKcal / 4, fatG);
  }
  const maintCarb = Math.max(0, (maint0 - protG * 4 - fatG * 9) / 4);
  const maintTef = tefOf(protG, maintCarb, fatG);

  // densité énergétique du tissu gagné ou perdu
  const bfRef = sex === "h" ? 15 : 23;
  const gain = S.phase === "gain", maint = S.phase === "maint";
  let leanShare, eDens, fatShare;
  if (gain) {
    // part de muscle dans le tissu gagné : dépend de l'expérience, du %MG de départ et de la vitesse
    const exp = val("exper");
    leanShare = exp === "beg" ? 0.55 : exp === "int" ? 0.45 : 0.35;
    leanShare -= clamp((bfEst - bfRef) * 0.012, -0.10, 0.14); // plus on est gras, moins on partitionne bien
    if (E.strengthDays >= 3) leanShare += 0.05;
    if (pGkg >= 1.6) leanShare += 0.04;
    const rr = S.goal === "rate" ? num("rate") : 0.3;
    if (rr > 0.45) leanShare -= 0.10; // trop vite = surtout du gras
    leanShare = clamp(leanShare, 0.15, 0.70);
    fatShare = 1 - leanShare;
    eDens = leanShare * 1816 + fatShare * 7700;
  } else {
    fatShare = 0.78 + clamp((bfEst - bfRef) * 0.011, -0.14, 0.14);
    if (pGkg >= 2.2) fatShare += 0.04;
    if (E.strengthDays >= 3) fatShare += 0.03;
    const rawRate = S.goal === "rate" ? num("rate") : 0.7;
    if (rawRate > 1) fatShare -= 0.07;
    fatShare = clamp(fatShare, 0.55, 0.94);
    leanShare = 1 - fatShare;
    eDens = fatShare * 7700 + leanShare * 1816;
  }

  // écart visé : positif = déficit, négatif = surplus
  let delta;
  if (maint) delta = -num("maintAdj");
  else if (S.goal === "rate") delta = (num("rate") / 100 * w) * eDens / 7 * (gain ? -1 : 1);
  else if (S.goal === "pct") delta = maint0 * num("pct") / 100 * (gain ? -1 : 1);
  else delta = num("kcalDef") * (gain ? -1 : 1);

  // cible + point fixe TEF à l'apport ajusté
  let intake = maint0 - delta;
  for (let i = 0; i < 12; i++) {
    const carbKcal = Math.max(0, intake - protG * 4 - fatG * 9);
    intake = base + tefOf(protG, carbKcal / 4, fatG) - delta;
  }

  // garde-fous
  const floor = Math.max(B.v * 1.05, sex === "h" ? 1500 : 1200);
  let capped = false;
  if (!gain && intake < floor) { intake = floor; capped = true; }

  const carbG = Math.max(0, (intake - protG * 4 - fatG * 9) / 4);
  const tef = tefOf(protG, carbG, fatG);
  const tdee = base + tef;
  const realDelta = tdee - intake;
  const defPct = Math.abs(realDelta) / tdee * 100;
  const lossKg = realDelta * 7 / eDens;

  return { sex, age, h, w, bmi, bf, bfEst, bfSource, lbm, fm, B, N, E, base, tef, tdee, maint: maint0, maintTef,
    intake, protG, fatG, carbG, deficit: realDelta, defPct, lossKg, eDens, fatShare, leanShare, floor, capped,
    phase: S.phase, gain, isMaint: maint,
    pGkg, fGkg, targetBf: num("targetBf"), recal: val("recal") === "1" };
}

/* ---------- projection 24 semaines ---------- */
function project(R, fixedIntake) {
  const out = []; let w = R.w, lbm = R.lbm, fm = R.fm, intake = R.intake, eta = null;
  const stepsN = num("steps"), job = num("job"), fid = parseFloat(val("fidget")), F = val("formula");
  const up = R.gain;
  for (let wk = 0; wk <= 24; wk++) {
    const bfp = fm / w * 100;
    out.push({ wk, w, bf: bfp, intake });
    if (eta === null && (up ? bfp >= R.targetBf : bfp <= R.targetBf)) eta = { wk, w };
    if (wk === 24) break;

    const B = bmrOf(F, R.sex, w, R.h, R.age, R.bf !== null ? lbm : null).v;
    const N = neatOf(R.sex, w, R.h, stepsN, job, fid).total;
    const Ee = eatOf(w, S.acts).perDay;
    const carb = Math.max(0, (intake - R.protG * 4 - R.fatG * 9) / 4);
    const t = tefOf(R.protG, carb, R.fatG);
    const raw = B + N + Ee + t;
    let tdee;
    if (up) {
      // en surplus, le NEAT grimpe légèrement (thermogenèse d'activité) : le surplus réel est un peu rogné
      const sPct = clamp((intake - raw) / raw, 0, 0.3);
      tdee = raw * (1 + sPct * 0.22);
    } else {
      // adaptation métabolique progressive, plafonnée par l'ampleur du déficit
      const dPct = clamp((raw - intake) / raw, 0, 0.5);
      const maxAdapt = clamp(dPct * 0.42, 0, 0.13);
      const adapt = maxAdapt * (1 - Math.exp(-wk / 5));
      tdee = (B + N + Ee) * (1 - adapt) + t;
    }

    const dKcal = intake - tdee; // >0 : on prend, <0 : on perd
    const dKg = dKcal / R.eDens * 7;
    fm = Math.max(w * 0.03, fm + dKg * R.fatShare);
    lbm = Math.max(1, lbm + dKg * R.leanShare);
    w = fm + lbm;

    if (!fixedIntake && R.recal && wk % 2 === 1 && !R.isMaint) {
      const target = S.goal === "rate" ? (num("rate") / 100 * w) * R.eDens / 7
        : S.goal === "pct" ? tdee * num("pct") / 100
          : num("kcalDef");
      intake = up ? tdee + target : Math.max(Math.max(B * 1.05, R.sex === "h" ? 1500 : 1200), tdee - target);
    } else if (!fixedIntake && R.recal && wk % 2 === 1 && R.isMaint) {
      intake = tdee + num("maintAdj");
    }
  }
  return { series: out, eta };
}

/* ---------- rendu : barre de dépense ---------- */
function drawBar(R) {
  const svg = $("bar");
  const W = Math.max(280, Math.round(svg.clientWidth) || 600), segH = 28, gapPx = 2;
  svg.setAttribute("viewBox", `0 0 ${W} 76`);
  const parts = [
    { k: "bmr", v: R.B.v, l: "Métabolisme de base", txt: "nx-t-on" },
    { k: "neat", v: R.N.total, l: "NEAT", txt: "nx-t-dark" },
    { k: "eat", v: R.E.perDay, l: "Entraînement", txt: "nx-t-dark" },
    { k: "tef", v: R.tef, l: "Effet thermique", txt: "nx-t-dark" }
  ];
  const span = Math.max(R.tdee, R.intake), sc = W / span;
  let x = 0;
  let g = `<defs><pattern id="nx-hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
    <rect class="nx-hatch-bg" width="7" height="7"/><line class="nx-hatch-ln" x1="0" y1="0" x2="0" y2="7"/></pattern></defs>`;
  parts.forEach(p => {
    const wpx = p.v * sc;
    g += `<rect class="nx-f-${p.k}" x="${x.toFixed(1)}" y="0" width="${Math.max(0, wpx - gapPx).toFixed(1)}" height="${segH}" rx="5"><title>${p.l} : ${nf(p.v)} kcal</title></rect>`;
    if (wpx > 52) g += `<text class="${p.txt}" x="${(x + 8).toFixed(1)}" y="18.5" pointer-events="none">${nf(p.v)}</text>`;
    x += wpx;
  });
  // ligne 2 : apport, avec l'écart hachuré du côté qui manque ou qui dépasse
  const base2 = Math.min(R.intake, R.tdee) * sc, gap = Math.abs(R.deficit) * sc, y2 = segH + 16;
  g += `<rect class="nx-f-in" x="0" y="${y2}" width="${Math.max(0, base2 - gapPx).toFixed(1)}" height="${segH}" rx="5"><title>Apport : ${nf(R.intake)} kcal</title></rect>`;
  g += `<text class="nx-t-on" x="8" y="${y2 + 18.5}" pointer-events="none">Apport ${nf(R.intake)}</text>`;
  if (gap > 0.5) {
    g += `<rect x="${base2.toFixed(1)}" y="${y2}" width="${gap.toFixed(1)}" height="${segH}" rx="5" fill="url(#nx-hatch)"><title>${PHASE[R.phase].leg} : ${nf(Math.abs(R.deficit))} kcal</title></rect>`;
    if (gap > 60) g += `<text class="nx-t-dark" x="${(base2 + 8).toFixed(1)}" y="${y2 + 18.5}" pointer-events="none">${R.gain ? "+" : "−"}${nf(Math.abs(R.deficit))}</text>`;
  }
  $("bar").innerHTML = g;
  $("barTotal").textContent = nf(R.tdee) + " kcal/j";
}

/* ---------- rendu : projection (deux graphiques, un axe chacun) ---------- */
let CW = 620;
const CH = 150, PAD = { l: 40, r: 12, t: 10, b: 24 };
const PX = i => PAD.l + (i / 24) * (CW - PAD.l - PAD.r);

function scaleY(min, max) {
  return v => PAD.t + (1 - (v - min) / (max - min)) * (CH - PAD.t - PAD.b);
}
function axesSvg(min, max, Y, d) {
  let g = "";
  for (let i = 0; i <= 3; i++) {
    const v = max - (max - min) * i / 3, y = Y(v);
    g += `<line class="nx-grid-l" x1="${PAD.l}" y1="${y.toFixed(1)}" x2="${CW - PAD.r}" y2="${y.toFixed(1)}"/>`;
    g += `<text class="nx-t-axis" x="${PAD.l - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${nf(v, d)}</text>`;
  }
  (CW < 420 ? [0, 6, 12, 18, 24] : [0, 4, 8, 12, 16, 20, 24]).forEach(k => {
    g += `<text class="nx-t-axis" x="${PX(k).toFixed(1)}" y="${CH - 6}" text-anchor="middle">S${k}</text>`;
  });
  return g;
}
const pathOf = (s, f, Y) => s.map((d, i) => (i ? "L" : "M") + PX(i).toFixed(1) + " " + Y(f(d)).toFixed(1)).join(" ");

function drawChart(R) {
  const A = project(R, false), B = project(R, true);
  CW = Math.max(280, Math.round($("chartW").clientWidth) || 620);
  ["chartW", "chartBf"].forEach(id => $(id).setAttribute("viewBox", `0 0 ${CW} ${CH}`));

  // poids : courbe pilotée + courbe sans recalibrage
  const ws = A.series.map(d => d.w).concat(B.series.map(d => d.w));
  let wMin = Math.min(...ws), wMax = Math.max(...ws);
  const pw = Math.max(1.2, (wMax - wMin) * 0.12); wMin -= pw; wMax += pw;
  const Yw = scaleY(wMin, wMax);
  let g = axesSvg(wMin, wMax, Yw, 1);
  g += `<path class="nx-l-ref" d="${pathOf(B.series, d => d.w, Yw)}"/>`;
  g += `<path class="nx-l-w" d="${pathOf(A.series, d => d.w, Yw)}"/>`;
  g += `<circle class="nx-dot-w" cx="${PX(24).toFixed(1)}" cy="${Yw(A.series[24].w).toFixed(1)}" r="4.5"/>`;
  g += `<g class="nx-hover"></g><rect x="${PAD.l}" y="0" width="${CW - PAD.l - PAD.r}" height="${CH}" fill="transparent"/>`;
  $("chartW").innerHTML = g;

  // %MG : courbe pilotée + ligne cible
  const bfs = A.series.map(d => d.bf);
  let bMin = Math.min(...bfs, R.targetBf), bMax = Math.max(...bfs, R.isMaint ? -Infinity : R.targetBf);
  const pb = Math.max(1, (bMax - bMin) * 0.15); bMin -= pb; bMax += pb;
  const Yb = scaleY(bMin, bMax);
  g = axesSvg(bMin, bMax, Yb, 1);
  if (!R.isMaint) g += `<line class="nx-l-target" x1="${PAD.l}" y1="${Yb(R.targetBf).toFixed(1)}" x2="${CW - PAD.r}" y2="${Yb(R.targetBf).toFixed(1)}"/>`;
  g += `<path class="nx-l-bf" d="${pathOf(A.series, d => d.bf, Yb)}"/>`;
  g += `<circle class="nx-dot-bf" cx="${PX(24).toFixed(1)}" cy="${Yb(A.series[24].bf).toFixed(1)}" r="4.5"/>`;
  g += `<g class="nx-hover"></g><rect x="${PAD.l}" y="0" width="${CW - PAD.l - PAD.r}" height="${CH}" fill="transparent"/>`;
  $("chartBf").innerHTML = g;

  proj = { A, B, Yw, Yb, recal: R.recal };

  const d24 = A.series[24];
  $("chartMeta").textContent = R.recal ? "recalibrage /2 sem" : "calories figées";
  const eta = A.eta;
  if (R.isMaint) {
    $("eta").innerHTML = `Poids projeté stable autour de <b>${nf(d24.w, 1)} kg</b> sur 24 semaines. Le %MG peut bouger seul si tu progresses à l'entraînement.`;
  } else if (eta) {
    const dt = new Date(Date.now() + eta.wk * 7 * 864e5);
    $("eta").innerHTML = `${R.gain ? "Plafond" : "Objectif"} <b>${nf(R.targetBf, 1)} % MG</b> atteint vers la <b>semaine ${eta.wk}</b> — ${dt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}, autour de <b>${nf(eta.w, 1)} kg</b>.${R.gain ? " C'est le moment de passer en maintien ou en mini-sèche." : ""}`;
  } else if (R.gain) {
    $("eta").innerHTML = `Tu restes sous ton plafond de <b>${nf(R.targetBf, 1)} % MG</b> sur 24 semaines : projection à <b>${nf(d24.w, 1)} kg</b> / <b>${nf(d24.bf, 1)} %</b>, soit <b>+${nf(d24.w - R.w, 1)} kg</b> dont environ <b>${nf((d24.w - R.w) * R.leanShare, 1)} kg</b> de masse maigre.`;
  } else {
    $("eta").innerHTML = `À ce rythme, <b>${nf(R.targetBf, 1)} % MG</b> n'est pas atteint en 24 semaines : projection à <b>${nf(d24.w, 1)} kg</b> / <b>${nf(d24.bf, 1)} %</b>. Allonge la sèche ou augmente légèrement le déficit.`;
  }
  return A;
}

/* survol synchronisé des deux graphiques */
function showHover(i) {
  if (!proj) return;
  const a = proj.A.series[i], b = proj.B.series[i], x = PX(i).toFixed(1);
  const cross = `<line class="nx-cross" x1="${x}" y1="${PAD.t}" x2="${x}" y2="${CH - PAD.b}"/>`;
  $("chartW").querySelector(".nx-hover").innerHTML = cross +
    `<circle class="nx-dot-w" cx="${x}" cy="${proj.Yw(a.w).toFixed(1)}" r="5"/>`;
  $("chartBf").querySelector(".nx-hover").innerHTML = cross +
    `<circle class="nx-dot-bf" cx="${x}" cy="${proj.Yb(a.bf).toFixed(1)}" r="5"/>`;
  const left = clamp(PX(i) / CW * 100, 14, 86) + "%";
  const tw = $("tipW"), tb = $("tipBf");
  tw.innerHTML = `<b>Semaine ${i}</b> · ${nf(a.w, 1)} kg` + (proj.recal ? `<br>calories figées : ${nf(b.w, 1)} kg` : "");
  tb.innerHTML = `<b>Semaine ${i}</b> · ${nf(a.bf, 1)} % MG<br>apport ${nf(a.intake)} kcal/j`;
  [tw, tb].forEach(t => { t.style.left = left; t.classList.add("on"); });
}
function hideHover() {
  ["chartW", "chartBf"].forEach(id => { const h = $(id).querySelector(".nx-hover"); if (h) h.innerHTML = ""; });
  ["tipW", "tipBf"].forEach(id => $(id).classList.remove("on"));
}
function bindHover(id) {
  const svg = $(id);
  const move = e => {
    const r = svg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * CW;
    showHover(clamp(Math.round((x - PAD.l) / (CW - PAD.l - PAD.r) * 24), 0, 24));
  };
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerdown", move);
  svg.addEventListener("pointerleave", hideHover);
}

/* ---------- points de vigilance ---------- */
function drawFlags(R, A) {
  const f = [];
  const cls = { "✓": "good", "▲": "warn", "!": "bad", "·": "" };
  const push = (ic, html) => f.push({ ic, cls: cls[ic], html });
  const wkPct = Math.abs(R.lossKg) / R.w * 100;

  if (R.capped) push("!", `Le déficit demandé passait sous le plancher de sécurité. L'apport est remonté à <b>${nf(R.intake)} kcal</b> (métabolisme de base +5 %). Ralentis la perte ou ajoute du cardio plutôt que de couper davantage.`);

  if (R.isMaint) {
    push("✓", `Apport calé sur la maintenance : <b>${nf(R.intake)} kcal</b>. Attends-toi à ±0,5 kg de variation liée à l'eau et au glycogène, sans que ce soit du gras.`);
    push("·", `En maintien, la progression se lit à la salle, pas sur la balance. Si la force monte à poids constant, tu recomposes — c'est exactement ce que tu cherches.`);
  } else if (R.gain) {
    if (wkPct > 0.55) push("▲", `<b>+${nf(wkPct, 2)} % du poids par semaine</b> : au-delà de 0,5 %, la part de gras dans ce que tu prends grimpe vite. Sur ton profil, le moteur estime déjà <b>${nf(R.fatShare * 100)} % de gras</b> dans le tissu gagné.`);
    else if (wkPct < 0.1) push("·", `<b>+${nf(wkPct, 2)} %/semaine</b> : c'est proche de la maintenance. Tenable très longtemps, mais la construction musculaire sera à peine mesurable.`);
    else push("✓", `<b>+${nf(wkPct, 2)} %/semaine</b> : dans la fenêtre 0,25–0,5 % qui maximise le ratio muscle/gras.`);

    push("·", `Partition estimée : <b>${nf(R.leanShare * 100)} % masse maigre / ${nf(R.fatShare * 100)} % gras</b>. Sur 24 semaines, ça fait environ ${nf(Math.abs(R.lossKg) * 24 * R.leanShare, 1)} kg de maigre pour ${nf(Math.abs(R.lossKg) * 24 * R.fatShare, 1)} kg de gras.`);
    if (R.bfEst > (R.sex === "h" ? 18 : 28)) push("▲", `À <b>${nf(R.bfEst, 1)} % MG</b>, la partition des calories est défavorable. Une sèche courte avant de repartir en surplus donnerait un bien meilleur rendement.`);
    if (R.E.strengthDays < 3) push("!", `Moins de 3 séances de musculation par semaine : sans stimulus mécanique suffisant, un surplus ne construit pas du muscle, il construit du gras. C'est l'entraînement qui décide où vont les calories.`);
    if (R.pGkg < 1.6) push("▲", `Protéines à <b>${nf(R.pGkg, 2)} g/kg</b> : en surplus, 1,6 g/kg est le minimum pour que les calories supplémentaires servent à quelque chose.`);
    if (R.pGkg > 2.6) push("·", `<b>${nf(R.pGkg, 2)} g/kg</b> de protéines. En surplus, 1,6 à 2,2 g/kg suffisent — au-delà tu manges sur ton budget glucides, qui est le carburant de la séance.`);
  } else {
    if (wkPct > 1.05) push("▲", `<b>${nf(wkPct, 2)} % du poids par semaine</b> : au-dessus de la zone 0,5–1 % qui préserve le muscle et la performance. Tenable en mini-cut court, coûteux sur 3 mois.`);
    else if (wkPct < 0.3) push("·", `<b>${nf(wkPct, 2)} %/semaine</b> : rythme très doux, confortable mais long. Adapté en fin de sèche ou si tu es déjà sec.`);
    else push("✓", `<b>${nf(wkPct, 2)} %/semaine</b> : dans la fenêtre 0,5–1 % recommandée pour garder le muscle et la force.`);

    if (R.defPct > 25) push("▲", `Déficit à <b>${nf(R.defPct)} %</b> de la maintenance. Au-delà de 25 %, la fatigue et la baisse de NEAT annulent souvent une partie du gain.`);

    if (R.pGkg < 1.6) push("!", `Protéines à <b>${nf(R.pGkg, 2)} g/kg</b> : sous ce seuil la perte de masse maigre grimpe nettement en déficit. Vise 1,9 g/kg minimum.`);
    else if (R.pGkg > 3.2) push("▲", `<b>${nf(R.pGkg, 2)} g/kg</b> de protéines : au-delà de ~3,2 g/kg le bénéfice supplémentaire est marginal, et ça mange sur tes glucides.`);
    if (R.E.strengthDays < 2) push("▲", `Moins de 2 séances de musculation par semaine : c'est le facteur numéro un de rétention musculaire en sèche, avant même les protéines.`);
  }

  if (R.fGkg < 0.6) push("▲", `Lipides à <b>${nf(R.fGkg, 2)} g/kg</b>. Sous 0,6 g/kg, hormones et absorption des vitamines liposolubles trinquent sur la durée.`);
  const ckg = R.carbG / R.w;
  if (ckg < 2 && !R.gain) push("▲", `Glucides à <b>${nf(ckg, 2)} g/kg</b> : les grosses séances vont piquer. Si la force chute, prends sur les lipides plutôt que sur les protéines.`);

  if (num("steps") < 6000) push("·", `<b>${nf(num("steps"))} pas/jour</b>. Monter à 9–10k ajoute environ ${nf(neatOf(R.sex, R.w, R.h, 10000, 0, 1).walk - neatOf(R.sex, R.w, R.h, num("steps"), 0, 1).walk)} kcal/jour ${R.gain ? "de dépense — en surplus, ça se compense simplement en mangeant un peu plus, et le cardio léger améliore la récupération." : "sans toucher à l'assiette ni à la récupération."}`);

  const wks = A.eta ? A.eta.wk : 24;
  if (!R.isMaint && wks > 10 && !R.gain) push("·", `Sèche longue (${wks}+ semaines) : prévois une <b>pause diète de 7 à 10 jours à la maintenance</b> toutes les 8 à 10 semaines. Ça restaure la leptine, le NEAT et la tête, pour un coût minime sur le résultat final.`);
  if (R.gain) push("·", `Une prise de masse a une durée utile : <b>12 à 20 semaines</b>. Au-delà, le ratio muscle/gras se dégrade et il vaut mieux passer en maintien ou en mini-sèche.`);

  push("·", `Eau : environ <b>${nf(R.w * 35 / 1000, 1)} L/jour</b> + 0,5 L par heure d'entraînement. Fibres : vise <b>${nf(R.intake / 1000 * 14)} g</b>.`);
  push("·", `Pilotage réel : pèse-toi tous les matins à jeun et ne regarde que la <b>moyenne sur 7 jours</b>. Si après 2–3 semaines l'écart avec la projection dépasse 30 %, ajuste les calories de ±100 à 150, pas la formule.`);

  lastFlags = f;
  $("flags").innerHTML = f.map(x => `<div class="nx-flag ${x.cls}"><span class="ic" aria-hidden="true">${x.ic}</span><span>${x.html}</span></div>`).join("");
}

/* ---------- boucle principale ---------- */
function paintRanges() {
  root.querySelectorAll("input[type=range]").forEach(r => {
    const p = (parseFloat(r.value) - parseFloat(r.min)) / (parseFloat(r.max) - parseFloat(r.min)) * 100;
    r.style.setProperty("--p", clamp(p, 0, 100) + "%");
  });
}

function run() {
  if (!root) return;
  const R = compute();
  paintRanges();

  $("bfVal").textContent = nf(num("bf"), 1) + " %";
  $("stepsVal").textContent = nf(num("steps"));
  $("protVal").textContent = nf(num("prot"), 2);
  $("fatVal").textContent = nf(num("fat"), 2);
  $("cycVal").textContent = "±" + nf(num("cyc")) + " %";
  $("pctVal").textContent = nf(num("pct")) + " %";
  $("rateVal").textContent = (R.gain ? "+" : "") + nf(num("rate"), 2) + " % · " + (R.gain ? "+" : "") + nf(num("rate") / 100 * R.w, 2) + " kg/sem";
  const rv = num("rate");
  if (R.gain) {
    $("rateNote").innerHTML = rv < 0.15 ? "Quasi maintenance : très propre, mais la prise sera à peine mesurable sur 3 mois."
      : rv <= 0.5 ? "Zone recommandée : c'est le rythme qui maximise la part de muscle dans ce que tu prends."
        : "Zone agressive : au-delà de 0,5 %/semaine, l'excédent va majoritairement au tissu adipeux. Réservé aux vrais débutants.";
  } else {
    $("rateNote").innerHTML = rv < 0.35 ? "Zone fin de sèche / préparation scène : très économe en muscle, mais lent."
      : rv <= 1 ? "Zone recommandée : meilleur compromis entre vitesse de perte et rétention de muscle et de force."
        : "Zone agressive : réservée à un %MG de départ élevé ou à un mini-cut de 3 à 4 semaines.";
  }
  $("phaseHint").textContent = R.isMaint ? "poids stable" : R.gain ? "surplus contrôlé" : "déficit";
  $("lbmHint").textContent = `MM ${nf(R.lbm, 1)} kg · MG ${nf(R.fm, 1)} kg${R.bf === null ? " (estimé)" : ""}`;
  $("neatHint").textContent = `${nf(R.N.km, 1)} km · ${nf(R.N.total)} kcal/j`;
  $("eatHint").textContent = `${nf(R.E.week)} kcal/sem · ${nf(R.E.perDay)} kcal/j`;

  // lecture principale
  $("outKcal").innerHTML = nf(R.intake) + "<small>kcal</small>";
  $("outTdee").textContent = nf(R.tdee);
  $("outDef").textContent = (R.gain ? "+" : "") + nf(Math.abs(R.deficit));
  $("outDefPct").textContent = nf(R.defPct);
  $("outLoss").textContent = (R.gain ? "+" : "") + nf(Math.abs(R.lossKg), 2);
  $("moKcal").textContent = nf(R.intake) + " kcal";
  $("moMacros").textContent = `P ${nf(R.protG)} · G ${nf(R.carbG)} · L ${nf(R.fatG)}`;

  drawBar(R);

  const st = [
    ["Métabolisme de base", nf(R.B.v), "kcal · " + R.B.name],
    ["NEAT", nf(R.N.total), "kcal"],
    ["Entraînement", nf(R.E.perDay), "kcal"],
    ["Effet thermique", nf(R.tef), "kcal"],
    ["Maintenance", nf(R.maint), "kcal"],
    ["IMC", nf(R.bmi, 1), ""],
    ["Masse maigre", nf(R.lbm, 1), "kg"],
    ["Masse grasse", nf(R.bfEst, 1), "% · " + (R.bfSource || "estimé")],
    [R.gain ? "Densité du tissu gagné" : "Densité du tissu perdu", nf(R.eDens), "kcal/kg"],
    [R.gain ? "Part masse maigre" : "Part de gras", nf((R.gain ? R.leanShare : R.fatShare) * 100), "%"]
  ];
  $("stats").innerHTML = st.map(s => `<div class="nx-stat"><span class="k">${s[0]}</span><span class="v">${s[1]}<span class="u">${s[2]}</span></span></div>`).join("");

  const pk = R.protG * 4, ck = R.carbG * 4, fk = R.fatG * 9;
  const fib = Math.round(R.intake / 1000 * 14);
  const mac = [
    ["Protéines", nf(R.protG), "g", pk / R.intake * 100, nf(R.protG / R.w, 2) + " g/kg", "var(--c-bmr)"],
    ["Glucides", nf(R.carbG), "g", ck / R.intake * 100, nf(R.carbG / R.w, 2) + " g/kg", "var(--c-neat)"],
    ["Lipides", nf(R.fatG), "g", fk / R.intake * 100, nf(R.fatG / R.w, 2) + " g/kg", "var(--c-tef)"],
    ["Fibres", nf(fib), "g", null, "14 g / 1000 kcal", "var(--c-eat)"]
  ];
  $("macroMeta").textContent = `${nf(R.intake)} kcal`;
  $("macros").innerHTML = mac.map(m =>
    `<div class="nx-macro"><span class="m-k"><i style="background:${m[5]}"></i>${m[0]}</span>
      <div class="m-v">${m[1]}<s> ${m[2]}</s></div>
      <div class="m-x">${m[3] === null ? "" : nf(m[3]) + " % · "}${m[4]}</div>
      <div class="m-bar"><div style="width:${m[3] === null ? 100 : Math.min(100, m[3])}%;background:${m[5]}"></div></div></div>`).join("");

  const meals = Math.max(2, Math.round(num("meals")));
  const perMeal = R.protG / meals;
  $("mealNote").innerHTML = `Sur <b>${meals} repas</b> : environ <b>${nf(perMeal)} g</b> de protéines par prise. Le plafond des 30 g par repas est un artefact d'études trop courtes — la réponse anabolique n'a pas de limite haute démontrée sur 12 h. ${perMeal < 25 ? "Ta dose par repas est modeste, mais c'est le total quotidien qui compte." : "Si tu préfères manger en 2 ou 3 gros repas, le total quotidien reste ce qui compte."}`;

  // cyclage
  const cyc = num("cyc") / 100, onD = clamp(R.E.strengthDays, 0, 7), offD = 7 - onD;
  let rows = `<tr><th>Jour</th><th>kcal</th><th>Prot</th><th>Gluc</th><th>Lip</th></tr>`;
  if (cyc > 0 && onD > 0 && offD > 0) {
    const onK = R.intake * (1 + cyc), offK = (R.intake * 7 - onK * onD) / offD;
    [["Entraînement ×" + onD, onK, 1], ["Repos ×" + offD, offK, 0]].forEach(r => {
      const c = Math.max(0, (r[1] - R.protG * 4 - R.fatG * 9) / 4);
      rows += `<tr class="${r[2] ? "on" : ""}"><td>${r[0]}</td><td>${nf(r[1])}</td><td>${nf(R.protG)}</td><td>${nf(c)}</td><td>${nf(R.fatG)}</td></tr>`;
    });
    rows += `<tr><td class="muted">Moyenne semaine</td><td>${nf(R.intake)}</td><td>${nf(R.protG)}</td><td>${nf(R.carbG)}</td><td>${nf(R.fatG)}</td></tr>`;
  } else {
    rows += `<tr class="on"><td>Tous les jours</td><td>${nf(R.intake)}</td><td>${nf(R.protG)}</td><td>${nf(R.carbG)}</td><td>${nf(R.fatG)}</td></tr>`;
  }
  $("cycTable").innerHTML = rows;

  const A = drawChart(R);
  renderPlan(R);
  drawFlags(R, A);
  lastR = R;
  save();
}

/* ================= PLAN DE JOURNÉE ================= */
function renderDays() {
  $("daysGrid").innerHTML = S.days.map((v, i) =>
    `<button type="button" data-d="${i}" aria-pressed="${!!v}">${DNAMES[i]}<b>${v ? "séance" : "repos"}</b></button>`).join("");
}

function renderSupps() {
  $("supps").innerHTML = SUPPS.map(s =>
    `<label class="nx-supp"><span>${s.n}</span>
      <input type="number" inputmode="decimal" data-sd="${s.id}" value="${SUP[s.id].dose}" step="${s.dose < 10 ? 0.5 : 5}" min="0" aria-label="Dose ${s.n}">
      <em>${s.u}</em>
      <input type="checkbox" class="nx-switch" data-s="${s.id}" ${SUP[s.id].on ? "checked" : ""} aria-label="${s.n}"></label>`).join("");
}

/* profil de journée */
function dayProfile(kind) { // wkON wkOFF weON weOFF
  const we = kind.slice(0, 2) === "we";
  const train = kind.slice(-2) === "ON";
  const wake = T.parse(val(we ? "weWake" : "wkWake"));
  const bed = T.bed(wake, T.parse(val(we ? "weBed" : "wkBed")));
  const tr = T.parse(val(we ? "weTrain" : "wkTrain"));
  return {
    we, train, wake, bed,
    trainAt: train ? tr + (tr < wake ? 1440 : 0) : null,
    dur: num(we ? "weDur" : "wkDur"),
    workStart: we ? null : T.parse(val("wkWorkStart")),
    workEnd: we ? null : T.parse(val("wkWorkEnd")),
    label: (we ? "Week-end" : "Semaine") + " · " + (train ? "entraînement" : "repos")
  };
}

/* répartition des repas dans la journée */
function mealSlots(D, M) {
  const start = D.wake + 50, end = Math.max(D.wake + 240, D.bed - 90);
  const t = [];
  for (let i = 0; i < M; i++) t.push({ t: M === 1 ? (start + end) / 2 : start + i * (end - start) / (M - 1), role: "repas" });
  if (D.trainAt !== null) {
    const preT = D.trainAt - 120, postT = D.trainAt + D.dur + 40;
    const near = (x, skip) => { let bi = -1, bd = 1e9; t.forEach((o, i) => { if (i === skip) return; const d = Math.abs(o.t - x); if (d < bd) { bd = d; bi = i; } }); return bi; };
    let pi = -1;
    if (preT >= start) { pi = near(preT, -1); t[pi] = { t: preT, role: "pre" }; }
    if (postT <= end && M > 1) { const qi = near(postT, pi); if (qi >= 0) t[qi] = { t: postT, role: "post" }; }
  }
  t.sort((a, b) => a.t - b.t);
  for (let i = 1; i < t.length; i++) if (t[i].t - t[i - 1].t < 55 && t[i].role === "repas") t[i].t = Math.min(end, t[i - 1].t + 55);
  return t;
}

/* construction des évènements */
function buildDay(R, kind) {
  const D = dayProfile(kind), ev = [], M = Math.max(2, Math.round(num("meals")));
  const w = R.w, half = parseFloat(val("caffSens"));
  const cyc = num("cyc") / 100, onD = clamp(R.E.strengthDays, 0, 7), offD = 7 - onD;
  // calories du jour selon le cyclage
  let kcal = R.intake;
  if (cyc > 0 && onD > 0 && offD > 0) kcal = D.train ? R.intake * (1 + cyc) : (R.intake * 7 - R.intake * (1 + cyc) * onD) / offD;
  const protG = R.protG, fatG = R.fatG, carbG = Math.max(0, (kcal - protG * 4 - fatG * 9) / 4);

  const slots = mealSlots(D, M);
  // répartition des glucides : biais péri-training les jours de séance
  const shares = slots.map(s => D.train ? (s.role === "pre" ? 1.9 : s.role === "post" ? 1.8 : 0.75) : 1);
  const sum = shares.reduce((a, b) => a + b, 0);
  const fatShares = slots.map(s => (s.role === "pre" || s.role === "post") ? 0.4 : 1.25);
  const fsum = fatShares.reduce((a, b) => a + b, 0);

  ev.push({ t: D.wake, cls: "key", title: "Réveil", d: `400–600 ml d'eau. ${SUP.elec.on ? "Une pincée de sel ou ta dose d'électrolytes si tu transpires beaucoup." : "Pense au sel si tu manges peu transformé."}` });

  // caféine
  const caffTotal = (SUP.cafe.on ? SUP.cafe.dose * 95 : 0) + (SUP.pwo.on ? SUP.pwo.dose : 0) + (SUP.burner.on ? SUP.burner.dose : 0);
  if (SUP.cafe.on || SUP.pwo.on || SUP.burner.on) {
    const perfDose = clamp(Math.round(3 * w / 50) * 50, 100, 400);
    if (D.train && D.trainAt !== null) {
      const preAt = D.trainAt - 45;
      const src = SUP.pwo.on ? `Pre-workout (${nf(SUP.pwo.dose)} mg)` : `Café fort ou caféine ${nf(Math.min(perfDose, caffTotal || perfDose))} mg`;
      if (preAt > D.wake + 30) {
        ev.push({ t: D.wake + 30, cls: "", title: "Premier café", d: `Garde-en pour la séance. Dose visée sur la journée : ${nf(perfDose)} mg au moment le plus utile, pas étalés au hasard.`, m: `${nf(SUP.cafe.on ? 95 * Math.min(1, SUP.cafe.dose) : 0)} mg` });
      }
      ev.push({ t: preAt, cls: "key", title: src, d: `Le pic sanguin arrive 30 à 45 min après la prise : c'est exactement le moment où tu dois être sur ta première série lourde. La fenêtre efficace est 3 à 6 mg/kg, soit ${nf(3 * w)} à ${nf(6 * w)} mg pour toi.`, m: `45 min avant la séance` });
      const dose = SUP.pwo.on ? SUP.pwo.dose : perfDose;
      const hrs = (D.bed - preAt) / 60;
      const left = dose * Math.pow(0.5, hrs / half);
      ev.push({ t: preAt + 1, cls: "", title: "Résiduel au coucher", d: `Avec ta sensibilité, il te reste environ ${nf(left)} mg de caféine active à l'heure du coucher (${nf(hrs, 1)} h de clairance, demi-vie ${nf(half, 1)} h).${left > 100 ? " C'est trop : baisse la dose, ou avance la séance." : left > 50 ? " C'est limite, surveille ton endormissement." : " Rien qui gêne le sommeil."}`, m: left > 100 ? "conflit sommeil" : "ok" });
    } else {
      ev.push({ t: D.wake + 45, cls: "", title: "Café", d: `Jour sans séance : pas d'enjeu de performance. Dernière prise au plus tard vers ${T.fmt(D.bed - 8 * 60)} pour ne pas entamer le sommeil.`, m: `${nf(caffTotal)} mg max` });
    }
  }
  if (SUP.burner.on) ev.push({ t: D.wake + 50, cls: "", title: "Brûleur", d: `C'est de la caféine avec du marketing autour. Compte-le dans ton total et ne l'empile pas avec le pre-workout le même jour.` });

  // travail
  if (!D.we && D.workStart !== null) {
    ev.push({ t: D.workStart, cls: "", title: "Début de journée de travail", d: `Objectif NEAT : ${nf(num("steps"))} pas. Deux marches de 12 min et les escaliers suffisent à combler l'écart si tu es assis.` });
  }

  // repas
  slots.forEach((s, i) => {
    const c = carbG * shares[i] / sum, f = fatG * fatShares[i] / fsum, p = protG / M;
    let title, d = "";
    const m = `${nf(p)} g prot · ${nf(c)} g gluc · ${nf(f)} g lip`;
    if (s.role === "pre") {
      title = "Repas pré-séance";
      d = `2 h avant la barre : c'est le délai pour digérer sans avoir l'estomac plein. Glucides à digestion lente (riz, pâtes, patate douce), lipides volontairement bas pour ne pas ralentir la vidange gastrique.`;
    } else if (s.role === "post") {
      title = "Repas post-séance";
      d = `Dans les 2 h qui suivent. Le plus gros bloc de glucides de la journée : c'est là qu'ils reconstituent le glycogène plutôt que de traîner.`;
      if (SUP.crea.on) d += ` Prends ta créatine ici — avec glucides et protéines, la rétention est meilleure.`;
    } else {
      title = `Repas ${i + 1}`;
      d = `${nf(p)} g de protéines. Le vieux plafond de 20–30 g par repas ne tient plus : il venait d'études qui arrêtaient de mesurer au bout de 4 h. En suivant la réponse sur 12 h, 100 g produisent une synthèse protéique nettement supérieure à 25 g, sans plateau. Répartir reste pratique et confortable — ce n'est simplement pas une obligation métabolique.`;
    }
    ev.push({ t: s.t, cls: "meal", title, d, m });
  });

  // séance
  if (D.train && D.trainAt !== null) {
    const pre = slots.find(s => s.role === "pre");
    const gapPre = pre ? D.trainAt - pre.t : 999;
    if (gapPre > 195) {
      ev.push({ t: D.trainAt - 40, cls: "", title: "Collation rapide", d: `Ton dernier repas est loin. 25 à 40 g de glucides rapides (banane, dattes, galette de riz)${SUP.whey.on ? ` + ${nf(Math.min(25, SUP.whey.dose))} g de whey` : ""} pour ne pas attaquer à vide.`, m: "30–40 min avant" });
    }
    if (SUP.citr.on) ev.push({ t: D.trainAt - 60, cls: "", title: "Citrulline malate", d: `${nf(SUP.citr.dose)} g, 60 min avant. Contrairement à la caféine elle a besoin de ce délai complet pour élever les nitrates plasmatiques.` });
    if (SUP.ba.on) ev.push({ t: D.trainAt - 55, cls: "", title: "Bêta-alanine", d: `${nf(SUP.ba.dose, 1)} g. L'effet vient de la saturation en carnosine sur plusieurs semaines, pas de la prise du jour : l'heure importe peu, la régularité oui. À prendre pendant un repas si les fourmillements te gênent.` });
    ev.push({ t: D.trainAt, cls: "train", title: `Séance — ${nf(D.dur)} min`, d: `Priorité en déficit : garder la charge sur la barre. Baisse le volume avant de baisser l'intensité si la fatigue monte.`, m: `eau : ${nf(D.dur / 60 * 0.6, 1)} L` });
    if (D.dur > 75) ev.push({ t: D.trainAt + 50, cls: "", title: "Intra-séance", d: `Au-delà de 75 min, 20 à 30 g de glucides pendant la séance limitent la fonte du glycogène.${SUP.eaa.on ? ` Tes EAA (${nf(SUP.eaa.dose)} g) trouvent leur place ici — utiles surtout si le repas pré-séance est loin, sinon redondants avec ta whey.` : ""}` });
    if (SUP.whey.on) ev.push({ t: D.trainAt + D.dur + 10, cls: "key", title: "Whey", d: `${nf(SUP.whey.dose)} g juste après. Rien n'oblige à s'arrêter à 25 g — l'idée d'un plafond venait de mesures interrompues trop tôt. Cela dit, si ton repas post-séance suit dans l'heure, la dose peut rester modeste : c'est le total du jour qui pilote.`, m: `${nf(SUP.whey.dose * 0.8)} g prot environ` });
  } else if (SUP.crea.on) {
    ev.push({ t: D.wake + 120, cls: "", title: "Créatine", d: `${nf(SUP.crea.dose)} g même les jours de repos. Elle agit par saturation musculaire : sauter les jours off fait redescendre tes stocks. Avec un repas contenant des glucides.` });
  }

  // micronutriments
  const microAt = slots[Math.min(1, slots.length - 1)].t + 5;
  const micro = [];
  if (SUP.omega.on) micro.push(`oméga-3 ${nf(SUP.omega.dose, 1)} g`);
  if (SUP.vitd.on) micro.push(`vitamine D ${nf(SUP.vitd.dose)} UI`);
  if (SUP.multi.on) micro.push("multivitamines");
  if (micro.length) ev.push({ t: microAt, cls: "", title: "Micronutriments", d: `${micro.join(", ")} — avec le repas le plus gras de la journée, ce sont des vitamines liposolubles : à jeun tu en absorbes une fraction.` });

  if (SUP.magn.on) ev.push({ t: D.bed - 60, cls: "", title: "Magnésium", d: `${nf(SUP.magn.dose)} mg le soir (bisglycinate de préférence). En déficit calorique les apports chutent souvent, et c'est un des rares compléments qui aide vraiment le sommeil.` });
  if (SUP.casein.on) ev.push({ t: D.bed - 70, cls: "", title: "Caséine", d: `${nf(SUP.casein.dose)} g. Utile seulement si ton dernier repas est à plus de 3 h du coucher — sinon tes protéines sont déjà couvertes.` });

  ev.push({ t: D.bed, cls: "key", title: "Coucher", d: `7 à 9 h. En déficit, une nuit courte augmente la faim et déplace la perte vers la masse maigre : c'est le levier le plus rentable et le plus négligé de la sèche.` });

  ev.sort((a, b) => a.t - b.t);
  return { D, ev, kcal, protG, carbG, fatG };
}

function tlHtml(P) {
  return P.ev.map(e =>
    `<div class="nx-ev ${e.cls}"><span class="h">${T.fmt(e.t)}</span>
      <div class="t">${e.title}</div><div class="d">${e.d}</div>${e.m ? `<div class="m">${e.m}</div>` : ""}</div>`).join("");
}

function renderPlan(R) {
  const tabs = [["wkON", "Semaine · séance"], ["wkOFF", "Semaine · repos"], ["weON", "W-E · séance"], ["weOFF", "W-E · repos"]];
  $("planTabs").innerHTML = tabs.map(t => `<button type="button" data-t="${t[0]}" aria-pressed="${S.tab === t[0]}">${t[1]}</button>`).join("");
  const P = buildDay(R, S.tab);
  $("timeline").innerHTML = tlHtml(P);
  $("planMeta").textContent = `${nf(P.kcal)} kcal ce jour-là`;
  const trainingDays = S.days.map((v, i) => v ? DNAMES[i] : null).filter(Boolean);
  $("planNote").innerHTML = `Séances : <b>${trainingDays.join(" · ") || "aucune"}</b> — ${nf(P.protG)} g protéines · ${nf(P.carbG)} g glucides · ${nf(P.fatG)} g lipides sur ${Math.round(num("meals"))} repas.`;
  $("dayHint").textContent = `${trainingDays.length} séance${trainingDays.length > 1 ? "s" : ""}/sem`;
  const nOn = SUPPS.filter(s => SUP[s.id].on).length;
  $("suppHint").textContent = `${nOn} produit${nOn > 1 ? "s" : ""}`;
}

/* ================= EXPORT PDF ================= */
function buildPrintDoc(R) {
  let doc = document.getElementById("nx-printDoc");
  if (!doc) { doc = document.createElement("div"); doc.id = "nx-printDoc"; document.body.appendChild(doc); }

  const d = new Date();
  const pk = R.protG * 4, ck = R.carbG * 4, fk = R.fatG * 9;
  const A = project(R, false);
  const row = (k, v) => `<tr><td>${k}</td><td class="n">${v}</td></tr>`;
  const trainingDays = S.days.map((v, i) => v ? DNAMES[i] : null).filter(Boolean);

  const params = [
    ["Sexe", S.sex === "h" ? "Homme" : "Femme"], ["Âge", nf(R.age) + " ans"], ["Taille", nf(R.h, 1) + " cm"], ["Poids", nf(R.w, 1) + " kg"],
    ["IMC", nf(R.bmi, 1)], ["Masse grasse", nf(R.bfEst, 1) + " %" + (R.bfSource ? " (" + R.bfSource + ")" : " (estimée)")],
    ["Masse maigre", nf(R.lbm, 1) + " kg"], ["Masse grasse", nf(R.fm, 1) + " kg"],
    ["Formule", R.B.name], ["Pas / jour", nf(num("steps"))],
    ["Distance marchée", nf(R.N.km, 1) + " km"], ["Repas / jour", nf(num("meals"))],
    ["Objectif %MG", nf(R.targetBf, 1) + " %"], ["Pilotage", R.recal ? "Recalibrage /2 sem" : "Calories figées"]
  ].map(p => row(p[0], p[1])).join("");

  const depense = [
    ["Métabolisme de base", nf(R.B.v) + " kcal"], ["NEAT", nf(R.N.total) + " kcal"],
    ["Entraînement", nf(R.E.perDay) + " kcal"], ["Effet thermique", nf(R.tef) + " kcal"],
    ["Maintenance", "<b>" + nf(R.tdee) + " kcal</b>"],
    [R.gain ? "Surplus" : R.isMaint ? "Écart" : "Déficit", (R.gain ? "+" : R.deficit > 0 ? "−" : "") + nf(Math.abs(R.deficit)) + " kcal (" + nf(R.defPct) + " %)"],
    [R.gain ? "Gain projeté" : R.isMaint ? "Variation projetée" : "Perte projetée", (R.gain ? "+" : "") + nf(Math.abs(R.lossKg), 2) + " kg/sem (" + nf(Math.abs(R.lossKg) / R.w * 100, 2) + " %)"],
    [R.gain ? "Densité du tissu gagné" : "Densité du tissu perdu", nf(R.eDens) + " kcal/kg"],
    ["Partition", nf(R.leanShare * 100) + " % maigre / " + nf(R.fatShare * 100) + " % gras"]
  ].map(p => row(p[0], p[1])).join("");

  const actsRows = S.acts.filter(a => a.sess > 0).map(a =>
    `<tr><td>${a.n}</td><td class="n">${a.met} MET</td><td class="n">${nf(a.min)} min</td><td class="n">×${nf(a.sess)}</td><td class="n">${nf((a.met - 1) * R.w * (a.min / 60) * a.sess)} kcal</td></tr>`).join("");

  const cyc = num("cyc") / 100, onD = clamp(R.E.strengthDays, 0, 7), offD = 7 - onD;
  let cycRows = "";
  if (cyc > 0 && onD > 0 && offD > 0) {
    const onK = R.intake * (1 + cyc), offK = (R.intake * 7 - onK * onD) / offD;
    [["Jour entraînement ×" + onD, onK], ["Jour repos ×" + offD, offK]].forEach(r => {
      const c = Math.max(0, (r[1] - R.protG * 4 - R.fatG * 9) / 4);
      cycRows += `<tr><td>${r[0]}</td><td class="n">${nf(r[1])}</td><td class="n">${nf(R.protG)}</td><td class="n">${nf(c)}</td><td class="n">${nf(R.fatG)}</td></tr>`;
    });
  }
  cycRows += `<tr><td>Moyenne hebdomadaire</td><td class="n"><b>${nf(R.intake)}</b></td><td class="n">${nf(R.protG)}</td><td class="n">${nf(R.carbG)}</td><td class="n">${nf(R.fatG)}</td></tr>`;

  const projRows = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24].map(k => {
    const s = A.series[k]; if (!s) return "";
    return `<tr><td>S${k}</td><td class="n">${nf(s.w, 1)} kg</td><td class="n">${nf(s.bf, 1)} %</td><td class="n">${nf(s.intake)} kcal</td></tr>`;
  }).join("");

  const supList = SUPPS.filter(s => SUP[s.id].on).map(s => `<tr><td>${s.n}</td><td class="n">${nf(SUP[s.id].dose, SUP[s.id].dose < 10 ? 1 : 0)} ${s.u}</td></tr>`).join("")
    || `<tr><td colspan="2">Aucun complément déclaré</td></tr>`;

  const plans = ["wkON", "wkOFF", "weON", "weOFF"].map(k => {
    const P = buildDay(R, k);
    return `<div class="nx-blk" style="margin-bottom:16px"><h2>${P.D.label} — ${nf(P.kcal)} kcal · ${nf(P.protG)}P / ${nf(P.carbG)}G / ${nf(P.fatG)}L</h2><div class="nx-tl">${tlHtml(P)}</div></div>`;
  });

  const flags = lastFlags.map(x => `<li style="margin-bottom:4px">${x.html}</li>`).join("");
  hideHover();

  doc.innerHTML = `
  <div class="nx-pg">
    <div class="p-head">
      <h1>${PHASE[R.phase].t}</h1>
      <div class="meta">Plan nutritionnel personnalisé — TrackLift<br>${d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}<br>${nf(R.w, 1)} kg · ${nf(R.bfEst, 1)} % MG</div>
    </div>
    <div class="hero">
      <b>${nf(R.intake)}</b>
      <span>kcal / jour<br>maintenance ${nf(R.tdee)} kcal<br>${R.gain ? "surplus +" : R.isMaint ? "écart " : "déficit "}${nf(Math.abs(R.deficit))} kcal · ${nf(R.defPct)} %<br>${R.gain ? "gain +" : R.isMaint ? "variation " : "perte "}${nf(Math.abs(R.lossKg), 2)} kg/semaine</span>
      <span>Protéines <b style="font-size:12pt">${nf(R.protG)} g</b> · ${nf(pk / R.intake * 100)} %<br>
            Glucides <b style="font-size:12pt">${nf(R.carbG)} g</b> · ${nf(ck / R.intake * 100)} %<br>
            Lipides <b style="font-size:12pt">${nf(R.fatG)} g</b> · ${nf(fk / R.intake * 100)} %<br>
            Fibres ${nf(R.intake / 1000 * 14)} g · eau ${nf(R.w * 35 / 1000, 1)} L</span>
    </div>
    <h2>Décomposition de la dépense</h2>
    ${$("bar").outerHTML.replace(/id="nx-bar"/, "").replace('id="nx-hatch"', 'id="nx-hatch-p"').replace("url(#nx-hatch)", "url(#nx-hatch-p)")}
    <div class="cols">
      <div><h2>Bilan énergétique</h2><table>${depense}</table></div>
      <div><h2>Paramètres saisis</h2><table>${params}</table></div>
    </div>
    <h2>Entraînement — MET net</h2>
    <table><tr><th>Activité</th><th>Intensité</th><th>Durée</th><th>Fréq.</th><th>Dépense/sem</th></tr>${actsRows}</table>
    <h2>Répartition hebdomadaire · séances ${trainingDays.join(" ") || "—"}</h2>
    <table><tr><th>Jour</th><th>kcal</th><th>Prot</th><th>Gluc</th><th>Lip</th></tr>${cycRows}</table>
  </div>

  <div class="nx-pg">
    <div class="p-head"><h1 style="font-size:18pt">Projection</h1><div class="meta">24 semaines · ${R.recal ? "recalibrage toutes les 2 semaines" : "calories figées"}</div></div>
    <h2>Poids (kg) — trait plein : recalibrage · pointillés : calories figées</h2>
    ${$("chartW").outerHTML.replace(/id="nx-chartW"/, "")}
    <h2>Masse grasse (%) — pointillés ambre : cible</h2>
    ${$("chartBf").outerHTML.replace(/id="nx-chartBf"/, "")}
    <div class="cols">
      <div><h2>Trajectoire</h2><table><tr><th>Semaine</th><th>Poids</th><th>%MG</th><th>Apport</th></tr>${projRows}</table></div>
      <div><h2>Compléments déclarés</h2><table>${supList}</table>
        <h2>Points de vigilance</h2><ul style="font-size:8pt;line-height:1.5;padding-left:14px;margin:0">${flags}</ul>
      </div>
    </div>
  </div>

  <div class="nx-pg">
    <div class="p-head"><h1 style="font-size:18pt">Plan de journée</h1><div class="meta">Timing des repas, glucides,<br>caféine et compléments</div></div>
    ${plans[0]}${plans[1]}
  </div>
  <div class="nx-pg">
    ${plans[2]}${plans[3]}
    <div class="fin">
      Méthode — métabolisme de base ${R.B.name} · NEAT dérivé des pas (foulée = 0,415 × taille, marche à 3,5 MET) et de la posture de travail · entraînement en MET net (Compendium of Physical Activities 2024) avec +6 % d'EPOC au-delà de 8 MET · effet thermique calculé sur les macros réelles (25 % protéines, 8 % glucides, 2 % lipides) par convergence · densité énergétique du tissu ${R.gain ? "gagné" : "perdu"} ajustée selon %MG, protéines${R.gain ? ", expérience à l'entraînement" : ""} et volume de musculation · ${R.gain ? "NEAT majoré en surplus (thermogenèse d'activité)" : "adaptation métabolique progressive"} appliquée semaine par semaine.<br>
      Timing — caféine 30 à 60 min avant l'effort à 3–6 mg/kg (ISSN 2021), demi-vie retenue ${nf(parseFloat(val("caffSens")), 1)} h · glucides concentrés autour de la séance, repas complet 2 h avant · créatine 3 à 5 g/jour, y compris les jours de repos, le timing pesant beaucoup moins que la régularité.<br>
      Protéines — le plafond de 20 à 30 g par repas est un artefact d'études qui cessaient de mesurer au bout de 4 à 5 h. Trommelen et al. (Cell Reports Medicine, 2023) ont suivi la réponse sur 12 h : 100 g de protéines produisent une synthèse myofibrillaire supérieure à 25 g, environ 20 % de plus sur 0–4 h et 40 % de plus sur 4–12 h, sans limite haute détectée, avec une oxydation des acides aminés restant sous 15 % de l'apport. La répartition en plusieurs prises reste pratique et rassasiante, mais ce qui pilote le résultat est le total quotidien. Étude menée sur 36 hommes jeunes actifs : la transposition aux femmes, aux seniors et aux athlètes très entraînés n'a pas été testée.<br>
      Toute équation de dépense énergétique reste une estimation à ±10 %. Ce document est un point de départ à ajuster sur 2 à 3 semaines de poids moyens, pas une prescription médicale ou diététique.
    </div>
  </div>`;
}

/* ---------- résumé copiable ---------- */
function copySummary() {
  const R = lastR; if (!R) return;
  const t = [
    `${PHASE[R.phase].t.toUpperCase()} — cible ${nf(R.intake)} kcal/jour`,
    `Maintenance ${nf(R.tdee)} kcal · ${R.gain ? "surplus +" : R.isMaint ? "écart " : "déficit "}${nf(Math.abs(R.deficit))} kcal (${nf(R.defPct)} %) · ${R.gain ? "+" : ""}${nf(Math.abs(R.lossKg), 2)} kg/semaine`,
    ``,
    `Protéines ${nf(R.protG)} g | Glucides ${nf(R.carbG)} g | Lipides ${nf(R.fatG)} g | Fibres ${nf(R.intake / 1000 * 14)} g`,
    ``,
    `Base ${R.B.name} ${nf(R.B.v)} kcal · NEAT ${nf(R.N.total)} · entraînement ${nf(R.E.perDay)} · effet thermique ${nf(R.tef)}`,
    `${nf(R.w, 1)} kg · ${nf(R.bfEst, 1)} % MG · masse maigre ${nf(R.lbm, 1)} kg`
  ].join("\n");
  const btn = $("copyBtn");
  const done = () => { btn.textContent = "Copié ✓"; setTimeout(() => { btn.textContent = "Copier le résumé"; }, 1600); };
  const fallback = () => {
    const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { /* rien */ }
    ta.remove();
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done).catch(fallback);
  else fallback();
}

/* ---------- questionnaire : une étape à la fois, puis les résultats ---------- */
function renderQuiz() {
  if (!root) return;
  const quiz = !S.quizDone;
  root.classList.toggle("nx-mode-quiz", quiz);
  root.classList.toggle("nx-mode-results", !quiz);
  const step = clamp(S.quizStep || 0, 0, STEPS.length - 1);
  S.quizStep = step;
  root.querySelectorAll(".nx-group[data-step]").forEach(g => g.classList.toggle("is-current", +g.dataset.step === step));
  root.querySelectorAll("[data-phase]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.phase === S.phase)));

  if (quiz) {
    const st = STEPS[step];
    $("quizHead").innerHTML = `
      <div class="nx-quiz-top">
        <button type="button" class="icon-btn nx-quiz-back" data-quiz="prev" aria-label="Étape précédente" ${step ? "" : "hidden"}>←</button>
        <div class="nx-quiz-bar" role="progressbar" aria-valuemin="1" aria-valuemax="${STEPS.length}" aria-valuenow="${step + 1}"><div style="width:${(step + 1) / STEPS.length * 100}%"></div></div>
      </div>
      <span class="nx-sticker">${st.tag} · ${step + 1}/${STEPS.length}</span>
      <h1 class="nx-quiz-q">${st.q()}</h1>
      <p class="nx-quiz-hand">${st.hand()}</p>
      ${illu(st.img)}
      <p class="nx-quiz-x">${st.x()}</p>`;
    $("prev").hidden = step === 0;
    $("next").textContent = step === STEPS.length - 1 ? "Voir mon plan" : "Continuer";
  } else {
    $("recapSteps").innerHTML = `<span class="nx-recap-lab">Modifier :</span>` +
      STEPS.map((st, i) => `<button type="button" class="nx-recap-step" data-goto="${i}">${st.tag}</button>`).join("");
  }
}

function goStep(step) {
  S.quizDone = false;
  S.quizStep = clamp(step, 0, STEPS.length - 1);
  renderQuiz();
  save();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function finishQuiz() {
  S.quizDone = true;
  renderQuiz();
  run();
  window.scrollTo({ top: 0, behavior: "auto" });
}

/* ---------- persistance (via callbacks de l'appli) ---------- */
function snapshot() {
  const d = { s: { sex: S.sex, bfMode: S.bfMode, goal: S.goal, protBase: S.protBase, acts: S.acts, days: S.days, tab: S.tab, phase: S.phase, quizStep: S.quizStep, quizDone: S.quizDone }, f: {}, sup: SUP };
  FIELDS.forEach(k => { d.f[k] = val(k); });
  return JSON.parse(JSON.stringify(d));
}
function save() {
  if (!opts.save) return;
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { opts.save(snapshot()); } catch (e) { console.error("[Nutrition] save", e); } }, 800);
}
function restore(d) {
  if (!d) return false;
  Object.assign(S, d.s || {});
  if (d.s && d.s.quizDone === undefined) S.quizDone = true;
  if (d.sup) Object.keys(SUP).forEach(k => { if (d.sup[k]) SUP[k] = { ...d.sup[k] }; });
  if (d.f) FIELDS.forEach(k => { if (d.f[k] !== undefined && d.f[k] !== null) $(k).value = d.f[k]; });
  return true;
}
function refreshAll() {
  syncAllSegs(); syncVisibility(); applyPhase();
  renderActs(); renderDays(); renderSupps();
  run();
  renderQuiz();
}
function reset() {
  clearTimeout(saveT);
  S = DEFAULT_S(); SUP = DEFAULT_SUP();
  restore(JSON.parse(JSON.stringify(defaults)));
  const w = opts.getLatestWeight && opts.getLatestWeight();
  if (w) $("weight").value = w;
  refreshAll();
}

/* ================= API du module ================= */
export function mountNutrition(container, options = {}) {
  if (root === container && root.childElementCount) { run(); return; }
  root = container; opts = options;
  root.classList.add("nx");
  S = DEFAULT_S(); SUP = DEFAULT_SUP();
  root.innerHTML = markup();
  defaults = snapshot();

  bindSeg("sexSeg", "sex", syncVisibility);
  bindSeg("bfSeg", "bfMode", syncVisibility);
  bindSeg("goalSeg", "goal", syncVisibility);
  bindSeg("protBaseSeg", "protBase", syncVisibility);
  bindSeg("phaseSeg", "phase", applyPhase);

  $("acts").addEventListener("input", e => {
    const t = e.target, i = t.dataset.i; if (i === undefined) return;
    const f = t.dataset.f;
    if (f === "n") { S.acts[i].n = t.value; S.acts[i].met = FLAT[t.value].m; renderActs(); }
    else S.acts[i][f] = parseFloat(t.value) || 0;
    run();
  });
  $("acts").addEventListener("click", e => {
    const b = e.target.closest("[data-del]"); if (!b) return;
    S.acts.splice(+b.dataset.del, 1); renderActs(); run();
  });
  $("addAct").addEventListener("click", () => {
    S.acts.push({ n: "Marche rapide 6 km/h", min: 30, sess: 2, met: 4.3 }); renderActs(); run();
  });
  $("daysGrid").addEventListener("click", e => {
    const b = e.target.closest("[data-d]"); if (!b) return;
    const i = +b.dataset.d; S.days[i] = S.days[i] ? 0 : 1; renderDays(); run();
  });
  $("supps").addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.s) SUP[t.dataset.s].on = t.checked;
    else if (t.dataset.sd) SUP[t.dataset.sd].dose = parseFloat(t.value) || 0;
    run();
  });
  $("planTabs").addEventListener("click", e => {
    const b = e.target.closest("[data-t]"); if (!b) return;
    S.tab = b.dataset.t; run();
  });
  bindHover("chartW");
  bindHover("chartBf");

  // questionnaire
  $("phaseChoices").addEventListener("click", e => {
    const b = e.target.closest("[data-phase]"); if (!b) return;
    S.phase = b.dataset.phase; syncSeg("phaseSeg", "phase"); applyPhase(); run(); renderQuiz();
    setTimeout(() => { if (!S.quizDone && S.quizStep === 0) goStep(1); }, 180);
  });
  $("phaseSeg").addEventListener("click", () => setTimeout(renderQuiz, 0));
  $("next").addEventListener("click", () => {
    if (S.quizStep >= STEPS.length - 1) finishQuiz(); else goStep(S.quizStep + 1);
  });
  $("prev").addEventListener("click", () => goStep(S.quizStep - 1));
  $("quizHead").addEventListener("click", e => { if (e.target.closest("[data-quiz=prev]")) goStep(S.quizStep - 1); });
  $("recapSteps").addEventListener("click", e => {
    const b = e.target.closest("[data-goto]"); if (b) goStep(+b.dataset.goto);
  });

  $("pdfBtn").addEventListener("click", () => {
    if (!lastR) return;
    buildPrintDoc(lastR);
    setTimeout(() => window.print(), 60);
  });
  $("copyBtn").addEventListener("click", copySummary);
  $("resetBtn").addEventListener("click", () => {
    if (opts.save) { clearTimeout(saveT); opts.save(null); }
    reset();
  });

  let rT = null, lastW = 0;
  window.addEventListener("resize", () => {
    clearTimeout(rT);
    rT = setTimeout(() => { if (root && root.offsetWidth && root.offsetWidth !== lastW) { lastW = root.offsetWidth; run(); } }, 150);
  });

  const onAny = e => { if (e.target.closest("#nx-acts") || e.target.closest("#nx-supps")) return; run(); };
  root.addEventListener("input", onAny);
  root.addEventListener("change", onAny);

  const saved = opts.load && opts.load();
  if (!restore(saved)) {
    const w = opts.getLatestWeight && opts.getLatestWeight();
    if (w) $("weight").value = w;
  }
  refreshAll();
}

export function unmountNutrition() {
  clearTimeout(saveT);
  if (root) root.innerHTML = "";
  root = null; opts = {}; lastR = null; proj = null; lastFlags = [];
  const doc = document.getElementById("nx-printDoc");
  if (doc) doc.remove();
}
