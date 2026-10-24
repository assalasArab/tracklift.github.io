/* ═══════════════════════════════════════════════════════════
   Présentation de l'appli (première connexion).
   6 écrans : un titre avec un mot en orange plastique ou entouré au feutre,
   une note manuscrite avec une flèche dessinée qui pointe vers un aperçu,
   un emplacement de dessin, puis la création du programme.
   ═══════════════════════════════════════════════════════════ */
import { illu } from "./illustrations.js?v=20261024n";

/* flèches au feutre ; chaque tracé finit par une pointe */
const ARROWS = {
  // vers le bas à droite
  dr: `<svg viewBox="0 0 90 70" aria-hidden="true"><path d="M6 8 C 30 4, 56 14, 66 40 C 70 50, 72 56, 74 62" /><path d="M62 52 L 74 63 L 82 49" /></svg>`,
  // vers le haut à droite
  ur: `<svg viewBox="0 0 90 70" aria-hidden="true"><path d="M6 62 C 22 64, 48 58, 62 36 C 68 26, 72 18, 76 8" /><path d="M64 14 L 77 6 L 82 21" /></svg>`,
  // vers le haut à gauche
  ul: `<svg viewBox="0 0 90 70" aria-hidden="true"><path d="M84 62 C 68 64, 42 58, 28 36 C 22 26, 18 18, 14 8" /><path d="M26 14 L 13 6 L 8 21" /></svg>`,
  // part à droite puis revient vers le bas à gauche (vise ce qui est sous le texte)
  dl: `<svg viewBox="0 0 90 70" aria-hidden="true"><path d="M4 14 C 40 2, 80 8, 72 34 C 66 52, 44 58, 24 62" /><path d="M35 53 L 23 62 L 36 69" /></svg>`,
  // vers le bas, en boucle
  d: `<svg viewBox="0 0 70 90" aria-hidden="true"><path d="M10 6 C 50 2, 62 30, 40 40 C 22 48, 26 70, 38 82" /><path d="M26 74 L 38 84 L 46 70" /></svg>`
};

const FLAME = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#flame-icon"/></svg>`;

const SLIDES = [
  {
    img: "intro-01-bienvenue.webp",
    layout: "side",
    title: `Bienvenue sur <span class="ob-key">TrackLift</span>`,
    hand: "ton carnet de muscu, en mieux",
    text: "Tes séances, tes progrès et ta nutrition au même endroit. Petit tour en une minute ?",
    mock: `<div class="ob-mock ob-mock-pills"><span>Séances</span><span>Progrès</span><span>Flamme</span><span>Nutrition</span></div>`,
    note: { text: "tout est là", arrow: "dl", pos: "left" }
  },
  {
    img: "intro-02-seance.png",
    title: `Suis <span class="ob-circle">chaque séance</span>`,
    hand: "série par série, sans réfléchir",
    text: "L'appli t'affiche l'exercice, la charge et les répétitions, puis lance le chrono de repos. Séance réussie ? Elle te propose +2,5 kg la fois suivante.",
    mock: `<div class="ob-mock ob-mock-set">
      <span class="ob-mock-lab">Développé couché · série 2 sur 4</span>
      <b>80 kg <small>× 8</small></b>
      <span class="ob-mock-up">prochaine fois : 82,5 kg</span>
    </div>`,
    note: { text: "elle calcule tes charges", arrow: "dr", pos: "left" }
  },
  {
    img: "intro-03-progres.webp",
    layout: "side",
    title: `Regarde-toi <span class="ob-key">progresser</span>`,
    hand: "les chiffres ne mentent pas",
    text: "Volume, régularité, charges : tout est suivi séance après séance. Ton niveau, de Débutant à Élite, se met à jour avec tes perfs.",
    mock: `<div class="ob-mock ob-mock-bars">
      <span class="ob-mock-chip">Niveau intermédiaire</span>
      <div class="ob-bars">${[38, 46, 44, 58, 63, 72, 86].map(h => `<i style="height:${h}%"></i>`).join("")}</div>
    </div>`,
    note: { text: "ton niveau monte ici", arrow: "dl", pos: "left" }
  },
  {
    img: "intro-04-flamme.webp",
    layout: "small",
    title: `Garde ta <span class="ob-key">flamme</span> allumée`,
    hand: "une pesée par jour suffit",
    text: "Pèse-toi chaque matin : ta série de jours grandit et ta courbe de poids devient fiable. Un oubli, et la flamme s'éteint.",
    mock: `<div class="ob-mock ob-mock-flames">
      ${["L", "M", "M", "J", "V", "S", "D"].map((d, i) => `<span class="${i < 5 ? "on" : ""}">${FLAME}<small>${d}</small></span>`).join("")}
    </div>`,
    note: { text: "ne la laisse pas s'éteindre", arrow: "ul", pos: "right" }
  },
  {
    img: "intro-05-nutrition.webp",
    layout: "peek",
    title: `Mange au <span class="ob-circle">bon calibre</span>`,
    hand: "sèche, maintien ou prise de masse",
    text: "Un questionnaire en 9 étapes calcule tes calories et tes macros, puis te construit un plan de journée.",
    mock: `<div class="ob-mock ob-mock-kcal">
      <b class="ob-kcal">2 144</b><span>kcal par jour</span>
      <div class="ob-macro"><i style="width:30%"></i><i style="width:45%"></i><i style="width:25%"></i></div>
    </div>`,
    note: { text: "calculé pour toi, pas au pif", arrow: "ul", pos: "right" }
  },
  {
    img: "intro-06-go.png",
    title: `On crée <span class="ob-key">ton programme</span> ?`,
    hand: "2 minutes chrono",
    text: "Réponds à quelques questions, remplis ton programme actuel ou importe-le depuis Notion.",
    mock: "",
    note: { text: "c'est par ici !", arrow: "d", pos: "center" },
    last: true
  }
];

let ob = null;

function slideHtml(s, i) {
  return `
    <section class="ob-slide" aria-roledescription="écran" aria-label="${i + 1} sur ${SLIDES.length}">
      <h1 class="ob-title">${s.title}</h1>
      <p class="ob-hand">${s.hand}</p>
      <p class="ob-text">${s.text}</p>
      <div class="ob-stage${s.layout ? ` ob-stage-${s.layout}` : ""}">
        ${illu(s.img, "ob-illu")}
        ${s.mock}
        ${s.note ? `<div class="ob-note ob-note-${s.note.pos}"><span>${s.note.text}</span>${ARROWS[s.note.arrow]}</div>` : ""}
      </div>
    </section>`;
}

function render(dir = 0) {
  const s = SLIDES[ob.index];
  const stage = ob.el.querySelector(".ob-viewport");
  stage.innerHTML = slideHtml(s, ob.index);
  const slide = stage.firstElementChild;
  if (dir) slide.classList.add(dir > 0 ? "from-right" : "from-left");
  ob.el.querySelector(".ob-dots").innerHTML = SLIDES.map((_, i) =>
    `<button type="button" class="ob-dot${i === ob.index ? " on" : ""}" data-ob-go="${i}" aria-label="Écran ${i + 1}"${i === ob.index ? ' aria-current="step"' : ""}></button>`).join("");
  ob.el.querySelector(".ob-actions").innerHTML = s.last
    ? `<button type="button" class="btn btn-primary ob-next" data-ob="start">Créer mon programme</button>
       <button type="button" class="ob-later" data-ob="later">Plus tard</button>`
    : `<button type="button" class="btn btn-primary ob-next" data-ob="next">Suivant</button>`;
  ob.el.querySelector("[data-ob=skip]").hidden = !!s.last;
}

function go(index) {
  const next = Math.max(0, Math.min(SLIDES.length - 1, index));
  if (next === ob.index) return;
  const dir = next > ob.index ? 1 : -1;
  ob.index = next;
  render(dir);
}

function close(result) {
  if (!ob) return;
  const { el, onKey, onFinish } = ob;
  document.removeEventListener("keydown", onKey);
  el.remove();
  document.documentElement.classList.remove("ob-open");
  ob = null;
  if (onFinish) onFinish(result);
}

/**
 * opts.onFinish(result) : "start" (créer le programme), "skip" (présentation passée), "later"
 */
export function openIntro(opts = {}) {
  if (ob) return;
  const el = document.createElement("div");
  el.className = "ob";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Présentation de TrackLift");
  el.innerHTML = `
    <div class="ob-inner">
      <div class="ob-top">
        <div class="ob-dots"></div>
        <button type="button" class="ob-skip" data-ob="skip">Passer</button>
      </div>
      <div class="ob-viewport"></div>
      <div class="ob-actions"></div>
    </div>`;
  document.body.appendChild(el);
  document.documentElement.classList.add("ob-open");
  ob = { el, index: 0, onFinish: opts.onFinish };

  el.addEventListener("click", event => {
    const dot = event.target.closest("[data-ob-go]");
    if (dot) { go(+dot.dataset.obGo); return; }
    const action = event.target.closest("[data-ob]")?.dataset.ob;
    if (action === "next") go(ob.index + 1);
    if (action === "skip") close("skip");
    if (action === "start") close("start");
    if (action === "later") close("later");
  });

  // balayage gauche / droite
  let x0 = null, y0 = null;
  el.addEventListener("pointerdown", e => { x0 = e.clientX; y0 = e.clientY; });
  el.addEventListener("pointerup", e => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(ob.index + (dx < 0 ? 1 : -1));
  });

  ob.onKey = event => {
    if (event.key === "ArrowRight") go(ob.index + 1);
    if (event.key === "ArrowLeft") go(ob.index - 1);
    if (event.key === "Escape") close("skip");
  };
  document.addEventListener("keydown", ob.onKey);
  render();
  el.tabIndex = -1;
  el.focus({ preventScroll: true });
}
