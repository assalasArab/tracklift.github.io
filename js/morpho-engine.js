/* ═══════════════════════════════════════════════════════════
   Scan morpho — moteur de mesure + règles d'exercices (v2).

   1. Mesure : points du corps MediaPipe + masque de silhouette,
      mis à l'échelle avec la taille déclarée.
   2. Conversion : les points MediaPipe ne tombent pas exactement sur
      les repères anatomiques. Les longueurs sont corrigées avec un
      biais mesuré sur un banc de test (corps 3D MakeHuman aux
      proportions connues), puis converties vers les repères du
      référentiel ANSUR II.
   3. Comparaison : position dans la population réelle (ANSUR II,
      4 082 hommes / 1 986 femmes) avec un niveau de fiabilité qui
      tient compte de l'erreur de mesure.
   Tout est calculé sur l'appareil : aucune photo n'est envoyée.
   Les avertissements sont des codes (« partial », « legs »…) traduits
   par morpho-text.js.
   ═══════════════════════════════════════════════════════════ */

/* indices MediaPipe Pose (33 points) */
export const LM = {
  nose: 0, lEar: 7, rEar: 8, lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28, lHeel: 29, rHeel: 30, lFoot: 31, rFoot: 32
};

/* ---------- population de référence ----------
   ANSUR II (2012, armée américaine). Rapports entre repères anatomiques :
   fémur = trochanter → épicondyle fémoral latéral ; tibia = épicondyle → malléole ;
   tronc = acromion → trochanter ; bras = acromion → radiale ; avant-bras = radiale → stylion ;
   carrure = largeur bideltoïdienne / largeur de hanches ; envergure / taille.
   q = percentiles 5, 10, 25, 50, 75, 90, 95. */
export const POP = {
  male: {
    femurTrunk: { mean: 0.7614, sd: 0.0744, q: [0.6529, 0.6728, 0.711, 0.7537, 0.8055, 0.861, 0.894] },
    tibiaFemur: { mean: 1.0257, sd: 0.0608, q: [0.9305, 0.9503, 0.9843, 1.0224, 1.0639, 1.1039, 1.1298] },
    armH: { mean: 0.3434, sd: 0.0101, q: [0.3276, 0.3309, 0.3366, 0.3429, 0.3497, 0.3568, 0.3612] },
    forearmHumerus: { mean: 0.7995, sd: 0.0331, q: [0.7472, 0.7585, 0.7771, 0.7983, 0.8205, 0.8421, 0.8567] },
    spanH: { mean: 1.033, sd: 0.0274, q: [0.9912, 0.9994, 1.0144, 1.0311, 1.0503, 1.0697, 1.0807] },
    shoulderHip: { mean: 1.4787, sd: 0.0722, q: [1.3655, 1.3896, 1.4299, 1.4777, 1.5248, 1.5696, 1.5994] },
    trunkH: { mean: 0.3074, sd: 0.0155, q: [0.2802, 0.2872, 0.2976, 0.3081, 0.318, 0.3264, 0.3316] },
    proxy: {
      femurTrunk: { a: 0.2618, b: 0.8362, res: 0.0599, xMean: 0.5974, xSd: 0.0528 },
      tibiaFemur: { a: 0.3582, b: 0.5634, res: 0.0479, xMean: 1.1847, xSd: 0.0665 },
      trunkH: { a: 0.0441, b: 0.7772, res: 0.0105, xMean: 0.3387, xSd: 0.0148 }
    }
  },
  female: {
    femurTrunk: { mean: 0.7773, sd: 0.066, q: [0.6755, 0.6975, 0.7324, 0.7736, 0.8162, 0.8632, 0.8893] },
    tibiaFemur: { mean: 1.0648, sd: 0.0684, q: [0.95, 0.9728, 1.0169, 1.0678, 1.1135, 1.1511, 1.1715] },
    armH: { mean: 0.3392, sd: 0.0108, q: [0.3227, 0.3258, 0.3316, 0.3387, 0.3462, 0.3535, 0.3587] },
    forearmHumerus: { mean: 0.776, sd: 0.0367, q: [0.7164, 0.7292, 0.7508, 0.776, 0.8, 0.8226, 0.8365] },
    spanH: { mean: 1.0195, sd: 0.0292, q: [0.9752, 0.9831, 0.999, 1.018, 1.0378, 1.0582, 1.0719] },
    shoulderHip: { mean: 1.2757, sd: 0.0713, q: [1.1621, 1.1878, 1.2292, 1.2745, 1.3201, 1.3674, 1.395] },
    trunkH: { mean: 0.3008, sd: 0.0142, q: [0.2776, 0.2821, 0.2916, 0.3011, 0.3103, 0.3186, 0.3233] },
    proxy: {
      femurTrunk: { a: 0.3372, b: 0.7668, res: 0.0533, xMean: 0.5739, xSd: 0.0509 },
      tibiaFemur: { a: 0.3107, b: 0.5901, res: 0.0472, xMean: 1.2779, xSd: 0.0839 },
      trunkH: { a: 0.0543, b: 0.726, res: 0.0092, xMean: 0.3395, xSd: 0.0149 }
    }
  }
};

/* Ce que la photo voit vraiment, ce sont l'entrejambe, les genoux, les chevilles et les épaules.
   Dans ANSUR II, on a calculé la régression entre ces repères visibles et les vrais rapports
   osseux (proxy ci-dessus, par sexe) :
     fémur/tronc ← (entrejambe − genou) / (acromion − entrejambe)   r = 0,59
     tibia/fémur ← (genou − malléole) / (entrejambe − genou)         r = 0,62 (H) / 0,72 (F)
     tronc/taille ← (acromion − entrejambe) / taille                 r = 0,74 / 0,76
   « res » est l'erreur qui reste même avec des mesures parfaites : c'est la limite d'une photo. */

/* ---------- calibrage ----------
   Valeurs issues du banc de test (42 corps MakeHuman aux proportions connues, rendus comme
   des photos de téléphone, 750 analyses) et de la littérature :
   anat   : décalages entre les points mesurés et les repères anatomiques d'ANSUR ;
   atten  : à quel point le modèle « tasse » les vraies différences entre personnes ;
   noise  : erreur aléatoire (banc) + incertitude sur les décalages (systématique).
   À recaler avec quelques mesures au mètre ruban sur de vraies personnes. */
export const CALIB = {
  /* décalages (cm, pour 175 cm) entre points mesurés et repères ANSUR */
  anat: {
    humerus: 2.0, forearm: -0.3,              // étude Akina 2025 sur 11 personnes (bras −6 %, avant-bras +1 %)
    hipAboveTroch: 3.2,                       // banc + Akina : hanche MediaPipe ~3 cm au-dessus du trochanter
    trochAboveCrotch: { male: 5.5, female: 6.3 }, // ANSUR II (trochanter − entrejambe)
    crotchMaskBelow: 1.0,                     // le haut de l'espace entre les jambes apparaît un peu sous l'entrejambe (banc : 0,4 cm, collant)
    kneeAboveLFE: 1.0, ankleAboveMalleolus: 2.8, acromionAboveShoulder: 2.0
  },
  spanFix: 0.978,        // banc (moteur final) : envergure/taille mesurée +2,2 % au-dessus de la vraie, à 2,4 comme à 2,9 m
  shoulderHip: 1,
  /* Pente mesuré/vrai sur le banc (le modèle tasse les écarts vers la moyenne) :
     on divise l'écart mesuré par cette pente pour retrouver l'écart réel. */
  atten: { femurTrunk: 0.92, tibiaFemur: 0.51, trunkH: 0.87, armH: 0.96, forearmHumerus: 0.24, spanH: 0.92, shoulderHip: 1,
           femurTrunkNoCrotch: 0.23, tibiaFemurNoCrotch: 0.45, trunkHNoCrotch: 0.53 },
  /* Bruit relatif (%) mesuré sur le banc avec le modèle heavy, après correction de la pente :
     part propre à la personne + part qui diminue avec le nombre de photos.
     Pour fémur/tronc, tibia/fémur et tronc/taille, il s'agit du bruit sur les repères visibles. */
  noise: {
    persistent: { femurTrunk: 2.8, tibiaFemur: 2.5, trunkH: 1.7, armH: 1.35, forearmHumerus: 11.6, spanH: 0.55, shoulderHip: 3,
                  femurTrunkNoCrotch: 22, tibiaFemurNoCrotch: 10, trunkHNoCrotch: 4.3 },
    perPhoto: { femurTrunk: 2.0, tibiaFemur: 3.5, trunkH: 1.1, armH: 0.65, forearmHumerus: 6.1, spanH: 0.4, shoulderHip: 3,
                femurTrunkNoCrotch: 8, tibiaFemurNoCrotch: 6, trunkHNoCrotch: 2 },
    realWorld: 1.5,       // marge pour une vraie photo (vêtements, pose, lumière) par rapport au banc
    /* incertitude sur les décalages anatomiques (entrejambe ±1 cm, genou ±1 cm, acromion ±1 cm,
       cheville ±0,8 cm, bras et avant-bras ±1 cm), propagée à chaque rapport */
    systematic: { femurTrunk: 5.6, tibiaFemur: 6.3, trunkH: 2.6, armH: 2.6, forearmHumerus: 4.8, spanH: 1.4, shoulderHip: 4,
                  femurTrunkNoCrotch: 6.5, tibiaFemurNoCrotch: 5.4, trunkHNoCrotch: 2.8 }
  }
};

const px = (p, w, h) => ({ x: p.x * w, y: p.y * h });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function angle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y));
  return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
}

/* Haut du crâne et bas des pieds à partir du masque de silhouette,
   dans la bande de colonnes autour du corps (pour ignorer le décor). */
function silhouetteBounds(mask, colMin, colMax, rowFrom) {
  const { data, width: mw, height: mh } = mask;
  const c0 = Math.max(0, Math.floor(colMin)), c1 = Math.min(mw - 1, Math.ceil(colMax));
  let top = -1, bottom = -1;
  for (let y = 0; y < mh && top < 0; y++) {
    let hits = 0;
    for (let x = c0; x <= c1; x++) if (data[y * mw + x] > 0.5) hits++;
    if (hits >= 2) top = y;
  }
  for (let y = mh - 1; y >= rowFrom && bottom < 0; y--) {
    let hits = 0;
    for (let x = c0; x <= c1; x++) if (data[y * mw + x] > 0.5) hits++;
    if (hits >= 2) bottom = y;
  }
  return { top, bottom };
}

/* largeur de silhouette sur une ligne, en partant du centre */
function silhouetteWidth(mask, row, cx, maxHalf) {
  const { data, width: mw, height: mh } = mask;
  const y = Math.max(0, Math.min(mh - 1, Math.round(row)));
  let left = Math.round(cx), right = Math.round(cx);
  while (left > 0 && cx - left < maxHalf && data[y * mw + left - 1] > 0.5) left--;
  while (right < mw - 1 && right - cx < maxHalf && data[y * mw + right + 1] > 0.5) right++;
  return right - left;
}

/* Entrejambe : point le plus haut de l'espace entre les jambes, lu sur la silhouette.
   On remonte depuis les genoux le long de l'axe du corps tant qu'il reste du fond
   entre les deux jambes. Renvoie null si les jambes se touchent. */
function crotchFromMask(mask, p, w, h) {
  if (!mask) return null;
  const { data, width: mw, height: mh } = mask;
  const sx = mw / w, sy = mh / h;
  const kneeMid = mid(p.lKnee, p.rKnee), hipMid = mid(p.lHip, p.rHip);
  const kneeGap = Math.abs(p.lKnee.x - p.rKnee.x);
  const y0 = Math.round(kneeMid.y * sy), y1 = Math.max(0, Math.round((hipMid.y - (kneeMid.y - hipMid.y) * 0.2) * sy));
  let top = null;
  for (let y = y0; y >= y1; y--) {
    const t = (kneeMid.y - y / sy) / Math.max(1, kneeMid.y - hipMid.y);
    const cx = (kneeMid.x + (hipMid.x - kneeMid.x) * Math.min(1, Math.max(0, t))) * sx;
    const half = Math.max(2, kneeGap * 0.2 * sx);
    let gap = false;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      if (x >= 0 && x < mw && data[y * mw + x] < 0.5) { gap = true; break; }
    }
    if (gap) top = y;
    else if (top !== null) break;
    else if (y < y0 - 3) return null;       // pas d'espace entre les genoux
  }
  return top === null ? null : top / sy;
}

function sideAverage(pairs) {
  const ok = pairs.filter(p => p.vis >= 0.5);
  const use = ok.length ? ok : pairs;
  return use.reduce((s, p) => s + p.len, 0) / use.length;
}

function readPoints(landmarks, w, h) {
  return Object.fromEntries(Object.entries(LM).map(([k, i]) => [k, { ...px(landmarks[i], w, h), vis: landmarks[i].visibility ?? 1 }]));
}

/* Taille en pixels, dans le plan du corps.
   Le bas de la silhouette (orteils) est plus proche de l'objectif que le reste du corps :
   vu d'un téléphone à hauteur de hanches, il apparaît plusieurs cm trop bas (+5 à +9 %
   sur la taille selon la distance, mesuré sur le banc). On mesure donc du sommet du crâne
   aux chevilles (dans le plan du corps), puis on ajoute la hauteur de cheville
   (malléole à 4,15 % de la taille chez l'homme, 3,85 % chez la femme, ANSUR II ;
   point de cheville MediaPipe ~2,8 cm au-dessus). Si les cheveux dépassent nettement
   (sommet du crâne ~13 cm au-dessus de l'oreille), on recale le sommet sur les oreilles. */
const ANKLE_RATIO = { male: 0.0415 + 2.8 / 175, female: 0.0385 + 2.8 / 175 };
const TRAGION_TOP = { male: 13.1, female: 12.6 };   // cm, ANSUR II
const STATURE_FIX = 1.012;                          // biais résiduel moyen du banc (2 à 3,3 m)

function stature(p, mask, w, h, sex = "male", heightCm = 175) {
  const footY = Math.max(p.lHeel.y, p.rHeel.y, p.lFoot.y, p.rFoot.y, p.lAnkle.y, p.rAnkle.y);
  const shoulderW = dist(p.lShoulder, p.rShoulder);
  let topY = null, maskBottom = null;
  if (mask) {
    const sx = mask.width / w, sy = mask.height / h;
    const xs = [p.nose.x, p.lShoulder.x, p.rShoulder.x, p.lHip.x, p.rHip.x, p.lAnkle.x, p.rAnkle.x, p.lFoot.x, p.rFoot.x, p.lHeel.x, p.rHeel.x];
    const colMin = (Math.min(...xs) - shoulderW * 0.25) * sx;
    const colMax = (Math.max(...xs) + shoulderW * 0.25) * sx;
    const b = silhouetteBounds(mask, colMin, colMax, Math.floor(p.nose.y * sy));
    if (b.top >= 0 && b.top / sy < p.nose.y) topY = b.top / sy;
    if (b.bottom >= 0 && (b.bottom + 1) / sy >= footY - shoulderW * 0.3) maskBottom = (b.bottom + 1) / sy;
  }
  let source = "silhouette";
  if (topY == null) {
    const shoulderMid = mid(p.lShoulder, p.rShoulder);
    topY = p.nose.y - (shoulderMid.y - p.nose.y) * 0.9;
    source = "points";
  }
  const ankles = [p.lAnkle, p.rAnkle].filter(a => a.vis >= 0.5);
  const ankleY = (ankles.length ? ankles : [p.lAnkle, p.rAnkle]).reduce((t, a) => t + a.y, 0) / (ankles.length || 2);
  const ra = ANKLE_RATIO[sex] ?? ANKLE_RATIO.male;
  let S = (ankleY - topY) / (1 - ra) / STATURE_FIX;
  /* cheveux : sommet de la silhouette nettement au-dessus du crâne estimé par les oreilles */
  let hair = 0;
  const ears = [p.lEar, p.rEar].filter(e => e.vis >= 0.5);
  if (ears.length && source === "silhouette") {
    const earY = ears.reduce((t, e) => t + e.y, 0) / ears.length;
    for (let i = 0; i < 2; i++) {
      const pxPerCm = S / heightCm;
      const skullTop = earY - (TRAGION_TOP[sex] ?? 13.1) * (heightCm / 175) * pxPerCm;
      hair = (skullTop - topY) / pxPerCm;
      if (hair > 2.5) { topY = skullTop; S = (ankleY - topY) / (1 - ra) / STATURE_FIX; } else break;
    }
  }
  return { topY, bottomY: topY + S, source, maskBottom, hair, ankleY };
}

/**
 * Photo de face, bras tendus écartés (pose A).
 * @param {Array} landmarks 33 points normalisés {x, y, visibility}
 * @param {{data: Float32Array, width: number, height: number}|null} mask
 */
export function measureBody(landmarks, mask, w, h, heightCm, sex = "male") {
  const p = readPoints(landmarks, w, h);
  const warnings = [];
  const flags = {};

  const needed = ["lShoulder", "rShoulder", "lHip", "rHip", "lKnee", "rKnee", "lAnkle", "rAnkle"];
  if (needed.some(k => p[k].vis < 0.3)) { warnings.push("partial"); flags.partial = true; }

  const st = stature(p, mask, w, h, sex, heightCm);
  if (st.source !== "silhouette") { warnings.push("scale"); flags.scale = true; }
  if (st.hair > 2.5) warnings.push("hair");
  const staturePx = st.bottomY - st.topY;
  const cmPerPx = heightCm / staturePx;
  if (st.topY < h * 0.01 || (st.maskBottom ?? st.bottomY) > h * 0.995) { warnings.push("edge"); flags.scale = true; }
  if (staturePx < 500) { warnings.push("small"); flags.small = true; }

  /* posture */
  const kneeAngle = Math.min(angle(p.lHip, p.lKnee, p.lAnkle), angle(p.rHip, p.rKnee, p.rAnkle));
  const elbowAngle = Math.min(angle(p.lShoulder, p.lElbow, p.lWrist), angle(p.rShoulder, p.rElbow, p.rWrist));
  const hipMid = mid(p.lHip, p.rHip), shMid = mid(p.lShoulder, p.rShoulder);
  if (kneeAngle < 165) { warnings.push("legs"); flags.legs = true; }
  if (elbowAngle < 160) { warnings.push("arms"); flags.arms = true; }
  /* de face : écart de profondeur entre les deux épaules (coordonnée z de MediaPipe) */
  const twist = Math.abs((landmarks[LM.lShoulder].z ?? 0) - (landmarks[LM.rShoulder].z ?? 0)) / Math.max(1e-6, dist(p.lShoulder, p.rShoulder) / w);
  if (twist > 0.6) { warnings.push("twist"); flags.twist = true; }

  const seg = (a, b) => ({ len: dist(p[a], p[b]), vis: Math.min(p[a].vis, p[b].vis) });
  const lenPx = {
    humerus: sideAverage([seg("lShoulder", "lElbow"), seg("rShoulder", "rElbow")]),
    forearm: sideAverage([seg("lElbow", "lWrist"), seg("rElbow", "rWrist")]),
    femur: sideAverage([seg("lHip", "lKnee"), seg("rHip", "rKnee")]),
    tibia: sideAverage([seg("lKnee", "lAnkle"), seg("rKnee", "rAnkle")]),
    trunk: dist(shMid, hipMid)
  };
  const raw = Object.fromEntries(Object.entries(lenPx).map(([k, v]) => [k, v * cmPerPx]));

  /* hauteurs au-dessus du sol (cm) : entrejambe, genoux, hanches, épaules */
  const floorY = st.bottomY;
  const hgt = y => (floorY - y) * cmPerPx;
  const crotchY = crotchFromMask(mask, p, w, h);
  const heights = {
    crotch: crotchY == null ? null : hgt(crotchY),
    knee: hgt((p.lKnee.y + p.rKnee.y) / 2),
    hip: hgt(hipMid.y),
    shoulder: hgt(shMid.y),
    ankle: hgt((p.lAnkle.y + p.rAnkle.y) / 2)
  };
  if (crotchY == null) { warnings.push("crotch"); flags.crotch = true; }
  else if (heights.crotch / heightCm < 0.40 || heights.crotch / heightCm > 0.56) {
    /* ANSUR II : entrejambe à 48 % de la taille (écart-type 1,5 %) : au-delà, c'est un vêtement ou la posture */
    heights.crotch = null; flags.crotch = true;
    warnings.push("crotchHidden");
  }
  /* inclinaison des jambes (pieds écartés) pour passer des hauteurs aux longueurs */
  const legCos = Math.cos(Math.atan2(Math.abs(p.lKnee.x - p.lHip.x) + Math.abs(p.rKnee.x - p.rHip.x), Math.abs(p.lKnee.y - p.lHip.y) + Math.abs(p.rKnee.y - p.rHip.y)));

  /* carrure : largeur de silhouette aux épaules et aux hanches (vêtements inclus) */
  let shoulderHip = null;
  if (mask) {
    const sx = mask.width / w, sy = mask.height / h;
    const shoulderW = dist(p.lShoulder, p.rShoulder);
    const sRow = (shMid.y + (hipMid.y - shMid.y) * 0.08) * sy;
    const sWidth = silhouetteWidth(mask, sRow, shMid.x * sx, shoulderW * 1.1 * sx);
    const hWidth = silhouetteWidth(mask, hipMid.y * sy, hipMid.x * sx, shoulderW * 1.1 * sx);
    if (hWidth > 0) shoulderHip = sWidth / hWidth;
  }

  return {
    kind: "A", points: p, raw, heights, legCos, crotchY, sex, cm: toAnatomical(raw, heightCm, heights, legCos, sex), cmPerPx, staturePx,
    topY: st.topY, bottomY: st.bottomY, statureSource: st.source,
    shoulderHip, quality: { kneeAngle, elbowAngle, twist }, flags, warnings, heightCm
  };
}

/**
 * Photo de face, bras tendus à l'horizontale (pose T) : envergure / taille,
 * mesurée directement sur la silhouette (bout des doigts → bout des doigts).
 */
export function measureSpan(landmarks, mask, w, h, heightCm, sex = "male") {
  const p = readPoints(landmarks, w, h);
  const warnings = [];
  if (!mask) return { kind: "T", ok: false, warnings: ["spanNoMask"] };
  const st = stature(p, mask, w, h, sex, heightCm);
  const sx = mask.width / w, sy = mask.height / h;
  const { data, width: mw, height: mh } = mask;
  /* bande horizontale autour des poignets et des épaules */
  const ys = [p.lWrist.y, p.rWrist.y, p.lShoulder.y, p.rShoulder.y];
  const shoulderW = dist(p.lShoulder, p.rShoulder);
  const r0 = Math.max(0, Math.floor((Math.min(...ys) - shoulderW * 0.35) * sy));
  const r1 = Math.min(mh - 1, Math.ceil((Math.max(...ys) + shoulderW * 0.35) * sy));
  let left = mw, right = -1;
  for (let y = r0; y <= r1; y++) {
    for (let x = 0; x < mw; x++) if (data[y * mw + x] > 0.5) { if (x < left) left = x; break; }
    for (let x = mw - 1; x >= 0; x--) if (data[y * mw + x] > 0.5) { if (x > right) right = x; break; }
  }
  /* correction mesurée sur le banc (CALIB.spanFix) */
  const spanPx = (right + 1 - left) / sx * CALIB.spanFix;
  const staturePx = st.bottomY - st.topY;
  const armTilt = Math.max(
    Math.abs(Math.atan2(p.lWrist.y - p.lShoulder.y, Math.abs(p.lWrist.x - p.lShoulder.x))),
    Math.abs(Math.atan2(p.rWrist.y - p.rShoulder.y, Math.abs(p.rWrist.x - p.rShoulder.x)))) * 180 / Math.PI;
  const elbowAngle = Math.min(angle(p.lShoulder, p.lElbow, p.lWrist), angle(p.rShoulder, p.rElbow, p.rWrist));
  if (left <= 1 || right >= mw - 2) warnings.push("spanHand");
  if (armTilt > 12) warnings.push("spanTilt");
  if (elbowAngle < 165) warnings.push("spanStraight");
  if (st.source !== "silhouette") warnings.push("spanTop");
  return {
    kind: "T", ok: st.source === "silhouette" && left > 1 && right < mw - 2,
    spanPx, staturePx, spanH: spanPx / staturePx, spanCm: spanPx / staturePx * heightCm,
    left: left / sx, right: (right + 1) / sx, rowY: (r0 + r1) / 2 / sy, topY: st.topY, bottomY: st.bottomY,
    points: p, armTilt, elbowAngle, warnings
  };
}

/* Points MediaPipe → repères anatomiques ANSUR (cm).
   Fémur et tronc se calculent avec des hauteurs au-dessus du sol, comme dans ANSUR :
   fémur = trochanter − genou, tronc = acromion − trochanter, tibia = genou − malléole.
   La hauteur du trochanter combine deux estimations : le point de hanche MediaPipe
   (placé en moyenne ~3 cm au-dessus du trochanter) et l'entrejambe lu sur la
   silhouette (le trochanter est 5,5 cm au-dessus chez l'homme, 6,3 cm chez la femme). */
export function toAnatomical(raw, heightCm, heights, legCos = 1, sex = "male") {
  const k = heightCm / 175;
  const A = CALIB.anat;
  const knee = heights.knee - A.kneeAboveLFE * k;            // épicondyle fémoral
  const ankle = heights.ankle - A.ankleAboveMalleolus * k;   // malléole
  const acromion = heights.shoulder + A.acromionAboveShoulder * k;
  const crotch = heights.crotch != null ? heights.crotch + A.crotchMaskBelow * k : null;
  /* trochanter : par l'entrejambe si elle est visible, sinon par le point de hanche MediaPipe */
  const troch = crotch != null
    ? crotch + (A.trochAboveCrotch[sex] ?? A.trochAboveCrotch.male) * k
    : heights.hip - A.hipAboveTroch * k;
  const out = {
    humerus: raw.humerus + A.humerus * k,
    forearm: raw.forearm + A.forearm * k,
    femur: (troch - knee) / legCos,
    tibia: (knee - ankle) / legCos,
    trunk: acromion - troch,
    troch, viaCrotch: crotch != null
  };
  if (crotch != null) {
    out.proxy = {
      femurTrunk: (crotch - knee) / (acromion - crotch),
      tibiaFemur: (knee - ankle) / (crotch - knee),
      trunkH: (acromion - crotch) / heightCm
    };
  }
  return out;
}

/* moyenne de plusieurs photos (pose A) */
export function combine(measures) {
  const list = measures.filter(Boolean);
  if (list.length === 1) return { ...list[0], n: 1 };
  const avg = key => {
    const out = {};
    for (const s of Object.keys(list[0][key])) {
      if (typeof list[0][key][s] === "number") out[s] = list.reduce((t, m) => t + m[key][s], 0) / list.length;
    }
    return out;
  };
  const sh = list.map(m => m.shoulderHip).filter(v => v != null);
  const flags = Object.assign({}, ...list.map(m => m.flags));
  const cm = avg("cm");
  cm.viaCrotch = list.every(m => m.cm.viaCrotch);
  if (cm.viaCrotch) {
    cm.proxy = {};
    for (const key of Object.keys(list[0].cm.proxy)) cm.proxy[key] = list.reduce((t, m) => t + m.cm.proxy[key], 0) / list.length;
  }
  return {
    ...list[0], raw: avg("raw"), cm, n: list.length, flags,
    shoulderHip: sh.length ? sh.reduce((a, b) => a + b, 0) / sh.length : null,
    warnings: [...new Set(list.flatMap(m => m.warnings))]
  };
}

/* ---------- comparaison à la population ---------- */

function erf(x) {
  /* Abramowitz & Stegun 7.1.26 */
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));

/* percentile d'une valeur dans la distribution réelle (interpolation des quantiles) */
export function percentileOf(value, pop) {
  const P = [5, 10, 25, 50, 75, 90, 95], q = pop.q;
  if (value <= q[0]) return Math.max(0.5, Phi((value - pop.mean) / pop.sd) * 100);
  if (value >= q[6]) return Math.min(99.5, Phi((value - pop.mean) / pop.sd) * 100);
  for (let i = 0; i < 6; i++) {
    if (value <= q[i + 1]) return P[i] + (P[i + 1] - P[i]) * (value - q[i]) / (q[i + 1] - q[i]);
  }
  return 50;
}

/* bruit relatif total d'un rapport (fraction), selon la qualité et le nombre de photos */
export function noiseFor(key, n, flags) {
  const N = CALIB.noise;
  const p = N.persistent[key] ?? 3, q = N.perPhoto[key] ?? 3, sys = N.systematic[key] ?? 3;
  const random = N.realWorld * Math.sqrt(p * p + (q * q) / Math.max(1, n));
  let total = Math.sqrt(random * random + sys * sys) / 100;
  if ((flags.arms && ["armH", "forearmHumerus"].includes(key)) ||
      (flags.legs && key.startsWith("femur")) || (flags.legs && key.startsWith("tibia")) || flags.twist || flags.partial) total *= 1.6;
  if (flags.scale && ["armH", "trunkH"].includes(key)) total *= 1.4;
  return total;
}

/* Verdict à partir de la position estimée (z) et de son incertitude (en écarts-types de
   population) : probabilité d'être dans le quart court, le milieu ou le quart long. */
function verdict(zPost, sdPost, pop, extra) {
  const zHigh = (pop.q[4] - pop.mean) / pop.sd, zLow = (pop.q[2] - pop.mean) / pop.sd;
  const pLong = 1 - Phi((zHigh - zPost) / sdPost);
  const pShort = Phi((zLow - zPost) / sdPost);
  const pMid = Math.max(0, 1 - pLong - pShort);
  const best = pLong >= pShort && pLong >= pMid ? "long" : pShort >= pMid ? "court" : "moyen";
  const conf = Math.max(pLong, pShort, pMid);
  const estimate = pop.mean + zPost * pop.sd;
  return {
    ...extra, estimate, zPost, sdPost,
    percentile: percentileOf(estimate, pop),
    pLong, pShort, pMid,
    level: conf >= 0.55 ? best : "moyen",
    confidence: conf,
    reliability: conf >= 0.75 ? "nette" : conf >= 0.55 ? "probable" : "faible"
  };
}

/* Mesure directe d'un rapport (bras, envergure, carrure) : on combine la mesure bruitée
   et la distribution de la population (estimation bayésienne). */
/* mesure manifestement faussée (posture, vêtements) : pas de verdict */
function invalid(pop, relNoise) {
  return { ...verdict(0, 1, pop, { relNoise }), level: "moyen", reliability: "faible", invalid: true, zPost: 0 };
}

export function assessRatio(value, pop, relNoise, atten = 1, broken = false) {
  const zMeas = (value - pop.mean) / pop.sd / atten;
  if (broken || Math.abs(zMeas) > 3.5) return invalid(pop, relNoise);
  const s = relNoise * value / pop.sd;                 // bruit exprimé en écarts-types de population
  const k = 1 / (1 + s * s);
  return verdict(zMeas * k, Math.sqrt(s * s * k), pop, { value, zMeas, relNoise });
}

/* Rapport osseux prédit depuis les repères visibles (régression ANSUR) :
   l'incertitude combine la limite de la régression et le bruit de mesure. */
export function assessProxy(x, reg, pop, relNoise, atten = 1) {
  const xEst = reg.xMean + (x - reg.xMean) / atten;
  if (reg.xSd && Math.abs(xEst - reg.xMean) / reg.xSd > 3.5) return invalid(pop, relNoise);
  const y = reg.a + reg.b * xEst;
  const sdY = Math.sqrt(reg.res * reg.res + (reg.b * relNoise * x) ** 2);
  return verdict((y - pop.mean) / pop.sd, sdY / pop.sd, pop, { value: y, proxy: x, relNoise: sdY / y });
}

export function classify(m, sex = "male", span = null) {
  const pop = POP[sex] || POP.male;
  const H = m.heightCm;
  const n = m.n || 1;
  const f = m.flags || {};
  const c = m.cm;
  const rate = (value, popKey, key, photos = n, flags = f, broken = false) =>
    assessRatio(value, pop[popKey], noiseFor(key, photos, flags), CALIB.atten[key] ?? 1, broken);
  const viaProxy = key => f.legs || f.partial
    ? invalid(pop[key], noiseFor(key, n, f))
    : assessProxy(c.proxy[key], pop.proxy[key], pop[key], noiseFor(key, n, f), CALIB.atten[key] ?? 1);
  const legsBroken = !!(f.legs || f.partial);
  const out = c.viaCrotch && c.proxy ? {
    femur: viaProxy("femurTrunk"),
    tibia: viaProxy("tibiaFemur"),
    trunk: viaProxy("trunkH")
  } : {
    femur: rate(c.femur / c.trunk, "femurTrunk", "femurTrunkNoCrotch", n, f, legsBroken),
    tibia: rate(c.tibia / c.femur, "tibiaFemur", "tibiaFemurNoCrotch", n, f, legsBroken),
    trunk: rate(c.trunk / H, "trunkH", "trunkHNoCrotch", n, f, !!f.partial)
  };
  /* bras pliés : les longueurs vues sur la photo sont raccourcies, pas de verdict */
  out.forearm = rate(c.forearm / c.humerus, "forearmHumerus", "forearmHumerus", n, f, !!f.arms);
  out.arm = span?.ok
    ? { ...rate(span.spanH, "spanH", "spanH", 1, {}, span.armTilt > 15 || span.elbowAngle < 155), source: "span" }
    : { ...rate((c.humerus + c.forearm) / H, "armH", "armH", n, f, !!f.arms), source: "segments" };
  if (m.shoulderHip != null) out.shoulders = rate(m.shoulderHip * CALIB.shoulderHip, "shoulderHip", "shoulderHip");
  return out;
}

/* ---------- zones cliquables ----------
   Chaque zone : les segments tracés sur la photo. Les textes (explications,
   exercices conseillés et leur raison) sont dans morpho-text.js, en français
   et en anglais. */
export const ZONES = {
  femur: { segments: [["lHip", "lKnee"], ["rHip", "rKnee"]] },
  tibia: { segments: [["lKnee", "lAnkle"], ["rKnee", "rAnkle"]] },
  trunk: { segments: [["lShoulder", "lHip"], ["rShoulder", "rHip"]] },
  arm: { segments: [["lShoulder", "lElbow"], ["rShoulder", "rElbow"]] },
  forearm: { segments: [["lElbow", "lWrist"], ["rElbow", "rWrist"]] },
  shoulders: { segments: [["lShoulder", "rShoulder"]] }
};

export const ZONE_ORDER = ["femur", "tibia", "trunk", "arm", "forearm", "shoulders"];
