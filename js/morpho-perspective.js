/* ═══════════════════════════════════════════════════════════
   Scan morpho : redresser une photo prise avec le téléphone penché.
   Un téléphone penché vers le haut ou vers le bas déforme le corps :
   le haut et le bas ne sont plus à la même échelle (jusqu'à 10 %
   d'écart sur la hauteur des genoux pour 10° de pente).
   1. On repère les lignes verticales du décor (bords de porte, angles
      de mur, meubles), en dehors de la silhouette.
   2. Ces lignes se rejoignent en un point (point de fuite) : sa
      position donne la pente du téléphone.
   3. On fait « tourner » la photo pour que ces lignes redeviennent
      verticales, comme si le téléphone avait été tenu droit.
   La personne peut aussi tracer elle-même les verticales.
   Tout est calculé sur l'appareil.
   ═══════════════════════════════════════════════════════════ */

const WORK = 640;            // côté le plus long de l'image d'analyse
const MAX_ANGLE = 12;        // degrés : au-delà, ce n'est pas une verticale du décor penchée
const ANGLE_STEP = 0.2;

/* focale en pixels : objectif principal d'un téléphone (26 mm en équivalent 24×36), ou d'après
   les données de la photo (EXIF). Rapportée au grand côté de l'image (34,6 mm pour un capteur 4:3) :
   une photo 16:9 est un recadrage du 4:3 qui garde ce grand côté. */
export function focalPx(width, height, focal35 = 26) {
  return Math.max(width, height) * focal35 / 34.6;
}

/* ---------- 1. lignes verticales du décor ---------- */

/**
 * @param {HTMLCanvasElement} canvas la photo
 * @param {{data: Float32Array, width, height}|null} mask silhouette (exclue de la recherche)
 * @returns {Array<{x0, t, y0, y1, votes, len}>} lignes x = x0 + t·(y − h/2), en pixels de la photo
 */
export function findVerticals(canvas, mask = null) {
  const scale = Math.min(1, WORK / Math.max(canvas.width, canvas.height));
  const W = Math.max(8, Math.round(canvas.width * scale)), H = Math.max(8, Math.round(canvas.height * scale));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(canvas, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data;
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lum[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];

  /* silhouette élargie : ses bords (jambes, bras) ne sont pas des verticales du décor */
  const blocked = new Uint8Array(W * H);
  if (mask) {
    const sx = mask.width / W, sy = mask.height / H, grow = Math.round(W * 0.025);
    const inside = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (mask.data[Math.min(mask.height - 1, Math.floor(y * sy)) * mask.width + Math.min(mask.width - 1, Math.floor(x * sx))] > 0.3) inside[y * W + x] = 1;
    }
    /* dilatation séparable (lignes puis colonnes) */
    const tmp = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      let last = -1e9;
      for (let x = 0; x < W; x++) { if (inside[y * W + x]) last = x; if (x - last <= grow) tmp[y * W + x] = 1; }
      last = 1e9;
      for (let x = W - 1; x >= 0; x--) { if (inside[y * W + x]) last = x; if (last - x <= grow) tmp[y * W + x] = 1; }
    }
    for (let x = 0; x < W; x++) {
      let last = -1e9;
      for (let y = 0; y < H; y++) { if (tmp[y * W + x]) last = y; if (y - last <= grow) blocked[y * W + x] = 1; }
      last = 1e9;
      for (let y = H - 1; y >= 0; y--) { if (tmp[y * W + x]) last = y; if (last - y <= grow) blocked[y * W + x] = 1; }
    }
  }
  /* bandes noires autour de la photo (marge, photo déjà redressée) : leur bord n'est pas une
     ligne du décor, on écarte aussi les 3 pixels voisins */
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (px[i * 4] < 6 && px[i * 4 + 1] < 6 && px[i * 4 + 2] < 6) {
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && yy < H && xx >= 0 && xx < W) blocked[yy * W + xx] = 1;
      }
    }
  }

  /* contours presque verticaux (gradient surtout horizontal), filtre de Sobel */
  const edges = [];
  let sum = 0, count = 0;
  const mag = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const gx = (lum[i - W + 1] + 2 * lum[i + 1] + lum[i + W + 1]) - (lum[i - W - 1] + 2 * lum[i - 1] + lum[i + W - 1]);
    const gy = (lum[i + W - 1] + 2 * lum[i + W] + lum[i + W + 1]) - (lum[i - W - 1] + 2 * lum[i - W] + lum[i - W + 1]);
    if (Math.abs(gx) > 2.5 * Math.abs(gy)) { mag[i] = Math.abs(gx); sum += mag[i]; count++; }
  }
  const threshold = Math.max(24, (count ? sum / count : 0) * 1.6);
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x;
    /* maximum local sur la ligne (contour fin), hors silhouette */
    if (mag[i] >= threshold && mag[i] >= mag[i - 1] && mag[i] >= mag[i + 1] && !blocked[i]) edges.push(x, y);
  }

  /* transformée de Hough limitée aux droites presque verticales : x = x0 + t·(y − H/2) */
  const nA = Math.round(2 * MAX_ANGLE / ANGLE_STEP) + 1;
  const tans = Array.from({ length: nA }, (_, k) => Math.tan((-MAX_ANGLE + k * ANGLE_STEP) * Math.PI / 180));
  const pad = Math.ceil(H * Math.tan(MAX_ANGLE * Math.PI / 180) / 2) + 2;
  const nX = W + 2 * pad;
  const acc = new Float32Array(nA * nX);
  const yc = H / 2;
  for (let e = 0; e < edges.length; e += 2) {
    const x = edges[e], dy = edges[e + 1] - yc;
    for (let k = 0; k < nA; k++) {
      const x0 = Math.round(x - tans[k] * dy) + pad;
      if (x0 >= 0 && x0 < nX) acc[k * nX + x0] += 1;
    }
  }
  /* pics : droites assez longues (au moins 22 % de la hauteur couverte de contours) */
  const peaks = [];
  const minVotes = H * 0.22;
  for (let k = 0; k < nA; k++) for (let x0 = 1; x0 < nX - 1; x0++) {
    const v = acc[k * nX + x0];
    if (v < minVotes) continue;
    let isMax = true;
    for (let dk = -3; dk <= 3 && isMax; dk++) for (let dx = -4; dx <= 4; dx++) {
      if (!dk && !dx) continue;
      const kk = k + dk, xx = x0 + dx;
      if (kk >= 0 && kk < nA && xx >= 0 && xx < nX && acc[kk * nX + xx] > v) { isMax = false; break; }
    }
    if (isMax) peaks.push({ k, x0: x0 - pad, v });
  }
  peaks.sort((a, b) => b.v - a.v);

  /* affinage de chaque droite par moindres carrés sur ses points proches */
  const lines = [];
  for (const pk of peaks.slice(0, 14)) {
    let t = tans[pk.k], x0 = pk.x0;
    let pts = [];
    for (let pass = 0; pass < 2; pass++) {
      pts = [];
      for (let e = 0; e < edges.length; e += 2) {
        const x = edges[e], y = edges[e + 1];
        if (Math.abs(x - (x0 + t * (y - yc))) <= 1.6) pts.push(x, y);
      }
      if (pts.length < 20) break;
      let sy = 0, sx = 0, syy = 0, sxy = 0; const n = pts.length / 2;
      for (let i = 0; i < pts.length; i += 2) { const dy = pts[i + 1] - yc; sy += dy; sx += pts[i]; syy += dy * dy; sxy += dy * pts[i]; }
      const den = n * syy - sy * sy;
      if (Math.abs(den) < 1e-6) break;
      t = (n * sxy - sx * sy) / den; x0 = (sx - t * sy) / n;
    }
    if (pts.length < 20) continue;
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 1; i < pts.length; i += 2) { if (pts[i] < y0) y0 = pts[i]; if (pts[i] > y1) y1 = pts[i]; }
    const len = y1 - y0;
    /* longue et bien remplie (pas une suite de petits bouts alignés par hasard) */
    if (len < H * 0.22 || pts.length / 2 < len * 0.55) continue;
    if (lines.some(l => Math.abs(l.t - t) < 0.01 && Math.abs(l.x0 - x0) < 5)) continue;
    lines.push({ x0, t, y0, y1, votes: pts.length / 2 });
  }
  /* retour aux pixels de la photo */
  return lines.map(l => ({
    x0: l.x0 / scale, t: l.t, y0: l.y0 / scale, y1: l.y1 / scale, votes: l.votes, len: (l.y1 - l.y0) / scale
  }));
}

/* ---------- 2. point de fuite et pente du téléphone ---------- */

/* une droite x = x0 + t·(y − h/2) en coordonnées centrées (u = x − w/2, v = y − h/2), normalisées par f */
function lineCoeffs(l, w, h, f) {
  /* u − t·v − (x0 − w/2) = 0  →  (1, −t, −(x0 − w/2)/f) dans le repère divisé par f */
  return [1, -l.t, -(l.x0 - w / 2) / f];
}

/* plus petit vecteur propre d'une matrice 3×3 symétrique (méthode de Jacobi) */
function smallestEigenvector(M) {
  const a = M.map(r => r.slice());
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 30; sweep++) {
    let off = 0;
    for (let p = 0; p < 2; p++) for (let q = p + 1; q < 3; q++) off += a[p][q] * a[p][q];
    if (off < 1e-18) break;
    for (let p = 0; p < 2; p++) for (let q = p + 1; q < 3; q++) {
      if (Math.abs(a[p][q]) < 1e-20) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
      for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < 3; k++) { const vkp = v[k][p], vkq = v[k][q]; v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq; }
    }
  }
  let best = 0;
  for (let i = 1; i < 3; i++) if (a[i][i] < a[best][best]) best = i;
  return [v[0][best], v[1][best], v[2][best]];
}

/**
 * Direction verticale vue par l'appareil, à partir des droites verticales du décor.
 * @returns {null | {dir:[x,y,z], pitch, roll, used, spread}} pitch > 0 : téléphone penché vers le bas
 */
export function verticalFromLines(lines, w, h, f = focalPx(w, h)) {
  const list = lines.filter(l => l && Number.isFinite(l.t) && Number.isFinite(l.x0));
  if (!list.length) return null;
  const solve = sub => {
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const l of sub) {
      const c = lineCoeffs(l, w, h, f);
      const n = Math.hypot(c[0], c[1]);
      const wgt = Math.max(1, l.len || 1);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i][j] += wgt * c[i] * c[j] / (n * n);
    }
    let d = smallestEigenvector(M);
    if (d[1] < 0) d = d.map(x => -x);   // vers le bas de la photo
    return d;
  };
  /* une seule droite : on suppose le téléphone sans rotation sur le côté (point de fuite au centre) */
  let used = list;
  if (list.length === 1) {
    const l = list[0];
    const u = (l.x0 - w / 2) / f;           // décalage de la droite au milieu de la photo
    if (Math.abs(u) < 0.08) return null;    // trop près du centre : la pente ne se voit pas
    /* la droite passe par (u, 0) avec pente t : le point de fuite est sur l'axe central, en v = −u/t */
    const dir = Math.abs(l.t) < 1e-6 ? [0, 1, 0] : [0, -u / l.t, 1];
    return finish(dir.map(x => x * Math.sign(dir[1] || 1)), list, 0);
  }
  /* plusieurs droites : on écarte celles qui ne passent pas par le point commun */
  let dir = solve(list);
  for (let round = 0; round < 2 && list.length > 2; round++) {
    const err = l => angleToVp(l, dir, w, h, f);
    const keep = list.filter(l => err(l) < 0.6);
    if (keep.length >= 2 && keep.length < used.length) { used = keep; dir = solve(used); }
  }
  const spread = Math.max(...used.map(l => angleToVp(l, dir, w, h, f)));
  return finish(dir, used, spread);

  function finish(d, usedLines, spreadDeg) {
    const n = Math.hypot(...d);
    const [x, y, z] = d.map(v => v / n);
    /* tangage : la verticale du monde penche vers l'avant ou l'arrière dans le repère de l'appareil */
    const pitch = Math.atan2(z, y) * 180 / Math.PI;
    const roll = Math.atan2(x, y) * 180 / Math.PI;
    return { dir: [x, y, z], pitch, roll, used: usedLines, spread: spreadDeg };
  }
}

/* écart (degrés) entre une droite et la direction qui la relierait au point de fuite */
function angleToVp(l, dir, w, h, f) {
  const u = (l.x0 - w / 2) / f;
  /* direction attendue au point (u, 0) : vers le point de fuite (dir) */
  const [dx, dy, dz] = dir;
  let ex, ey;
  if (Math.abs(dz) < 1e-9) { ex = dx; ey = dy; }
  else { ex = dx / dz - u; ey = dy / dz; }
  if (ey < 0) { ex = -ex; ey = -ey; }
  const expected = Math.atan2(ex, ey), got = Math.atan(l.t);
  return Math.abs(expected - got) * 180 / Math.PI;
}

/* ---------- 3. redresser ---------- */

/** matrice 3×3 qui « tourne » l'appareil pour que la verticale du monde soit verticale sur la photo */
export function straighteningMatrix(dir, w, h, f = focalPx(w, h)) {
  const n = Math.hypot(...dir);
  const a = dir.map(v => v / n), b = [0, 1, 0];
  /* rotation de a vers b (formule de Rodrigues) */
  const k = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const s = Math.hypot(...k), c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  let R = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  if (s > 1e-9) {
    const [x, y, z] = k.map(v => v / s);
    const K = [[0, -z, y], [z, 0, -x], [-y, x, 0]];
    const K2 = mul(K, K);
    R = R.map((row, i) => row.map((v, j) => v + s * K[i][j] + (1 - c) * K2[i][j]));
  }
  const Kc = [[f, 0, w / 2], [0, f, h / 2], [0, 0, 1]];
  const Ki = [[1 / f, 0, -w / (2 * f)], [0, 1 / f, -h / (2 * f)], [0, 0, 1]];
  return mul(Kc, mul(R, Ki));
}

function mul(A, B) {
  return A.map((row, i) => B[0].map((_, j) => row.reduce((t, _, k) => t + A[i][k] * B[k][j], 0)));
}

export function applyH(H, x, y) {
  const d = H[2][0] * x + H[2][1] * y + H[2][2];
  return { x: (H[0][0] * x + H[0][1] * y + H[0][2]) / d, y: (H[1][0] * x + H[1][1] * y + H[1][2]) / d };
}

export function invert3(m) {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]
  ];
}

/**
 * Photo redressée (même taille maximale, fond noir autour) et cadre de la vraie photo.
 * @returns {{canvas, frame, H}} H : de la photo d'origine vers la photo redressée
 */
export function straighten(canvas, dir, f = focalPx(canvas.width, canvas.height)) {
  const w = canvas.width, h = canvas.height;
  const H0 = straighteningMatrix(dir, w, h, f);
  /* où tombent les coins : on recadre pour tout garder, à la même échelle globale */
  const corners = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => applyH(H0, x, y));
  const minX = Math.min(...corners.map(p => p.x)), maxX = Math.max(...corners.map(p => p.x));
  const minY = Math.min(...corners.map(p => p.y)), maxY = Math.max(...corners.map(p => p.y));
  const s = Math.min(1, Math.max(w, h) / Math.max(maxX - minX, maxY - minY));
  const T = [[s, 0, -minX * s], [0, s, -minY * s], [0, 0, 1]];
  const H = mul(T, H0);
  const W2 = Math.round((maxX - minX) * s), H2 = Math.round((maxY - minY) * s);
  const out = document.createElement("canvas"); out.width = W2; out.height = H2;
  const src = canvas.getContext("2d", { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const og = out.getContext("2d");
  const img = og.createImageData(W2, H2);
  const dst = img.data;
  const Hi = invert3(H);
  for (let y = 0; y < H2; y++) {
    /* le dénominateur varie linéairement : calcul incrémental le long de la ligne */
    let X = Hi[0][1] * y + Hi[0][2], Y = Hi[1][1] * y + Hi[1][2], Z = Hi[2][1] * y + Hi[2][2];
    for (let x = 0; x < W2; x++, X += Hi[0][0], Y += Hi[1][0], Z += Hi[2][0]) {
      const sx = X / Z, sy = Y / Z;
      const o = (y * W2 + x) * 4;
      if (sx < 0 || sy < 0 || sx > w - 1 || sy > h - 1) { dst[o + 3] = 255; continue; }
      const x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
      const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
      const i00 = (y0 * w + x0) * 4, i10 = (y0 * w + x1) * 4, i01 = (y1 * w + x0) * 4, i11 = (y1 * w + x1) * 4;
      for (let ch = 0; ch < 3; ch++) {
        dst[o + ch] = (src[i00 + ch] * (1 - fx) + src[i10 + ch] * fx) * (1 - fy) + (src[i01 + ch] * (1 - fx) + src[i11 + ch] * fx) * fy;
      }
      dst[o + 3] = 255;
    }
  }
  og.putImageData(img, 0, 0);
  /* cadre : le plus grand rectangle à l'intérieur de la photo redressée (pour le contrôle « bord ») */
  const c2 = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => applyH(H, x, y));
  const frame = {
    x0: Math.max(c2[0].x, c2[3].x), x1: Math.min(c2[1].x, c2[2].x),
    y0: Math.max(c2[0].y, c2[1].y), y1: Math.min(c2[2].y, c2[3].y)
  };
  return { canvas: out, frame, H };
}
