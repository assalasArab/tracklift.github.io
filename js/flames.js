/* ═══════════════════════════════════════════════════════════
   Points spé (la monnaie de la boutique et l'expérience du personnage).
   - Chaque jour où tu te pèses rapporte 10 points spé,
     multipliés par le bonus de ta série (plus tu enchaînes, plus il monte).
   - Chaque jour avec une séance (au moins 3 séries faites) : +15.
   - Pesée et séance le même jour : +5 en plus.
   - La réserve ne se perd jamais : une série cassée remet seulement
     le bonus à ×1 ; les nouveaux points s'ajoutent aux anciens.
   - Tout est recalculé depuis l'historique (un jour = une fois),
     moins ce qui a été dépensé : aucun compteur ne peut dériver.
   - Le total gagné (sans retirer les dépenses) donne le niveau (js/rpg.js).
   ═══════════════════════════════════════════════════════════ */
export const FLAME_BASE = 10;
export const SESSION_GAIN = 15;
export const PERFECT_BONUS = 5;
const MIN_SETS = 3;

/** Bonus selon le nombre de jours d'affilée (mêmes paliers que la flamme) */
export const BONUS_TIERS = [
  { from: 1, mult: 1 },
  { from: 3, mult: 1.5 },
  { from: 7, mult: 2 },
  { from: 14, mult: 3 },
  { from: 30, mult: 4 },
  { from: 50, mult: 5 },
  { from: 100, mult: 6 }
];

export const bonusFor = run => BONUS_TIERS.filter(tier => run >= tier.from).pop()?.mult || 1;
export const nextTier = run => BONUS_TIERS.find(tier => tier.from > run) || null;
export const gainFor = run => Math.round(FLAME_BASE * bonusFor(Math.max(1, run)));

function localKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const dayNumber = key => { const [y, m, d] = key.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };

/** Chaque jour pesé, dans l'ordre : son rang dans la série, son bonus, ses flammes */
export function flameDays(weightLog) {
  const keys = [...new Set((weightLog || []).filter(item => Number(item?.weight)).map(item => localKey(item.date)))].sort();
  let run = 0;
  let previous = null;
  return keys.map(key => {
    const n = dayNumber(key);
    run = previous !== null && n - previous === 1 ? run + 1 : 1;
    previous = n;
    return { key, run, mult: bonusFor(run), gain: gainFor(run) };
  });
}

/** Jours (heure locale) avec une séance qui compte : au moins 3 séries faites */
export function sessionDays(sessionLogs) {
  const keys = new Set();
  for (const log of sessionLogs || []) {
    if (!Number.isFinite(Number(log?.date))) continue;
    const done = (log.exercises || []).reduce((n, ex) => n + (ex.sets || []).filter(set => set?.status === "done").length, 0);
    if (done >= MIN_SETS) keys.add(localKey(Number(log.date)));
  }
  return keys;
}

/**
 * Le portefeuille : gagné, dépensé, réserve, et où en est le bonus.
 * purchases : [{ id, price }] (ce qui a été débloqué) ; sessionLogs : séances enregistrées
 */
export function flameWallet(weightLog, purchases = [], now = new Date(), sessionLogs = []) {
  const days = flameDays(weightLog);
  const weighEarned = days.reduce((sum, day) => sum + day.gain, 0);
  const trained = sessionDays(sessionLogs);
  const weighed = new Set(days.map(day => day.key));
  const perfect = [...trained].filter(key => weighed.has(key)).length;
  const sessionEarned = trained.size * SESSION_GAIN + perfect * PERFECT_BONUS;
  const earned = weighEarned + sessionEarned;
  const spent = (purchases || []).reduce((sum, item) => sum + (Number(item?.price) || 0), 0);
  const today = localKey(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localKey(yesterdayDate);
  const last = days[days.length - 1] || null;
  const doneToday = last?.key === today;
  const alive = !!last && (doneToday || last.key === yesterday);
  const run = alive ? last.run : 0;
  // la prochaine pesée : aujourd'hui si pas encore faite, sinon demain
  const nextRun = alive ? run + 1 : 1;
  return {
    earned,
    weighEarned,
    sessionEarned,
    trainedToday: trained.has(today),
    spent,
    balance: Math.max(0, earned - spent),
    run,
    doneToday,
    mult: run ? bonusFor(run) : 1,
    todayGain: doneToday ? last.gain : 0,
    nextGain: gainFor(nextRun),
    nextMult: bonusFor(nextRun),
    nextTier: nextTier(Math.max(run, 1))
  };
}
