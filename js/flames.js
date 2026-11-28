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

/** Fin du jour du recalcul des doublons : la dette d'avant est effacée (voir flameWallet) */
export const DEBT_CUTOFF = new Date(2026, 10, 23, 0, 0, 0).getTime();

/** Ce que rend un doublon de la Roue des cadeaux : le prix d'un tour (js/gift-wheel.js SPIN_PRICE) */
export const DUP_REFUND = 70;

/**
 * Le portefeuille : gagné, dépensé, réserve, et où en est le bonus.
 * purchases : [{ id, price }] (ce qui a été débloqué ; un gain de la Roue des cadeaux porte gift.ps,
 *   compté comme gagné : réserve et niveau) ; sessionLogs : séances enregistrées.
 * Un doublon de la roue (gift.dup : costume ou teinture déjà à soi) ne rapporte rien :
 *   il rend seulement le prix d'un tour (DUP_REFUND), dans la limite des tours achetés,
 *   sans compter comme gagné (pas d'expérience). Les anciens doublons sont recomptés pareil.
 */
export function flameWallet(weightLog, purchases = [], now = new Date(), sessionLogs = []) {
  const days = flameDays(weightLog);
  const weighEarned = days.reduce((sum, day) => sum + day.gain, 0);
  const trained = sessionDays(sessionLogs);
  const weighed = new Set(days.map(day => day.key));
  const perfect = [...trained].filter(key => weighed.has(key)).length;
  const sessionEarned = trained.size * SESSION_GAIN + perfect * PERFECT_BONUS;
  const list = purchases || [];
  const giftEarned = list.reduce((sum, item) => sum + (item?.gift?.dup ? 0 : Math.max(0, Number(item?.gift?.ps) || 0)), 0);
  // réglage d'un compte par un code cadeau réservé (js/gift-wheel.js) : écarts d'expérience et de dépense
  const adjusts = list.filter(item => String(item?.id).startsWith("code:") && item.adjust);
  const adjustEarned = adjusts.reduce((sum, item) => sum + (Number(item.adjust.earned) || 0), 0);
  const adjustSpent = adjusts.reduce((sum, item) => sum + (Number(item.adjust.spent) || 0), 0);
  const earned = Math.max(0, weighEarned + sessionEarned + giftEarned + adjustEarned);
  // doublon noté depuis la saison 2 : gift.refund (prix du tour s'il était acheté, 0 s'il était offert)
  const newRefund = list.reduce((sum, item) => sum + (item?.gift?.dup && item.gift.refund != null ? Math.min(DUP_REFUND, Math.max(0, Number(item.gift.refund) || 0)) : 0), 0);
  // anciens doublons (avant le correctif) : 70 chacun, dans la limite des tours achetés AVANT eux
  const oldDups = list.filter(item => item?.gift?.dup && item.gift.refund == null);
  const lastOld = oldDups.reduce((m, item) => Math.max(m, Number(item?.at) || 0), 0);
  const paidBefore = list.filter(item => String(item?.id).startsWith("spin:") && (Number(item?.at) || 0) <= lastOld)
    .reduce((sum, item) => sum + Math.max(0, Number(item?.price) || 0), 0);
  const refunded = newRefund + Math.min(paidBefore, oldDups.length * DUP_REFUND);
  // Dette effacée : le recalcul des doublons (22 novembre 2026) a fait passer certains comptes sous ce qu'ils
  // avaient déjà dépensé ; sans ça, les nouveaux points rempliraient d'abord ce trou et la réserve resterait à 0.
  const before = item => (Number(item?.at) || 0) < DEBT_CUTOFF;
  const cutKey = localKey(DEBT_CUTOFF);
  const days0 = days.filter(day => day.key < cutKey);
  const weighed0 = new Set(days0.map(day => day.key));
  const trained0 = [...trained].filter(key => key < cutKey);
  const earned0 = days0.reduce((sum, day) => sum + day.gain, 0)
    + trained0.length * SESSION_GAIN + trained0.filter(key => weighed0.has(key)).length * PERFECT_BONUS
    + list.filter(before).reduce((sum, item) => sum + (item?.gift?.dup ? 0 : Math.max(0, Number(item?.gift?.ps) || 0)), 0)
    + adjusts.filter(before).reduce((sum, item) => sum + (Number(item.adjust.earned) || 0), 0);
  const refunded0 = list.filter(item => before(item) && item?.gift?.dup && item.gift.refund != null)
    .reduce((sum, item) => sum + Math.min(DUP_REFUND, Math.max(0, Number(item.gift.refund) || 0)), 0)
    + Math.min(paidBefore, oldDups.length * DUP_REFUND);
  const spent0 = list.filter(before).reduce((sum, item) => sum + (Number(item?.price) || 0), 0) - refunded0
    + adjusts.filter(before).reduce((sum, item) => sum + (Number(item.adjust.spent) || 0), 0);
  const debt = Math.max(0, spent0 - Math.max(0, earned0));
  const spent = list.reduce((sum, item) => sum + (Number(item?.price) || 0), 0) - refunded + adjustSpent - debt;
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
    giftEarned,
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
