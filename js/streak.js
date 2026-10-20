/* ═══════════════════════════════════════════════════════════
   Flamme de pesée : nombre de jours d'affilée avec un poids saisi.
   La série reste vivante jusqu'à minuit du jour suivant la dernière pesée.
   ═══════════════════════════════════════════════════════════ */

export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];

function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function shiftDay(date, offset) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

/**
 * weightLog: [{ date, weight }] trié ou non.
 * { current, best, doneToday, atRisk, todayEntry, previousEntry, week: [{ date, done, isToday }], next }
 */
export function computeStreak(weightLog, now = new Date()) {
  const sorted = [...(weightLog || [])].sort((a, b) => a.date - b.date);
  const days = new Set(sorted.map(item => dayKey(item.date)));
  const doneToday = days.has(dayKey(now));

  let current = 0;
  let cursor = doneToday ? shiftDay(now, 0) : shiftDay(now, -1);
  while (days.has(dayKey(cursor))) {
    current++;
    cursor = shiftDay(cursor, -1);
  }

  let best = 0, run = 0, prev = null;
  [...new Set(sorted.map(item => dayKey(item.date)))].forEach(key => {
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m, d, 12);
    run = prev && dayKey(shiftDay(prev, 1)) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  });

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDay(now, i - 6);
    return { date, done: days.has(dayKey(date)), isToday: i === 6 };
  });

  const todayEntry = doneToday ? sorted.filter(item => dayKey(item.date) === dayKey(now)).pop() : null;
  const previousEntry = [...sorted].reverse().find(item => dayKey(item.date) !== dayKey(now)) || null;
  const next = STREAK_MILESTONES.find(m => m > current) || null;

  return { current, best, doneToday, atRisk: !doneToday && current > 0, todayEntry, previousEntry, week, next };
}
