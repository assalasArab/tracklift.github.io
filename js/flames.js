/* ═══════════════════════════════════════════════════════════
   Réserve de flammes (la monnaie de la boutique).
   - Chaque jour où tu te pèses rapporte 10 flammes,
     multipliées par le bonus de ta série (plus tu enchaînes, plus il monte).
   - La réserve ne se perd jamais : une série cassée remet seulement
     le bonus à ×1 ; les nouvelles flammes s'ajoutent aux anciennes.
   - Tout est recalculé depuis l'historique des pesées (un jour = une fois),
     moins ce qui a été dépensé : aucun compteur ne peut dériver.
   ═══════════════════════════════════════════════════════════ */
export const FLAME_BASE = 10;

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

/**
 * Le portefeuille : gagné, dépensé, réserve, et où en est le bonus.
 * purchases : [{ id, price }] (ce qui a été débloqué)
 */
export function flameWallet(weightLog, purchases = [], now = new Date()) {
  const days = flameDays(weightLog);
  const earned = days.reduce((sum, day) => sum + day.gain, 0);
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
