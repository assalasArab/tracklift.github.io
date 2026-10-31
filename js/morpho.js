/* ═══════════════════════════════════════════════════════════
   Scan morpho : photos → points du corps (MediaPipe, exécuté sur le
   téléphone) → photo annotée cliquable → conseils d'exercices.
   Les photos ne quittent jamais l'appareil ; seules les mesures sont
   gardées, via opts.save (le document de l'utilisateur).
   Module chargé à la demande, depuis le menu du profil.
   ═══════════════════════════════════════════════════════════ */
import { i18n } from "./i18n.js?v=20261031a";
import { measureBody, measureSpan, combine, classify, ZONES, ZONE_ORDER } from "./morpho-engine.js?v=20261031a";
import { morphoText, fill } from "./morpho-text.js?v=20261031a";

const MP_VERSION = "1.2.0";
const MP_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
/* modèle « heavy » (30 Mo, téléchargé au premier scan puis gardé en cache par le navigateur) :
   il suit nettement mieux les vraies proportions que le modèle « full » (9 Mo), gardé en secours */
const MP_MODELS = [
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task",
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
];
const MAX_SIDE = 1280;
const MIN_RENDER_SIDE = 1100; /* les petites photos sont agrandies à l'affichage pour garder un tracé net */
const MAX_PHOTOS = 3;
const MIN_LABEL_PX = 11;      /* taille minimale du texte sur la photo, à l'écran */

const COLORS = { long: "#e8692c", moyen: "#7a8450", court: "#3a8fa8", incertain: "#95969d" };

let landmarkerPromise = null;
let ui = null;

/* ---------- outil de détection (chargé une seule fois, au premier besoin) ---------- */
function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import(MP_BUNDLE);
      const vision = await FilesetResolver.forVisionTasks(MP_WASM);
      const opts = (model, delegate) => ({
        baseOptions: { modelAssetPath: model, delegate },
        runningMode: "IMAGE", numPoses: 1, outputSegmentationMasks: true
      });
      let lastError;
      for (const model of MP_MODELS) {
        for (const delegate of ["GPU", "CPU"]) {
          try { return await PoseLandmarker.createFromOptions(vision, opts(model, delegate)); }
          catch (err) { lastError = err; }
        }
      }
      throw lastError;
    })();
    landmarkerPromise.catch(() => { landmarkerPromise = null; });
  }
  return landmarkerPromise;
}

function detect(landmarker, canvas) {
  const r = landmarker.detect(canvas);
  if (!r.landmarks?.length) return null;
  let mask = null;
  const m = r.segmentationMasks?.[0];
  if (m) {
    mask = { data: m.getAsFloat32Array().slice(), width: m.width, height: m.height };
    r.segmentationMasks.forEach(x => x.close());
  }
  return { landmarks: r.landmarks[0], mask };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image illisible")); };
    img.src = url;
  });
}

/* ---------- petits outils ---------- */
const q = sel => ui.el.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const lower = s => s.charAt(0).toLowerCase() + s.slice(1);
const num = (value, digits) => new Intl.NumberFormat(ui.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const round = (value, digits = 1) => (value == null || !Number.isFinite(value) ? null : Math.round(value * 10 ** digits) / 10 ** digits);

/* ---------- ouverture ---------- */
export function openMorpho(opts = {}) {
  if (ui) return;
  const lang = i18n.getLanguage() === "en" ? "en" : "fr";
  const T = morphoText(lang);
  const el = document.createElement("div");
  el.className = "modal mz-modal";
  el.innerHTML = shell(T);
  document.body.appendChild(el);
  ui = {
    el, opts, T, locale: i18n.getLocale(),
    filesA: [], fileT: null, image: null, imageT: null,
    measure: null, span: null, levels: null, sex: "male", selected: null, labelBoxes: [],
    quiz: {}, saved: null, savedDate: null, confirmErase: false
  };

  const saved = opts.load?.() || null;
  const height = saved?.heightCm || opts.prefill?.heightCm;
  if (height) q("[data-mz-height]").value = height;
  q("[data-mz-sex]").value = saved?.sex || opts.prefill?.sex || "male";
  ui.quiz = { ...(saved?.quiz || {}) };
  ui.saved = saved;
  if (saved?.levels) restore(saved);

  renderQuiz();
  renderPanel();
  refreshRunButton();
  bind();
  q("[data-mz='close']").focus({ preventScroll: true });
}

function close() {
  if (!ui) return;
  document.removeEventListener("keydown", ui.onKey);
  window.removeEventListener("resize", ui.onResize);
  ui.el.remove();
  ui = null;
}

function shell(T) {
  const poseA = `<svg viewBox="0 0 34 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="17" cy="6" r="4"/><path d="M17 10v17M17 13 6 25M17 13l11 12M17 27l-6 19M17 27l6 19"/></g></svg>`;
  const poseT = `<svg viewBox="0 0 34 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="17" cy="6" r="4"/><path d="M17 10v17M2 14h30M17 27l-6 19M17 27l6 19"/></g></svg>`;
  const legend = ["long", "moyen", "court", "incertain"].map(k => `<span style="--c:${COLORS[k]}">${esc(T.legend[k])}</span>`).join("");
  return `<div class="modal-card mz-card" role="dialog" aria-modal="true" aria-labelledby="mz-title">
    <div class="modal-head"><h3 id="mz-title">${esc(T.title)}</h3><button type="button" class="icon-btn" data-mz="close" aria-label="${esc(T.close)}">✕</button></div>
    <p class="mz-lead">${esc(T.lead)}</p>
    <div class="mz-grid">
      <section class="mz-main">
        <div class="mz-box" data-mz-setup>
          <h4 class="mz-h">${esc(T.photosTitle)}</h4>
          <div class="mz-form">
            <label class="mz-field"><span class="label">${esc(T.height)}</span>
              <input class="input" data-mz-height type="number" inputmode="numeric" min="120" max="230" placeholder="178">
            </label>
            <label class="mz-field"><span class="label">${esc(T.sex)}</span>
              <select class="input" data-mz-sex><option value="male">${esc(T.male)}</option><option value="female">${esc(T.female)}</option></select>
            </label>
            <label class="mz-drop" data-mz-drop="a">
              <input type="file" accept="image/*" multiple data-mz-file="a">
              <span class="mz-pose">${poseA}<span><strong data-mz-file-label="a">${esc(T.photoA)}</strong><small>${esc(T.photoAHint)}</small></span></span>
            </label>
            <label class="mz-drop mz-drop-optional" data-mz-drop="t">
              <input type="file" accept="image/*" data-mz-file="t">
              <span class="mz-pose">${poseT}<span><strong data-mz-file-label="t">${esc(T.photoT)}</strong><small>${esc(T.photoTHint)}</small></span></span>
            </label>
            <ul class="mz-tips">${T.tips.map(tip => `<li>${esc(tip)}</li>`).join("")}</ul>
            <button type="button" class="btn btn-primary btn-block mz-run" data-mz="run" disabled>${esc(T.run)}</button>
            <p class="mz-status" data-mz-status role="status"></p>
          </div>
          <p class="mz-privacy">${esc(T.privacy)}</p>
        </div>
        <div class="mz-box" data-mz-result hidden>
          <div data-mz-warnings></div>
          <div class="mz-stage"><canvas data-mz-canvas="a" aria-label="${esc(T.canvasLabel)}"></canvas></div>
          <div class="mz-stage" data-mz-stage-t hidden><canvas data-mz-canvas="t" aria-label="${esc(T.canvasTLabel)}"></canvas></div>
          <div class="mz-legend">${legend}</div>
          <div class="mz-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-mz="download">${esc(T.download)}</button>
            <button type="button" class="btn btn-surface btn-sm" data-mz="restart">${esc(T.restart)}</button>
          </div>
        </div>
      </section>
      <aside class="mz-box mz-panel" data-mz-panel>
        <h4 class="mz-h">${esc(T.adviceTitle)}</h4>
        <div data-mz-last></div>
        <div class="mz-zones" data-mz-zones></div>
        <div data-mz-detail></div>
      </aside>
      <section class="mz-box mz-quiz">
        <h4 class="mz-h">${esc(T.quizTitle)}</h4>
        <div data-mz-quiz></div>
      </section>
    </div>
  </div>`;
}

/* ---------- branchements ---------- */
function bind() {
  const { el } = ui;
  // Échap ferme le scan, sauf si la fiche d'un exercice est ouverte par-dessus
  ui.onKey = event => { if (event.key === "Escape" && !document.querySelector("#modal-details:not(.hidden)")) close(); };
  ui.onResize = () => { if (ui?.image) render(); };
  document.addEventListener("keydown", ui.onKey);
  window.addEventListener("resize", ui.onResize);

  el.addEventListener("click", event => {
    const action = event.target.closest("[data-mz]")?.dataset.mz;
    if (action === "close") return close();
    if (action === "run") return run();
    if (action === "download") return download();
    if (action === "restart") return restart();
    if (action === "erase") return erase();
    const zone = event.target.closest("[data-zone]");
    if (zone) return showDetail(zone.dataset.zone);
    const quiz = event.target.closest("[data-q]");
    if (quiz) return setQuiz(quiz.dataset.q, quiz.dataset.v);
    const ex = event.target.closest("[data-ex]");
    if (ex) return ui.opts.showDetails?.(ex.dataset.ex);
    const canvas = event.target.closest("[data-mz-canvas='a']");
    if (canvas && ui.image) {
      const key = zoneAt(canvasPoint(event));
      if (key) showDetail(key, { scroll: true });
    }
  });
  el.addEventListener("mousemove", event => {
    const canvas = event.target.closest("[data-mz-canvas='a']");
    if (canvas && ui.image) canvas.style.cursor = zoneAt(canvasPoint(event)) ? "pointer" : "default";
  });
  el.addEventListener("input", event => { if (event.target.matches("[data-mz-height]")) refreshRunButton(); });
  el.addEventListener("change", event => {
    const which = event.target.dataset.mzFile;
    if (which === "a") pickFilesA(event.target.files);
    if (which === "t") pickFileT(event.target.files[0]);
  });
  el.querySelectorAll("[data-mz-drop]").forEach(zone => {
    zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("is-drag"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-drag"));
    zone.addEventListener("drop", e => {
      e.preventDefault();
      zone.classList.remove("is-drag");
      if (zone.dataset.mzDrop === "a") pickFilesA(e.dataTransfer.files);
      else pickFileT(e.dataTransfer.files[0]);
    });
  });
}

/* ---------- formulaire ---------- */
function setStatus(text, isError = false) {
  const status = q("[data-mz-status]");
  status.textContent = text;
  status.classList.toggle("is-error", isError);
}

function refreshRunButton() {
  const h = Number(q("[data-mz-height]").value);
  q("[data-mz='run']").disabled = Boolean(ui.busy) || !(ui.filesA.length && h >= 120 && h <= 230);
}

function pickFilesA(list) {
  const files = [...(list || [])].filter(f => f.type.startsWith("image/")).slice(0, MAX_PHOTOS);
  if (!files.length) { setStatus(ui.T.notImage, true); return; }
  ui.filesA = files;
  q("[data-mz-file-label='a']").textContent = files.length === 1 ? files[0].name : fill(ui.T.photosChosen, { count: files.length });
  setStatus(list.length > MAX_PHOTOS ? fill(ui.T.keepFirst, { count: MAX_PHOTOS }) : "");
  refreshRunButton();
  // la personne a choisi sa photo : on commence à télécharger l'outil pendant qu'elle remplit le reste
  getLandmarker().catch(() => {});
}

function pickFileT(file) {
  if (!file || !file.type.startsWith("image/")) { setStatus(ui.T.notImage, true); return; }
  ui.fileT = file;
  q("[data-mz-file-label='t']").textContent = file.name;
  setStatus("");
}

async function run() {
  const T = ui.T;
  const heightCm = Number(q("[data-mz-height]").value);
  const sex = q("[data-mz-sex]").value === "female" ? "female" : "male";
  ui.busy = true;
  refreshRunButton();
  const current = ui;
  try {
    setStatus(T.loadingModel);
    const landmarker = await getLandmarker();
    if (ui !== current) return; // fenêtre fermée entre-temps
    const measures = [];
    let firstImage = null, skipped = 0;
    for (const [i, file] of ui.filesA.entries()) {
      setStatus(ui.filesA.length > 1 ? fill(T.analysingMany, { i: i + 1, n: ui.filesA.length }) : T.analysingOne);
      const image = await loadImage(file);
      const det = detect(landmarker, image);
      if (!det) { skipped++; continue; }
      measures.push(measureBody(det.landmarks, det.mask, image.width, image.height, heightCm, sex));
      if (!firstImage) firstImage = image;
    }
    if (!measures.length) { setStatus(T.noBody, true); return; }
    let span = null, imageT = null;
    if (ui.fileT) {
      setStatus(T.analysingT);
      imageT = await loadImage(ui.fileT);
      const det = detect(landmarker, imageT);
      if (det) span = measureSpan(det.landmarks, det.mask, imageT.width, imageT.height, heightCm, sex);
    }
    if (ui !== current) return;
    const measure = combine(measures);
    measure.skipped = skipped;
    const levels = classify(measure, sex, span);
    Object.assign(ui, { image: firstImage, imageT: span ? imageT : null, measure, span, levels, sex, selected: null, savedDate: new Date() });
    save(heightCm);
    showResult();
    setStatus("");
  } catch (err) {
    console.error("[Morpho]", err);
    if (ui === current) setStatus(T.failed, true);
  } finally {
    if (ui === current) { ui.busy = false; refreshRunButton(); }
  }
}

/* ---------- enregistrement (mesures seulement, jamais la photo) ---------- */
function save(heightCm) {
  const m = ui.measure;
  const levels = Object.fromEntries(Object.entries(ui.levels).map(([key, l]) => [key, {
    level: l.level, percentile: round(l.percentile), reliability: l.reliability,
    zPost: round(l.zPost, 3), sdPost: round(l.sdPost, 3), relNoise: round(l.relNoise, 3),
    invalid: Boolean(l.invalid), source: l.source || null
  }]));
  const data = {
    version: 3, date: ui.savedDate.toISOString(), heightCm, sex: ui.sex, photos: m.n || 1,
    cm: Object.fromEntries(["humerus", "forearm", "femur", "tibia", "trunk"].map(k => [k, round(m.cm[k])])),
    shoulderHip: round(m.shoulderHip, 3),
    flags: Object.fromEntries(Object.entries(m.flags || {}).filter(([, v]) => v).map(([k]) => [k, true])),
    span: ui.span?.ok ? { ok: true, spanCm: round(ui.span.spanCm), spanH: round(ui.span.spanH, 3) } : null,
    levels, quiz: ui.quiz
  };
  ui.saved = data;
  try { ui.opts.save?.(data); } catch (err) { console.error("[Morpho] save", err); }
}

/* dernier scan gardé sur le compte : on peut revoir les conseils sans la photo */
function restore(saved) {
  ui.measure = { cm: saved.cm || {}, n: saved.photos || 1, flags: saved.flags || {}, heightCm: saved.heightCm, shoulderHip: saved.shoulderHip ?? null, warnings: [] };
  ui.levels = saved.levels;
  ui.span = saved.span || null;
  ui.sex = saved.sex === "female" ? "female" : "male";
  ui.savedDate = saved.date ? new Date(saved.date) : null;
}

function erase() {
  if (!ui.confirmErase) {
    ui.confirmErase = true;
    renderLast();
    q("[data-mz='erase']")?.focus();
    return;
  }
  ui.confirmErase = false;
  const quiz = Object.keys(ui.quiz).length ? { quiz: ui.quiz } : null;
  ui.saved = quiz;
  try { ui.opts.save?.(quiz); } catch (err) { console.error("[Morpho] erase", err); }
  Object.assign(ui, { image: null, imageT: null, measure: null, span: null, levels: null, selected: null, savedDate: null });
  q("[data-mz-result]").hidden = true;
  q("[data-mz-setup]").hidden = false;
  renderPanel();
}

/* ---------- résultat ---------- */
function zoneList() { return ZONE_ORDER.filter(k => ui.levels?.[k]); }
/* « pas assez net » : la mesure penche d'un côté sans pouvoir conclure.
   Une mesure proche de la moyenne reste affichée « dans la moyenne », même peu précise. */
function unclear(key) {
  const l = ui.levels[key];
  return l.invalid || (l.reliability === "faible" && Math.abs(l.zPost) > 0.5);
}
function zoneColor(key) { return unclear(key) ? COLORS.incertain : COLORS[ui.levels[key].level] || COLORS.moyen; }
function levelName(key, level) { return (key === "shoulders" ? ui.T.shoulderLevels : ui.T.levels)[level] || ui.T.levels.moyen; }

function showResult() {
  const T = ui.T;
  q("[data-mz-setup]").hidden = true;
  q("[data-mz-result]").hidden = false;
  q("[data-mz-stage-t]").hidden = !(ui.imageT && ui.span);
  const codes = [...(ui.measure.warnings || []), ...(ui.span?.warnings || [])];
  const texts = [...new Set(codes)].map(code => T.warnings[code]).filter(Boolean);
  if (ui.measure.skipped) texts.push(fill(T.skipped, { count: ui.measure.skipped }));
  if (ui.fileT && !ui.span?.ok) texts.push(T.spanFailed);
  q("[data-mz-warnings]").innerHTML = texts.length ? `<div class="mz-warn">${texts.map(t => `<p>${esc(t)}</p>`).join("")}</div>` : "";
  render();
  renderPanel();
  q("[data-mz-result]").scrollIntoView({ behavior: "smooth", block: "start" });
}

function restart() {
  q("[data-mz-result]").hidden = true;
  q("[data-mz-setup]").hidden = false;
  q("[data-mz-setup]").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- photo annotée ---------- */
function renderScale(img) { return Math.max(1, MIN_RENDER_SIDE / Math.max(img.width, img.height)); }

/* unité des étiquettes : assez grande pour rester lisible sur un téléphone */
function labelUnit(img, displayWidth) {
  const u = Math.max(img.width, img.height) / 400;
  if (!displayWidth) return u;
  return Math.max(u, MIN_LABEL_PX * img.width / (6.2 * displayWidth));
}

function shortMeasure(key) {
  const m = ui.measure;
  if (ui.levels[key]?.invalid) return "?";
  if (key === "arm") return `${num(m.cm.humerus + m.cm.forearm, 0)} cm`;
  if (key === "shoulders") return unclear("shoulders") ? "?" : lower(levelName(key, ui.levels.shoulders.level));
  return `${num(m.cm[key], 0)} cm`;
}

function draw(ctx, { highlight = true, displayWidth = 0 } = {}) {
  const { image, measure } = ui;
  const W = image.width, H = image.height;
  ctx.setTransform(renderScale(image), 0, 0, renderScale(image), 0, 0);
  ctx.imageSmoothingQuality = "high";
  const u = Math.max(W, H) / 400;
  const lu = labelUnit(image, displayWidth);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(image, 0, 0);
  ctx.fillStyle = "rgba(20,16,12,0.28)";
  ctx.fillRect(0, 0, W, H);
  const p = measure.points;

  /* repère de taille */
  const xs = Object.values(p).map(pt => pt.x);
  const rulerX = Math.max(u * 10, Math.min(...xs) - u * 22);
  ctx.strokeStyle = "rgba(251,243,228,0.9)";
  ctx.lineWidth = u * 0.8;
  ctx.setLineDash([u * 2, u * 2]);
  ctx.beginPath();
  ctx.moveTo(rulerX - u * 5, measure.topY); ctx.lineTo(rulerX + u * 5, measure.topY);
  ctx.moveTo(rulerX - u * 5, measure.bottomY); ctx.lineTo(rulerX + u * 5, measure.bottomY);
  ctx.moveTo(rulerX, measure.topY); ctx.lineTo(rulerX, measure.bottomY);
  ctx.stroke();
  ctx.setLineDash([]);
  pill(ctx, `${measure.heightCm} cm`, rulerX, (measure.topY + measure.bottomY) / 2, "#2b2620", lu, "center", false, W);

  for (const key of zoneList()) {
    const color = zoneColor(key);
    const selected = highlight && ui.selected === key;
    for (const [a, b] of ZONES[key].segments) {
      ctx.lineCap = "round";
      if (selected) { ctx.strokeStyle = "#fbf3e4"; ctx.lineWidth = u * 6; line(ctx, p[a], p[b]); }
      ctx.strokeStyle = color;
      ctx.lineWidth = selected ? u * 4 : u * 2.6;
      line(ctx, p[a], p[b]);
    }
  }
  for (const j of ["lShoulder", "rShoulder", "lElbow", "rElbow", "lWrist", "rWrist", "lHip", "rHip", "lKnee", "rKnee", "lAnkle", "rAnkle"]) {
    ctx.fillStyle = "#fbf3e4"; ctx.beginPath(); ctx.arc(p[j].x, p[j].y, u * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2b2620"; ctx.beginPath(); ctx.arc(p[j].x, p[j].y, u * 1.1, 0, Math.PI * 2); ctx.fill();
  }

  /* étiquettes à l'extérieur du corps */
  ui.labelBoxes = [];
  const centerX = (p.lHip.x + p.rHip.x) / 2;
  const placed = [];
  for (const key of zoneList()) {
    const text = `${ui.T.short[key]} · ${shortMeasure(key)}`;
    let x, y, align;
    if (key === "shoulders") {
      x = (p.lShoulder.x + p.rShoulder.x) / 2; y = Math.min(p.lShoulder.y, p.rShoulder.y) - lu * 12; align = "center";
    } else {
      const segs = ZONES[key].segments.map(([a, b]) => ({ x: (p[a].x + p[b].x) / 2, y: (p[a].y + p[b].y) / 2 }));
      const pick = ["trunk", "forearm", "tibia"].includes(key)
        ? segs.reduce((best, s) => (s.x > best.x ? s : best))
        : segs.reduce((best, s) => (s.x < best.x ? s : best));
      const right = pick.x > centerX;
      x = pick.x + (right ? u * 14 : -u * 14); y = pick.y; align = right ? "left" : "right";
    }
    for (let tries = 0; tries < 6; tries++) {
      const clash = placed.find(b => b.align === align && Math.abs(b.y - y) < lu * 11 && Math.abs(b.x - x) < lu * 60);
      if (!clash) break;
      y = clash.y + lu * 12;
    }
    placed.push({ x, y, align });
    const box = pill(ctx, text, x, y, zoneColor(key), lu, align, highlight && ui.selected === key, W);
    ui.labelBoxes.push({ key, ...box });
  }
}

/* photo bras en croix : ligne d'envergure */
function drawSpan(ctx, displayWidth) {
  const img = ui.imageT, sp = ui.span;
  const W = img.width, H = img.height, s = renderScale(img);
  ctx.setTransform(s, 0, 0, s, 0, 0);
  const u = Math.max(W, H) / 400;
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = "rgba(20,16,12,0.28)"; ctx.fillRect(0, 0, W, H);
  const color = zoneColor("arm");
  ctx.strokeStyle = "#fbf3e4"; ctx.lineWidth = u * 1.2; ctx.setLineDash([u * 2, u * 2]);
  ctx.beginPath(); ctx.moveTo(sp.left, sp.rowY); ctx.lineTo(sp.right, sp.rowY); ctx.stroke(); ctx.setLineDash([]);
  for (const x of [sp.left, sp.right]) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, sp.rowY, u * 2.4, 0, Math.PI * 2); ctx.fill(); }
  const lu = labelUnit(img, displayWidth);
  pill(ctx, fill(ui.T.spanPill, { cm: num(sp.spanCm, 0), ratio: num(sp.spanH, 2) }), (sp.left + sp.right) / 2, sp.rowY - lu * 12, color, lu, "center", false, W);
}

function line(ctx, a, b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }

function pill(ctx, text, x, y, color, u, align, selected, maxW) {
  const fs = u * 6.2;
  ctx.font = `600 ${fs}px Poppins, sans-serif`;
  const tw = ctx.measureText(text).width;
  const padX = u * 4, h = fs * 1.7, w = tw + padX * 2;
  let left = align === "left" ? x : align === "right" ? x - w : x - w / 2;
  left = Math.max(u * 2, Math.min(maxW - w - u * 2, left));
  const top = y - h / 2;
  ctx.fillStyle = color;
  roundRect(ctx, left, top, w, h, h / 2);
  ctx.fill();
  if (selected) { ctx.strokeStyle = "#fbf3e4"; ctx.lineWidth = u * 1.2; ctx.stroke(); }
  ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
  ctx.fillText(text, left + padX, y + fs * 0.04);
  return { x: left, y: top, w, h };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function render() {
  if (!ui.image) return;
  const canvas = q("[data-mz-canvas='a']");
  const s = renderScale(ui.image);
  canvas.width = Math.round(ui.image.width * s);
  canvas.height = Math.round(ui.image.height * s);
  draw(canvas.getContext("2d"), { displayWidth: canvas.parentElement.clientWidth });
  if (ui.imageT && ui.span) {
    const c = q("[data-mz-canvas='t']");
    const st = renderScale(ui.imageT);
    c.width = Math.round(ui.imageT.width * st);
    c.height = Math.round(ui.imageT.height * st);
    drawSpan(c.getContext("2d"), c.parentElement.clientWidth);
  }
}

/* ---------- quelle zone a été touchée ---------- */
function distToSegment(pt, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
}

function insidePolygon(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function zoneAt(pt) {
  const p = ui.measure.points;
  for (const b of ui.labelBoxes) {
    if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) return b.key;
  }
  const tolerance = Math.hypot(p.lShoulder.x - p.rShoulder.x, p.lShoulder.y - p.rShoulder.y) * 0.32;
  let best = null, bestD = Infinity;
  for (const key of zoneList()) {
    if (key === "trunk" || key === "shoulders") continue;
    for (const [a, b] of ZONES[key].segments) {
      const d = distToSegment(pt, p[a], p[b]);
      if (d < bestD) { bestD = d; best = key; }
    }
  }
  if (bestD <= tolerance) return best;
  if (ui.levels.shoulders && distToSegment(pt, p.lShoulder, p.rShoulder) <= tolerance * 0.7) return "shoulders";
  if (insidePolygon(pt, [p.lShoulder, p.rShoulder, p.rHip, p.lHip])) return "trunk";
  return null;
}

function canvasPoint(event) {
  const canvas = q("[data-mz-canvas='a']");
  const r = canvas.getBoundingClientRect();
  return { x: (event.clientX - r.left) * ui.image.width / r.width, y: (event.clientY - r.top) * ui.image.height / r.height };
}

/* ---------- panneau de conseils ---------- */
function exerciseRow([id, why]) {
  const ex = ui.opts.exercise?.(id);
  if (!ex) return "";
  return `<button type="button" class="mz-ex" data-ex="${esc(id)}" aria-label="${esc(fill(ui.T.seeExercise, { name: ex.name }))}">
    <img src="${esc(ex.image || ex.fallback || "")}" alt="" loading="lazy" ${ex.fallback ? `data-fallback="${esc(ex.fallback)}"` : ""}>
    <span><strong>${esc(ex.name)}</strong>${why ? `<span>${esc(why)}</span>` : ""}</span>
  </button>`;
}

const Phi = z => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
};

function percentPhrase(key) {
  const T = ui.T, l = ui.levels[key];
  const who = ui.sex === "female" ? T.whoFemale : T.whoMale;
  const label = key === "arm" ? (l.source === "span" ? T.ratio.armSpan : T.ratio.armSeg) : T.ratio[key];
  const p = Math.round(l.percentile);
  const txt = p >= 50 ? fill(T.higherThan, { p, who }) : fill(T.lowerThan, { p: 100 - p, who });
  return `${esc(label)}${ui.locale.startsWith("fr") ? " :" : ":"} ${txt}`;
}

function measureText(key) {
  const T = ui.T, m = ui.measure;
  if (key === "arm") {
    return ui.span?.ok
      ? fill(T.measure.span, { v: num(ui.span.spanCm, 0) })
      : fill(T.measure.arm, { total: num(m.cm.humerus + m.cm.forearm, 1), h: num(m.cm.humerus, 1), f: num(m.cm.forearm, 1) });
  }
  if (key === "shoulders") return m.shoulderHip == null ? T.measure.shouldersNone : fill(T.measure.shoulders, { v: num(m.shoulderHip, 2) });
  return fill(T.measure.cm, { v: num(m.cm[key], 1) });
}

/* remarques selon les tests rapides (cheville, biceps, mollet) */
function extrasFor(key, level) {
  const E = ui.T.extras, quiz = ui.quiz, notes = [];
  if (key === "femur") {
    if (quiz.ankle === "raide") notes.push([E.ankleStiffFemur, ["heel-elevated-squat", "banded-ankle-stretch"]]);
    else if (quiz.ankle === "souple" && level === "long") notes.push([E.ankleSuppleLong, []]);
    else if (!quiz.ankle) notes.push([E.ankleUnknown, []]);
  }
  if (key === "tibia") {
    if (quiz.ankle === "raide") notes.push([E.ankleStiffTibia, ["banded-ankle-stretch", "standing-calf-stretch"]]);
    if (quiz.calf === "court") notes.push([E.calfShort, ["standing-calf-raise", "single-leg-calf-raise"]]);
    else if (quiz.calf === "long") notes.push([E.calfLong, ["standing-calf-raise"]]);
  }
  if (key === "arm") {
    if (!ui.span?.ok) notes.push([E.spanMissing, []]);
    if (quiz.biceps === "court") notes.push([E.bicepsShort, ["incline-db-curl", "preacher-curl"]]);
    else if (quiz.biceps === "long") notes.push([E.bicepsLong, ["incline-db-curl"]]);
    notes.push([E.triceps, ["cable-overhead-tricep-extension"]]);
  }
  return notes;
}

function showDetail(key, { scroll = false } = {}) {
  if (!ui.levels?.[key]) return;
  const T = ui.T;
  ui.selected = key;
  render();
  renderChips();
  const z = T.zones[key], l = ui.levels[key];
  const a = z[l.level] || z.moyen;
  const color = zoneColor(key);
  const uncertain = unclear(key);
  const badge = l.invalid ? T.badgeRedo : uncertain ? T.legend.incertain : levelName(key, l.level);
  const lo = Phi(l.zPost - l.sdPost) * 100, hi = Phi(l.zPost + l.sdPost) * 100;
  const extras = extrasFor(key, l.level).map(([text, ids]) =>
    `<div class="mz-extra"><p>${esc(text)}</p>${ids.map(id => exerciseRow([id, ""])).join("")}</div>`).join("");
  const armNote = (key === "arm" || key === "forearm") && ui.measure.flags?.arms && !(key === "arm" && ui.span?.ok)
    ? `<p class="mz-note">${esc(T.armsBent)}</p>` : "";
  const ends = key === "shoulders" ? [T.shoulderLevels.court, T.shoulderLevels.long] : [T.levels.court, T.levels.long];
  const side = lower(levelName(key, l.zPost > 0 ? "long" : "court"));
  const unclearNote = fill(T.unclearNote, { side, pct: Math.round((l.relNoise || 0) * 100) })
    + (key === "arm" && !ui.span?.ok ? ` ${T.unclearArmHint}` : "");
  q("[data-mz-detail]").innerHTML = `
    <div class="mz-zone-head"><h5>${esc(z.label)}</h5><span class="mz-badge" style="--c:${color}">${esc(badge)}</span></div>
    <p class="mz-measure">${esc(measureText(key))}</p>
    ${l.invalid ? `<p class="mz-pct">${esc(T.invalidPct)}</p>` : `<p class="mz-pct">${percentPhrase(key)}<span class="mz-rel">${esc(T.reliability[l.reliability] || "")}</span></p>
    <div class="mz-bar" aria-hidden="true"><span class="q" style="left:25%"></span><span class="q" style="left:75%"></span>
      <span class="band" style="--c:${color}; left:${lo}%; width:${Math.max(2, hi - lo)}%"></span>
      <b style="--c:${color}; left:${Math.max(3, Math.min(97, l.percentile))}%"></b></div>
    <div class="mz-bar-labels" aria-hidden="true"><span>${esc(ends[0])}</span><span>${esc(T.barMid)}</span><span>${esc(ends[1])}</span></div>`}
    ${l.invalid ? `<p class="mz-note">${esc(T.invalidNote)}</p>` : uncertain ? `<p class="mz-note">${esc(unclearNote)}</p>` : ""}
    <p class="mz-why"><strong>${esc(a.title)}.</strong> ${esc(a.why)}</p>
    <p class="mz-sub">${esc(T.goodTitle)}</p>
    ${a.good.map(exerciseRow).join("")}
    ${a.adapt.length ? `<p class="mz-sub">${esc(T.adaptTitle)}</p>${a.adapt.map(exerciseRow).join("")}` : ""}
    ${extras ? `<p class="mz-sub">${esc(T.testsTitle)}</p>${extras}` : ""}
    ${armNote}
    <p class="mz-note">${esc((ui.measure.n || 1) > 1 ? T.disclaimerMany : T.disclaimerOne)}</p>`;
  q("[data-mz-detail]").querySelectorAll("img[data-fallback]").forEach(img => {
    img.addEventListener("error", () => {
      if (img.src.endsWith(img.dataset.fallback)) { img.style.visibility = "hidden"; return; }
      img.src = img.dataset.fallback;
    }, { once: false });
  });
  if (scroll && window.matchMedia("(max-width: 899px)").matches) q("[data-mz-panel]").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderChips() {
  q("[data-mz-zones]").innerHTML = zoneList().map(key =>
    `<button type="button" class="mz-chip" data-zone="${key}" aria-pressed="${ui.selected === key}" style="--c:${zoneColor(key)}"><i></i>${esc(ui.T.short[key])}</button>`
  ).join("");
}

function renderLast() {
  const T = ui.T, box = q("[data-mz-last]");
  if (!ui.levels || !ui.savedDate) { box.innerHTML = ""; return; }
  const date = ui.savedDate.toLocaleDateString(ui.locale, { day: "numeric", month: "long", year: ui.savedDate.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
  box.innerHTML = `<div class="mz-last">
      <p>${esc(fill(T.lastScan, { date }))}</p>
      <button type="button" class="mz-erase${ui.confirmErase ? " is-confirming" : ""}" data-mz="erase" aria-label="${esc(ui.confirmErase ? T.eraseConfirm : T.eraseLabel)}">${esc(ui.confirmErase ? T.eraseConfirm : T.erase)}</button>
    </div>
    ${ui.image ? "" : `<p class="mz-note mz-note-top">${esc(T.photoNotKept)}</p>`}`;
}

function renderPanel() {
  const T = ui.T;
  ui.confirmErase = false;
  renderLast();
  if (!ui.levels) {
    q("[data-mz-zones]").innerHTML = "";
    q("[data-mz-detail]").innerHTML = `<p class="mz-empty">${esc(T.emptyBefore)}</p>`;
    return;
  }
  renderChips();
  q("[data-mz-detail]").innerHTML = `<p class="mz-empty">${esc(ui.image ? T.emptyAfter : T.emptySaved)}</p>`;
}

function download() {
  const c = document.createElement("canvas");
  const s = renderScale(ui.image);
  c.width = Math.round(ui.image.width * s);
  c.height = Math.round(ui.image.height * s);
  draw(c.getContext("2d"), { highlight: false });
  c.toBlob(blob => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tracklift-morpho.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, "image/png");
}

/* ---------- tests rapides ---------- */
function renderQuiz() {
  q("[data-mz-quiz]").innerHTML = ui.T.quiz.map(item => `
    <div class="mz-q">
      <h5>${esc(item.title)}</h5>
      <p>${esc(item.how)}</p>
      <div class="mz-opts">${item.options.map(([v, label]) =>
        `<button type="button" class="mz-opt" data-q="${item.key}" data-v="${v}" aria-pressed="${ui.quiz[item.key] === v}">${esc(label)}</button>`).join("")}</div>
    </div>`).join("");
}

function setQuiz(key, value) {
  if (ui.quiz[key] === value) delete ui.quiz[key];
  else ui.quiz[key] = value;
  const data = { ...(ui.saved || {}), quiz: { ...ui.quiz } };
  ui.saved = data;
  try { ui.opts.save?.(data); } catch (err) { console.error("[Morpho] quiz", err); }
  renderQuiz();
  if (ui.levels && ui.selected) showDetail(ui.selected);
}
