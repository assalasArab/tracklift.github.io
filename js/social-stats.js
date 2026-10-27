/* ═══════════════════════════════════════════════════════════
   Partie Potes : calculs partagés (résumé, classement).
   Tout est calculé dans le navigateur de chacun : un tricheur pourrait
   gonfler ses chiffres. C'est accepté entre potes.
   Semaines du lundi au dimanche et mois à l'heure de Paris.
   ═══════════════════════════════════════════════════════════ */
import { computeStreak } from "./streak.js?v=20261027b";

const WEEKDAYS = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const PARIS = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", year: "numeric", month: "numeric", day: "numeric", weekday: "short" });

/** Jour à Paris : { y, m, d, wd (0 = lundi) } */
export function parisDay(ts) {
  const parts = Object.fromEntries(PARIS.formatToParts(new Date(ts)).map(p => [p.type, p.value]));
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day), wd: WEEKDAYS[parts.weekday] ?? 0 };
}
const iso = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
export function dayKey(ts) { const p = parisDay(ts); return iso(p.y, p.m, p.d); }
export function previousDayKey(ts) { const p = parisDay(ts); return iso(p.y, p.m, p.d - 1); }
/** lundi de la semaine, ex. « 2026-10-26 » */
export function weekKey(ts) { const p = parisDay(ts); return iso(p.y, p.m, p.d - p.wd); }
export function monthKey(ts) { const p = parisDay(ts); return `${p.y}-${String(p.m).padStart(2, "0")}`; }

/** Flamme encore vivante si la dernière pesée date d'aujourd'hui ou d'hier (Paris) */
export function streakAlive(streak, now = Date.now()) {
  if (!streak || !streak.lastDay) return 0;
  return streak.lastDay === dayKey(now) || streak.lastDay === previousDayKey(now) ? Number(streak.current) || 0 : 0;
}

const doneSets = ex => (ex?.sets || []).filter(set => set.status === "done");
export function countsAsSession(log) { return (log?.exercises || []).some(ex => doneSets(ex).length > 0); }

/**
 * Record battu ? Même règle que le récap de fin de séance :
 * meilleure charge du jour > toutes les charges faites avant sur cet exercice,
 * et la série de cette charge a atteint ses répétitions visées.
 */
export function findRecord(ex, previousLogs) {
  const done = doneSets(ex);
  const best = Math.max(0, ...done.map(set => Number(set.weight) || 0));
  if (!best) return null;
  const bestSet = done.find(set => (Number(set.weight) || 0) === best);
  if ((Number(bestSet.reps) || 0) < (Number(bestSet.targetReps) || 0)) return null;
  const before = previousLogs.flatMap(log => log.exercises || []).filter(item => item.exerciseId === ex.exerciseId)
    .flatMap(doneSets).map(set => Number(set.weight) || 0);
  if (!before.length) return null;
  const previousBest = Math.max(...before);
  return best > previousBest ? { weight: best, gain: best - previousBest } : null;
}

/** Tous les records de l'historique, dans l'ordre (même règle que findRecord, en un seul passage) */
export function recordHistory(logs) {
  const sorted = [...(logs || [])].sort((a, b) => a.date - b.date);
  const maxBy = new Map();
  const out = [];
  for (const log of sorted) {
    for (const ex of log.exercises || []) {
      const done = doneSets(ex);
      const weights = done.map(set => Number(set.weight) || 0);
      const best = Math.max(0, ...weights);
      const previous = maxBy.get(ex.exerciseId);
      if (best && previous !== undefined) {
        const bestSet = done.find(set => (Number(set.weight) || 0) === best);
        if ((Number(bestSet.reps) || 0) >= (Number(bestSet.targetReps) || 0) && best > previous) {
          out.push({ date: log.date, exerciseId: ex.exerciseId, weight: best, gain: best - previous });
        }
      }
      if (weights.length) maxBy.set(ex.exerciseId, Math.max(previous ?? 0, ...weights));
    }
  }
  return out;
}

export function weekSessions(logs, now = Date.now()) {
  const week = weekKey(now);
  return (logs || []).filter(log => countsAsSession(log) && weekKey(log.date) === week);
}

function topExercises(logs, count) {
  const seen = new Map();
  for (const log of logs || []) for (const ex of log.exercises || []) {
    if (doneSets(ex).some(set => Number(set.weight) > 0)) seen.set(ex.exerciseId, (seen.get(ex.exerciseId) || 0) + 1);
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, count).map(([id]) => id);
}

/* Firestore refuse les tableaux de tableaux : les points sont des objets { t, v } */
function maxWeightSeries(logs, exerciseId, count) {
  return [...(logs || [])].sort((a, b) => a.date - b.date)
    .map(log => {
      const ex = (log.exercises || []).find(item => item.exerciseId === exerciseId);
      const best = ex ? Math.max(0, ...doneSets(ex).map(set => Number(set.weight) || 0)) : 0;
      return best ? { t: log.date, v: best } : null;
    })
    .filter(Boolean).slice(-count);
}

export const SHARE_KEYS = ["streak", "sessions", "records", "curves", "program", "weight", "nutrition"];
export const BOARD_KEYS = ["sessions", "streak", "records"];

/**
 * Le résumé partagé : un objet par élément, et SEULEMENT les éléments partagés.
 * share / board : interrupteurs ; nameOf(id) : nom d'exercice ; program : programme en cours.
 */
export function buildSharedItems({ share = {}, board = {}, weeklyGoal = 3, logs = [], weightLog = [], program = null, nutrition = null, sharedPrograms = [], nameOf = id => id, now = Date.now() }) {
  const items = {};
  const sortedWeights = [...(weightLog || [])].sort((a, b) => a.date - b.date);
  const last = sortedWeights[sortedWeights.length - 1] || null;
  const s = computeStreak(sortedWeights, new Date(now));
  const streak = { current: s.current, best: s.best, lastDay: last ? dayKey(last.date) : null };
  const sessionLogs = [...(logs || [])].filter(countsAsSession).sort((a, b) => b.date - a.date);
  const week = weekSessions(sessionLogs, now);
  const records = recordHistory(sessionLogs);
  const month = monthKey(now);
  const monthRecords = records.filter(r => monthKey(r.date) === month);
  const clip = (text, n) => String(text || "").slice(0, n);

  if (share.streak) items.streak = streak;
  if (share.sessions) items.sessions = {
    weekKey: weekKey(now), count: week.length, goal: weeklyGoal,
    recent: sessionLogs.slice(0, 5).map(log => ({ t: log.date, name: clip(log.sessionName, 40), type: log.type || "other" }))
  };
  if (share.records) items.records = {
    monthKey: month, monthCount: monthRecords.length,
    recent: records.slice(-6).reverse().map(r => ({ t: r.date, name: clip(nameOf(r.exerciseId), 60), weight: r.weight, gain: r.gain }))
  };
  if (share.curves) items.curves = {
    list: topExercises(sessionLogs, 3).map(id => ({ name: clip(nameOf(id), 60), points: maxWeightSeries(sessionLogs, id, 12) }))
  };
  if (share.program && program) items.program = {
    name: clip(program.name, 80),
    sessions: (program.sessions || []).slice(0, 14).map(item => ({ name: clip(item.name, 40), type: item.type || "other", count: (item.exerciseIds || []).length }))
  };
  if (share.weight && last) {
    const monthAgo = now - 30 * 86400000;
    const recent = sortedWeights.filter(item => item.date >= monthAgo);
    items.weight = {
      current: last.weight,
      delta30: recent.length > 1 ? Math.round((last.weight - recent[0].weight) * 10) / 10 : null,
      points: recent.slice(-30).map(item => ({ t: item.date, v: item.weight }))
    };
  }
  if (share.nutrition && nutrition?.s?.phase) items.nutrition = { phase: nutrition.s.phase };

  const b = {};
  if (board.sessions) b.sessions = week.length;
  if (board.streak) b.streak = { current: streak.current, lastDay: streak.lastDay };
  if (board.records) b.records = monthRecords.length;
  if (Object.keys(b).length) items.board = { weekKey: weekKey(now), monthKey: month, ...b };

  if (sharedPrograms.length) items.programs = { list: sharedPrograms.slice(0, 10).map(p => ({ id: p.id, name: clip(p.name, 80) })) };
  return items;
}

/** Valeur d'un critère du classement, remise à zéro si la période est passée */
export function boardValue(criterion, board, now = Date.now()) {
  if (!board || board[criterion] === undefined) return null;
  if (criterion === "sessions") return board.weekKey === weekKey(now) ? Number(board.sessions) || 0 : 0;
  if (criterion === "records") return board.monthKey === monthKey(now) ? Number(board.records) || 0 : 0;
  if (criterion === "streak") return streakAlive(board.streak, now);
  return null;
}

/** Places avec ex æquo : 10, 8, 8, 5 → 1, 2, 2, 4 */
export function rankEntries(entries) {
  const sorted = [...entries].sort((a, b) => b.value - a.value || String(a.name).localeCompare(String(b.name)));
  return sorted.map(entry => ({ ...entry, place: 1 + sorted.filter(other => other.value > entry.value).length }));
}
