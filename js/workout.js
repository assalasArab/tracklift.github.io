import { uid } from "./utils.js?v=20261031b";
import { getExerciseById } from "./exercises.js?v=20261031b";
function getRestBase(exercise) {
  const focus = exercise?.muscle_focus;
  const type = exercise?.type;
  if (type === "legs") return 120;
  if (focus === "quadriceps" || focus === "dos") return 105;
  if (focus === "pectoraux" || focus === "epaules") return 90;
  if (focus === "triceps" || focus === "biceps") return 75;
  if (focus === "abdominaux") return 45;
  return 75;
}
function roundWeight(value) { return Math.round(value * 2) / 2; }
function suggestReps(previousExerciseLog, fallback) {
  const sets = previousExerciseLog?.sets || [];
  const allDone = sets.length > 0 && sets.every(set => set.status === "done");
  const allSkipped = sets.length > 0 && sets.every(set => set.status !== "done");
  if (allDone) return (fallback || 10) + 1;
  if (allSkipped) return Math.max(6, (fallback || 10) - 1);
  return fallback || 10;
}
function suggestWeight(previousExerciseLog, fallback) {
  const sets = previousExerciseLog?.sets || [];
  if (!sets.length) return fallback || 0;
  const allDone = sets.every(set => set.status === "done");
  const allSkipped = sets.every(set => set.status !== "done");
  // exercice au poids du corps (charge 0) : on ne rajoute pas de lest d'office
  if (!fallback) return 0;
  if (allDone) return roundWeight(fallback + 2.5);
  if (allSkipped) return roundWeight(Math.max(0, (fallback || 0) - 2.5));
  return roundWeight(fallback || 0);
}
function buildSuggestedSets(exercise, previousExerciseLog, planned) {
  const previousSets = previousExerciseLog?.sets || [];
  if (!previousSets.length && planned?.setList?.length) {
    // séries détaillées (import Notion) : chauffe, travail et baisses de charge
    return planned.setList.map(item => ({ targetReps: item.reps || planned.reps || 10, reps: item.reps || planned.reps || 10, weight: item.weight || 0, status: "pending", ...(item.kind && item.kind !== "work" ? { kind: item.kind } : {}) }));
  }
  if (!previousSets.length && planned) {
    return Array.from({ length: planned.sets || 3 }, () => ({ targetReps: planned.reps || 10, reps: planned.reps || 10, weight: planned.weight || 0, status: "pending" }));
  }
  if (previousSets.length) {
    return previousSets.map(item => item.kind === "warmup"
      ? { targetReps: item.targetReps || item.reps, reps: item.reps, weight: item.weight, status: "pending", kind: "warmup" }
      : { targetReps: suggestReps(previousExerciseLog, item.reps), reps: item.reps, weight: suggestWeight(previousExerciseLog, item.weight), status: "pending", ...(item.kind ? { kind: item.kind } : {}) });
  }
  const presetByFocus = { quadriceps: { sets: 4, reps: 8, weight: 20 }, pectoraux: { sets: 4, reps: 8, weight: 20 }, dos: { sets: 4, reps: 10, weight: 20 }, epaules: { sets: 3, reps: 12, weight: 10 }, triceps: { sets: 3, reps: 12, weight: 10 }, biceps: { sets: 3, reps: 12, weight: 10 }, ischio_jambiers: { sets: 4, reps: 10, weight: 20 }, fessiers: { sets: 4, reps: 10, weight: 20 }, abdominaux: { sets: 3, reps: 15, weight: 0 } };
  let preset = presetByFocus[exercise?.muscle_focus] || { sets: 3, reps: 10, weight: 10 };
  // gainage et positions tenues : la « répétition » est une durée en secondes
  if (exercise?.contraction_type === "isometrique") preset = { sets: 3, reps: 30, weight: 0 };
  // poids du corps : pas de charge par défaut
  else if (exercise?.bodyweight) preset = { ...preset, weight: 0 };
  return Array.from({ length: preset.sets }, () => ({ targetReps: preset.reps, reps: preset.reps, weight: preset.weight, status: "pending" }));
}
export function findLatestExerciseLog(exerciseId, sessionLogs) {
  for (const log of sessionLogs || []) {
    const found = (log.exercises || []).find(item => item.exerciseId === exerciseId);
    if (found) return found;
  }
  return null;
}
export function buildWorkoutFromExercises({ sessionName, type, exerciseIds, exercises, sessionLogs, plan }) {
  const orderedExercises = exerciseIds.map(id => getExerciseById(id, exercises)).filter(Boolean);
  const blocks = orderedExercises.map(exercise => {
    const previousExerciseLog = findLatestExerciseLog(exercise.id, sessionLogs);
    return { exerciseId: exercise.id, restSeconds: getRestBase(exercise), sets: buildSuggestedSets(exercise, previousExerciseLog, plan?.[exercise.id]) };
  });
  return { id: uid(), sessionName, type, mode: "guided", currentExerciseIndex: 0, currentSetIndex: 0, startedAt: Date.now(), blocks };
}
export function buildWorkoutFromRecentLog(log, exercises) { const exerciseIds = (log?.exercises || []).map(item => item.exerciseId); return buildWorkoutFromExercises({ sessionName: log?.sessionName || "seance", type: log?.type || "other", exerciseIds, exercises, sessionLogs: [log] }); }
export function getCurrentBlock(workout) { return workout?.blocks?.[workout.currentExerciseIndex] || null; }
export function getCurrentSet(workout) { const block = getCurrentBlock(workout); return block?.sets?.[workout.currentSetIndex] || null; }
export function isWorkoutComplete(workout) { return workout.currentExerciseIndex >= workout.blocks.length; }
const firstPendingSet = block => (block ? block.sets.findIndex(set => set.status === "pending") : -1);
/* Exercice suivant qui a encore des séries à faire : d'abord après l'exercice donné, puis depuis le début
   (on peut faire les exercices dans le désordre depuis la vue d'ensemble). Plus rien : la séance est finie. */
function moveToNextPending(workout, fromIndex) {
  const count = workout.blocks.length;
  for (let step = 1; step <= count; step += 1) {
    const index = (fromIndex + step) % count;
    const setIndex = firstPendingSet(workout.blocks[index]);
    if (setIndex >= 0) { workout.currentExerciseIndex = index; workout.currentSetIndex = setIndex; return; }
  }
  workout.currentExerciseIndex = count;
  workout.currentSetIndex = 0;
}
function goNext(workout) {
  const block = getCurrentBlock(workout);
  if (!block) return;
  const nextSet = block.sets.findIndex((set, index) => index > workout.currentSetIndex && set.status === "pending");
  if (nextSet >= 0) { workout.currentSetIndex = nextSet; return; }
  moveToNextPending(workout, workout.currentExerciseIndex);
}
/** Vue d'ensemble : passer directement à un exercice qui a encore des séries à faire */
export function goToBlock(workout, blockIndex) {
  const setIndex = firstPendingSet(workout?.blocks?.[blockIndex]);
  if (setIndex < 0) return false;
  workout.currentExerciseIndex = blockIndex;
  workout.currentSetIndex = setIndex;
  return true;
}
/** Vue d'ensemble : corriger une série faite, ou valider une série passée par erreur */
export function updateSet(workout, blockIndex, setIndex, { reps, weight, markDone = false } = {}) {
  const set = workout?.blocks?.[blockIndex]?.sets?.[setIndex];
  if (!set) return null;
  if (set.status !== "done" && !(markDone && set.status === "skipped")) return null;
  if (reps != null) set.reps = Math.max(0, Number(reps) || 0);
  if (weight != null) set.weight = Math.max(0, Number(weight) || 0);
  if (markDone) set.status = "done";
  return set;
}
export function completeCurrentSet(workout, reps, weight) { const set = getCurrentSet(workout); if (!set) return workout; set.reps = Number(reps) || 0; set.weight = Number(weight) || 0; set.status = "done"; goNext(workout); return workout; }
export function skipCurrentSet(workout) { const set = getCurrentSet(workout); if (!set) return workout; set.status = "skipped"; goNext(workout); return workout; }
export function skipCurrentExercise(workout) { const block = getCurrentBlock(workout); if (!block) return workout; block.sets.forEach(set => { if (set.status === "pending") set.status = "skipped"; }); moveToNextPending(workout, workout.currentExerciseIndex); return workout; }
export function replaceCurrentExercise(workout, newExerciseId, exercises, sessionLogs) { const nextExercise = getExerciseById(newExerciseId, exercises); const currentBlock = getCurrentBlock(workout); if (!nextExercise || !currentBlock) return workout; const previousExerciseLog = findLatestExerciseLog(nextExercise.id, sessionLogs); currentBlock.exerciseId = nextExercise.id; currentBlock.restSeconds = getRestBase(nextExercise); currentBlock.sets = buildSuggestedSets(nextExercise, previousExerciseLog); workout.currentSetIndex = 0; return workout; }
export function buildSessionLogFromWorkout(workout, exercises, endedAt = Date.now()) {
  const completedExercises = workout.blocks.map(block => { const exercise = getExerciseById(block.exerciseId, exercises); return { exerciseId: block.exerciseId, exerciseName: exercise?.name || "exercice", muscleFocus: exercise?.muscle_focus || "other", type: exercise?.type || "other", sets: block.sets.map(item => ({ reps: item.reps, weight: item.weight, targetReps: item.targetReps, status: item.status, ...(item.kind ? { kind: item.kind } : {}) })), restSeconds: block.restSeconds }; });
  return { id: uid(), workoutId: workout.id || null, sessionName: workout.sessionName, type: workout.type, programId: workout.programId || null, date: endedAt, durationMs: Math.max(0, endedAt - workout.startedAt), exercises: completedExercises };
}