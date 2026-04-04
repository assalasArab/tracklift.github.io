import { uid } from "./utils.js";
import { getExerciseById } from "./exercises.js";
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
  if (allDone) return roundWeight((fallback || 0) + 2.5);
  if (allSkipped) return roundWeight(Math.max(0, (fallback || 0) - 2.5));
  return roundWeight(fallback || 0);
}
function buildSuggestedSets(exercise, previousExerciseLog) {
  const previousSets = previousExerciseLog?.sets || [];
  if (previousSets.length) {
    return previousSets.map(item => ({ targetReps: suggestReps(previousExerciseLog, item.reps), reps: item.reps, weight: suggestWeight(previousExerciseLog, item.weight), status: "pending" }));
  }
  const presetByFocus = { quadriceps: { sets: 4, reps: 8, weight: 20 }, pectoraux: { sets: 4, reps: 8, weight: 20 }, dos: { sets: 4, reps: 10, weight: 20 }, epaules: { sets: 3, reps: 12, weight: 10 }, triceps: { sets: 3, reps: 12, weight: 10 }, biceps: { sets: 3, reps: 12, weight: 10 }, ischio_jambiers: { sets: 4, reps: 10, weight: 20 }, fessiers: { sets: 4, reps: 10, weight: 20 }, abdominaux: { sets: 3, reps: 15, weight: 0 } };
  const preset = presetByFocus[exercise?.muscle_focus] || { sets: 3, reps: 10, weight: 10 };
  return Array.from({ length: preset.sets }, () => ({ targetReps: preset.reps, reps: preset.reps, weight: preset.weight, status: "pending" }));
}
export function findLatestExerciseLog(exerciseId, sessionLogs) {
  for (const log of sessionLogs || []) {
    const found = (log.exercises || []).find(item => item.exerciseId === exerciseId);
    if (found) return found;
  }
  return null;
}
export function buildWorkoutFromExercises({ sessionName, type, exerciseIds, exercises, sessionLogs }) {
  const orderedExercises = exerciseIds.map(id => getExerciseById(id, exercises)).filter(Boolean);
  const blocks = orderedExercises.map(exercise => {
    const previousExerciseLog = findLatestExerciseLog(exercise.id, sessionLogs);
    return { exerciseId: exercise.id, restSeconds: getRestBase(exercise), sets: buildSuggestedSets(exercise, previousExerciseLog) };
  });
  return { id: uid(), sessionName, type, mode: "guided", currentExerciseIndex: 0, currentSetIndex: 0, startedAt: Date.now(), blocks };
}
export function buildWorkoutFromRecentLog(log, exercises) { const exerciseIds = (log?.exercises || []).map(item => item.exerciseId); return buildWorkoutFromExercises({ sessionName: log?.sessionName || "seance", type: log?.type || "other", exerciseIds, exercises, sessionLogs: [log] }); }
export function getCurrentBlock(workout) { return workout?.blocks?.[workout.currentExerciseIndex] || null; }
export function getCurrentSet(workout) { const block = getCurrentBlock(workout); return block?.sets?.[workout.currentSetIndex] || null; }
export function isWorkoutComplete(workout) { return workout.currentExerciseIndex >= workout.blocks.length; }
function goNext(workout) { const block = getCurrentBlock(workout); if (!block) return; if (workout.currentSetIndex < block.sets.length - 1) { workout.currentSetIndex += 1; return; } workout.currentExerciseIndex += 1; workout.currentSetIndex = 0; }
export function completeCurrentSet(workout, reps, weight) { const set = getCurrentSet(workout); if (!set) return workout; set.reps = Number(reps) || 0; set.weight = Number(weight) || 0; set.status = "done"; goNext(workout); return workout; }
export function skipCurrentSet(workout) { const set = getCurrentSet(workout); if (!set) return workout; set.status = "skipped"; goNext(workout); return workout; }
export function skipCurrentExercise(workout) { const block = getCurrentBlock(workout); if (!block) return workout; for (let index = workout.currentSetIndex; index < block.sets.length; index += 1) { if (block.sets[index].status === "pending") block.sets[index].status = "skipped"; } workout.currentExerciseIndex += 1; workout.currentSetIndex = 0; return workout; }
export function replaceCurrentExercise(workout, newExerciseId, exercises, sessionLogs) { const nextExercise = getExerciseById(newExerciseId, exercises); const currentBlock = getCurrentBlock(workout); if (!nextExercise || !currentBlock) return workout; const previousExerciseLog = findLatestExerciseLog(nextExercise.id, sessionLogs); currentBlock.exerciseId = nextExercise.id; currentBlock.restSeconds = getRestBase(nextExercise); currentBlock.sets = buildSuggestedSets(nextExercise, previousExerciseLog); workout.currentSetIndex = 0; return workout; }
export function buildSessionLogFromWorkout(workout, exercises) {
  const completedExercises = workout.blocks.map(block => { const exercise = getExerciseById(block.exerciseId, exercises); return { exerciseId: block.exerciseId, exerciseName: exercise?.name || "exercice", muscleFocus: exercise?.muscle_focus || "other", type: exercise?.type || "other", sets: block.sets.map(item => ({ reps: item.reps, weight: item.weight, targetReps: item.targetReps, status: item.status })), restSeconds: block.restSeconds }; });
  return { id: uid(), sessionName: workout.sessionName, type: workout.type, date: Date.now(), durationMs: Date.now() - workout.startedAt, exercises: completedExercises };
}