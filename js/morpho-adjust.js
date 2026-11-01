/* ═══════════════════════════════════════════════════════════
   Scan morpho : corriger les points à la main.
   Étape par étape, la personne déplace les repères placés par
   l'outil (sommet du crâne, épaules, coudes, poignets, entrejambe,
   genoux, chevilles, sol). Elle peut aussi tracer deux verticales
   du décor (bords de porte, angle de mur) pour redresser une photo
   prise avec le téléphone penché.
   Une loupe montre le détail autour du point ; faire glisser le
   doigt dans la loupe déplace le point trois fois moins vite,
   pour un réglage fin. Un appui ailleurs sur la photo y amène le
   point le plus proche.
   ═══════════════════════════════════════════════════════════ */

const STEPS = [
  { id: "decor", keys: ["L0a", "L0b", "L1a", "L1b"] },
  { id: "top", keys: ["top"] },
  { id: "shoulders", keys: ["lShoulder", "rShoulder"] },
  { id: "elbows", keys: ["lElbow", "rElbow"] },
  { id: "wrists", keys: ["lWrist", "rWrist"] },
  { id: "crotch", keys: ["crotch"] },
  { id: "knees", keys: ["lKnee", "rKnee"] },
  { id: "ankles", keys: ["lAnkle", "rAnkle"] },
  { id: "floor", keys: ["floor"] }
];
const GROUP = {
  top: "top", floor: "floor", crotch: "crotch",
  lShoulder: "shoulders", rShoulder: "shoulders", lElbow: "elbows", rElbow: "elbows",
  lWrist: "wrists", rWrist: "wrists", lKnee: "knees", rKnee: "knees", lAnkle: "ankles", rAnkle: "ankles"
};
const BONES = [["lShoulder", "rShoulder"], ["lShoulder", "lElbow"], ["lElbow", "lWrist"], ["rShoulder", "rElbow"], ["rElbow", "rWrist"],
  ["crotch", "lKnee"], ["crotch", "rKnee"], ["lKnee", "lAnkle"], ["rKnee", "rAnkle"]];
const ZOOM = 3;
const LOUPE = 100;   // px à l'écran
const ORANGE = "#ff7a00", CREAM = "#fbf3e4", INK = "#2b2620";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clone = o => JSON.parse(JSON.stringify(o));

/**
 * opts : { container, image (canvas), points, lines ([{a, b}] ou null), texts,
 *          onStraighten(lines) → Promise<{ image, points, map(p) } | null>, onDone({ points, moved }), onCancel() }
 */
export function openAdjust(opts) {
  const X = opts.texts;
  const el = document.createElement("div");
  el.className = "mz-adjust";
  el.innerHTML = `
    <div class="mz-adjust-stage"><canvas class="mz-adjust-canvas" tabindex="0" aria-label="${esc(X.canvasLabel)}"></canvas></div>
    <div class="mz-adjust-panel">
      <canvas class="mz-loupe" title="${esc(X.loupe)}"></canvas>
      <div class="mz-adjust-text" aria-live="polite">
        <p class="mz-adjust-count"><span data-adj-count></span><button type="button" class="mz-adjust-cancel" data-adj="cancel">${esc(X.cancel)}</button></p>
        <h5 data-adj-title></h5>
        <p data-adj-help></p>
      </div>
    </div>
    <p class="mz-adjust-status" data-adj-status role="status"></p>
    <div class="mz-adjust-actions">
      <button type="button" class="btn btn-surface btn-sm" data-adj="prev">${esc(X.prev)}</button>
      <button type="button" class="btn btn-primary mz-adjust-next" data-adj="next"></button>
    </div>`;
  opts.container.appendChild(el);
  const stage = el.querySelector(".mz-adjust-canvas");
  const loupe = el.querySelector(".mz-loupe");
  const $ = sel => el.querySelector(sel);

  const st = {
    image: opts.image,
    pts: clone(opts.points),
    lines: opts.lines ? clone(opts.lines) : defaultLines(opts.image),
    linesAuto: Boolean(opts.lines),
    linesTouched: false,
    moved: new Set(),
    step: 0, drag: null, focus: null, busy: false, view: { s: 1, dpr: 1 }
  };

  /* banc d'essai seulement (jamais activé dans l'appli) */
  if (window.__mzAdjustDebug) window.__mzAdjustDebug.state = st;
  const handle = key => (key[0] === "L" && key.length === 3 ? st.lines[Number(key[1])][key[2]] : st.pts[key]);
  const activeKeys = () => STEPS[st.step].keys;
  const focusKey = () => (st.focus && activeKeys().includes(st.focus) ? st.focus : activeKeys()[0]);

  function setHandle(key, x, y) {
    const W = st.image.width, H = st.image.height;
    const p = handle(key);
    if (key !== "floor") p.x = Math.max(0, Math.min(W, x));
    p.y = Math.max(0, Math.min(H, y));
  }
  function markMoved() {
    const id = STEPS[st.step].id;
    if (id === "decor") st.linesTouched = true;
    else st.moved.add(id);
    refreshButtons();
  }

  /* ---------- mise en page et dessin ---------- */
  function layout() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const box = stage.parentElement;
    const maxW = box.clientWidth || 320;
    /* photo, consigne et boutons tiennent sur un écran de téléphone */
    const maxH = Math.max(240, Math.min(window.innerHeight * 0.62, window.innerHeight - 330));
    const ratio = st.image.width / st.image.height;
    const w = Math.min(maxW, maxH * ratio), h = w / ratio;
    stage.style.width = `${w}px`; stage.style.height = `${h}px`;
    stage.width = Math.round(w * dpr); stage.height = Math.round(h * dpr);
    loupe.style.width = loupe.style.height = `${LOUPE}px`;
    loupe.width = loupe.height = Math.round(LOUPE * dpr);
    st.view = { s: w / st.image.width, dpr };
    redraw();
  }

  function drawScene(ctx, k) {
    const lw = px => px / k;   // épaisseur en pixels d'écran, convertie en pixels de photo
    const P = st.pts, W = st.image.width, H = st.image.height;
    const id = STEPS[st.step].id;
    const active = new Set(activeKeys());
    ctx.lineCap = "round";
    /* squelette */
    ctx.strokeStyle = "rgba(251,243,228,0.7)"; ctx.lineWidth = lw(1.6);
    for (const [a, b] of BONES) { ctx.beginPath(); ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[b].x, P[b].y); ctx.stroke(); }
    /* sol */
    const floorOn = active.has("floor");
    ctx.strokeStyle = floorOn ? ORANGE : "rgba(251,243,228,0.85)"; ctx.lineWidth = lw(floorOn ? 2.6 : 1.4);
    ctx.setLineDash([lw(7), lw(5)]);
    ctx.beginPath(); ctx.moveTo(0, P.floor.y); ctx.lineTo(W, P.floor.y); ctx.stroke();
    ctx.setLineDash([]);
    /* sommet du crâne */
    const topOn = active.has("top");
    ctx.strokeStyle = topOn ? ORANGE : CREAM; ctx.lineWidth = lw(topOn ? 2.6 : 1.6);
    ctx.beginPath(); ctx.moveTo(P.top.x - lw(16), P.top.y); ctx.lineTo(P.top.x + lw(16), P.top.y); ctx.stroke();
    /* verticales du décor */
    if (id === "decor") {
      for (const l of st.lines) {
        const t = (l.b.x - l.a.x) / ((l.b.y - l.a.y) || 1e-6);
        ctx.strokeStyle = ORANGE; ctx.lineWidth = lw(2.2);
        ctx.beginPath(); ctx.moveTo(l.a.x - t * l.a.y, 0); ctx.lineTo(l.a.x + t * (H - l.a.y), H); ctx.stroke();
      }
    }
    /* points */
    const all = id === "decor" ? [] : Object.keys(P).filter(key => key !== "floor");
    for (const key of all) {
      if (active.has(key)) continue;
      const p = P[key];
      ctx.fillStyle = CREAM; ctx.beginPath(); ctx.arc(p.x, p.y, lw(4), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(p.x, p.y, lw(1.8), 0, Math.PI * 2); ctx.fill();
    }
    for (const key of active) {
      const p = handle(key);
      ctx.fillStyle = "rgba(255,122,0,0.2)"; ctx.beginPath(); ctx.arc(p.x, p.y, lw(13), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ORANGE; ctx.lineWidth = lw(2.6); ctx.stroke();
      ctx.fillStyle = key === focusKey() ? ORANGE : CREAM;
      ctx.beginPath(); ctx.arc(p.x, p.y, lw(2.8), 0, Math.PI * 2); ctx.fill();
    }
  }

  function redraw() {
    const { s, dpr } = st.view;
    const ctx = stage.getContext("2d");
    ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(st.image, 0, 0);
    ctx.fillStyle = "rgba(20,16,12,0.22)"; ctx.fillRect(0, 0, st.image.width, st.image.height);
    drawScene(ctx, s);
    drawLoupe();
  }

  function drawLoupe() {
    const { s, dpr } = st.view;
    const k = s * ZOOM;                // pixels d'écran par pixel de photo dans la loupe
    const p = handle(focusKey());
    const ctx = loupe.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = INK; ctx.fillRect(0, 0, loupe.width, loupe.height);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * (LOUPE / 2 - k * p.x), dpr * (LOUPE / 2 - k * p.y));
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(st.image, 0, 0);
    drawScene(ctx, k);
    /* croix au centre */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(LOUPE / 2, LOUPE / 2 - 9); ctx.lineTo(LOUPE / 2, LOUPE / 2 + 9);
    ctx.moveTo(LOUPE / 2 - 9, LOUPE / 2); ctx.lineTo(LOUPE / 2 + 9, LOUPE / 2); ctx.stroke();
  }

  /* ---------- doigt et souris ---------- */
  function toImage(event) {
    const r = stage.getBoundingClientRect();
    return { x: (event.clientX - r.left) / st.view.s, y: (event.clientY - r.top) / st.view.s };
  }
  function nearest(p) {
    let best = null, bestD = Infinity;
    for (const key of activeKeys()) {
      const q = handle(key);
      const d = key === "floor" ? Math.abs(q.y - p.y) : Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bestD) { bestD = d; best = key; }
    }
    return { key: best, cssDist: bestD * st.view.s };
  }
  stage.addEventListener("pointerdown", event => {
    if (st.busy) return;
    event.preventDefault();
    const p = toImage(event);
    const { key, cssDist } = nearest(p);
    const q = handle(key);
    st.focus = key;
    st.drag = { key, x: event.clientX, y: event.clientY, from: { x: q.x, y: q.y }, tap: p, near: cssDist <= 10, moved: false, speed: 1 / st.view.s };
    stage.setPointerCapture?.(event.pointerId);
    redraw();
  });
  loupe.addEventListener("pointerdown", event => {
    if (st.busy) return;
    event.preventDefault();
    const key = focusKey(), q = handle(key);
    st.drag = { key, x: event.clientX, y: event.clientY, from: { x: q.x, y: q.y }, tap: null, near: true, moved: false, speed: 1 / (st.view.s * ZOOM), fine: true };
    loupe.setPointerCapture?.(event.pointerId);
  });
  const onMove = event => {
    const d = st.drag;
    if (!d) return;
    const dx = event.clientX - d.x, dy = event.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    /* loupe : le décor glisse sous la croix, le point suit le doigt en sens inverse du décor */
    const sign = d.fine ? -1 : 1;
    setHandle(d.key, d.from.x + sign * dx * d.speed, d.from.y + sign * dy * d.speed);
    redraw();
  };
  const onUp = () => {
    const d = st.drag;
    st.drag = null;
    if (!d) return;
    if (!d.moved && d.tap && !d.near) setHandle(d.key, d.tap.x, d.tap.y);   // appui : le point vient ici
    if (d.moved || (d.tap && !d.near)) markMoved();
    redraw();
  };
  for (const target of [stage, loupe]) {
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", () => { st.drag = null; redraw(); });
  }
  /* clavier : flèches pour déplacer le point actif (Maj : plus vite), Tab pour changer de point */
  stage.addEventListener("keydown", event => {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (step) {
      event.preventDefault();
      const key = focusKey(), q = handle(key), n = (event.shiftKey ? 8 : 1) / st.view.s;
      setHandle(key, q.x + step[0] * n, q.y + step[1] * n);
      markMoved(); redraw();
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      const keys = activeKeys();
      st.focus = keys[(keys.indexOf(focusKey()) + 1) % keys.length];
      redraw();
    }
  });

  /* ---------- étapes ---------- */
  function refreshButtons() {
    const id = STEPS[st.step].id, last = st.step === STEPS.length - 1;
    $("[data-adj='prev']").disabled = st.step === 0 || st.busy;
    const next = $("[data-adj='next']");
    next.disabled = st.busy;
    next.textContent = last ? X.done : id === "decor" && !st.linesTouched ? X.skip : X.next;
  }
  function renderStep() {
    const id = STEPS[st.step].id;
    $("[data-adj-count]").textContent = X.stepOf.replace("{i}", st.step + 1).replace("{n}", STEPS.length);
    $("[data-adj-title]").textContent = X.steps[id].title;
    $("[data-adj-help]").textContent = X.steps[id].help;
    refreshButtons();
    redraw();
    /* la photo reste à l'écran d'une étape à l'autre */
    const r = stage.getBoundingClientRect();
    if (r.top < 60 || r.bottom > window.innerHeight) el.scrollIntoView({ block: "start", behavior: "smooth" });
  }
  const status = text => { $("[data-adj-status]").textContent = text || ""; };

  async function next() {
    if (st.busy) return;
    const id = STEPS[st.step].id;
    status("");
    if (id === "decor" && st.linesTouched && opts.onStraighten) {
      st.busy = true; refreshButtons(); status(X.straightening);
      try {
        const res = await opts.onStraighten(clone(st.lines));
        if (res) {
          /* les points déjà corrigés suivent la photo redressée, les autres repartent du calcul automatique */
          for (const key of Object.keys(st.pts)) {
            st.pts[key] = st.moved.has(GROUP[key]) ? res.map(st.pts[key]) : { ...res.points[key] };
          }
          st.lines = st.lines.map(l => ({ a: res.map(l.a), b: res.map(l.b) }));
          st.image = res.image;
          st.linesTouched = false;
          layout();
          status(res.message || "");
        } else status(X.straightenNone);
      } catch (err) {
        console.error("[Morpho] redressement", err);
        status(X.straightenFailed);
      } finally {
        st.busy = false;
      }
    }
    if (st.step < STEPS.length - 1) { st.step++; st.focus = null; renderStep(); return; }
    finish();
  }
  function prev() { if (!st.busy && st.step > 0) { st.step--; st.focus = null; status(""); renderStep(); } }
  function finish() { destroy(); opts.onDone?.({ points: clone(st.pts), moved: [...st.moved], image: st.image }); }
  function cancel() { destroy(); opts.onCancel?.(); }

  el.addEventListener("click", event => {
    const a = event.target.closest("[data-adj]")?.dataset.adj;
    if (a === "next") next();
    else if (a === "prev") prev();
    else if (a === "cancel") cancel();
  });
  const onResize = () => layout();
  window.addEventListener("resize", onResize);
  function destroy() { window.removeEventListener("resize", onResize); el.remove(); }

  layout();
  renderStep();
  stage.focus({ preventScroll: true });
  return { close: destroy, element: el };
}

/* verticales de départ quand le décor n'en montre pas (à aligner par la personne) */
function defaultLines(image) {
  const W = image.width, H = image.height;
  return [0.14, 0.86].map(f => ({ a: { x: W * f, y: H * 0.18 }, b: { x: W * f, y: H * 0.78 } }));
}
