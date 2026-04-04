import { i18n } from "./i18n.js";
import { getExerciseNameTranslation } from "./exercise-names-translations.js";

export function buildProgressSummary(sessionLogs, weightLog) {
  const sessions = sessionLogs || [];
  const weights = weightLog || [];
  const lastWeight = weights.length ? weights[weights.length - 1].weight : "-";
  const totalSets = sessions.reduce((acc, log) => acc + (log.exercises || []).reduce((sum, ex) => sum + (ex.sets || []).length, 0), 0);
  const totalDone = sessions.reduce((acc, log) => acc + (log.exercises || []).reduce((sum, ex) => sum + (ex.sets || []).filter(set => set.status === "done").length, 0), 0);
  const topExercises = {};

  for (const log of sessions) {
    for (const ex of log.exercises || []) {
      const maxWeight = Math.max(...(ex.sets || []).map(item => item.weight || 0), 0);
      topExercises[ex.exerciseName] = Math.max(topExercises[ex.exerciseName] || 0, maxWeight);
    }
  }

  const topList = Object.entries(topExercises).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { sessionsCount: sessions.length, lastWeight, totalSets, totalDone, topList };
}

let charts = {};

const CHART_BASE_OPTIONS = {
  responsive: true,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: "#2d2d35" }, ticks: { color: "#9c9ca8", font: { family: "DM Mono", size: 10 } } },
    y: { grid: { color: "#2d2d35" }, ticks: { color: "#9c9ca8", font: { family: "DM Mono", size: 10 } } }
  }
};

function destroyChart(id) {
  if (!charts[id]) return;
  charts[id].destroy();
  delete charts[id];
}

function formatChartDate(input) {
  return new Date(input || Date.now()).toLocaleDateString(i18n.getLocale(), { day: "2-digit", month: "short" });
}

function getExerciseLabel(exercise) {
  if (!exercise) return "";
  return getExerciseNameTranslation(exercise.id, i18n.getLanguage()) || exercise.name;
}

export function renderWeightChart(weightLogArray, canvasId = "chart-weight") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  destroyChart(canvasId);

  charts[canvasId] = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: weightLogArray.map(item => formatChartDate(item.date)),
      datasets: [{
        data: weightLogArray.map(item => item.weight),
        borderColor: "#dff542",
        backgroundColor: "rgba(223,245,66,0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#dff542",
        borderWidth: 2
      }]
    },
    options: CHART_BASE_OPTIONS
  });
}

export function renderExerciseCharts(sessionLogs, exerciseId, exerciseName) {
  const wrap = document.getElementById("chart-exercise-wrap");
  if (!wrap) return;

  if (!exerciseId) {
    wrap.classList.add("hidden");
    destroyChart("exercise");
    destroyChart("volume");
    return;
  }

  const logsWithExercise = sessionLogs.filter(log => (log.exercises || []).some(exercise => exercise.exerciseId === exerciseId));

  if (logsWithExercise.length === 0) {
    wrap.classList.remove("hidden");
    document.getElementById("chart-exercise-title").textContent = exerciseName.toUpperCase();
    document.getElementById("exercise-stats-card").innerHTML = `<div class="card"><div class="item-subtitle text-center">${i18n.t("noDataForExercise")}</div></div>`;
    destroyChart("exercise");
    destroyChart("volume");
    return;
  }

  const points = [...logsWithExercise].reverse().map(log => {
    const exerciseData = (log.exercises || []).find(item => item.exerciseId === exerciseId);
    const maxWeight = Math.max(...(exerciseData?.sets || []).map(set => set.weight || 0), 0);
    const volume = (exerciseData?.sets || []).reduce((total, set) => total + ((set.reps || 0) * (set.weight || 0)), 0);
    return {
      date: formatChartDate(log.date),
      maxWeight,
      volume
    };
  });

  document.getElementById("chart-exercise-title").textContent = exerciseName.toUpperCase();
  wrap.classList.remove("hidden");

  destroyChart("exercise");
  destroyChart("volume");

  charts.exercise = new Chart(document.getElementById("chart-exercise").getContext("2d"), {
    type: "line",
    data: {
      labels: points.map(point => point.date),
      datasets: [{
        data: points.map(point => point.maxWeight),
        borderColor: "#7d5cff",
        backgroundColor: "rgba(125,92,255,0.1)",
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: "#7d5cff",
        borderWidth: 2
      }]
    },
    options: CHART_BASE_OPTIONS
  });

  charts.volume = new Chart(document.getElementById("chart-volume").getContext("2d"), {
    type: "bar",
    data: {
      labels: points.map(point => point.date),
      datasets: [{
        data: points.map(point => point.volume),
        backgroundColor: "#dff542",
        borderRadius: 4
      }]
    },
    options: CHART_BASE_OPTIONS
  });

  const allWeights = points.map(point => point.maxWeight);
  const record = Math.max(...allWeights);

  document.getElementById("exercise-stats-card").innerHTML = `
    <div class="stat-box"><div class="stat-value">${record}kg</div><div class="stat-label">${i18n.t("recordPr")}</div></div>
    <div class="stat-box"><div class="stat-value">${allWeights.length}</div><div class="stat-label">${i18n.t("sessionsStat")}</div></div>
  `;
}

export function initProgressView(exercisesArray, sessionLogs) {
  const select = document.getElementById("progress-exercise-select");
  if (!select) return;

  const previousValue = select.value;
  select.innerHTML = `<option value="">- ${i18n.t("selectExercisePlaceholder")} -</option>`;

  exercisesArray.forEach(exercise => {
    const option = document.createElement("option");
    option.value = exercise.id;
    option.textContent = getExerciseLabel(exercise);
    select.appendChild(option);
  });

  if (previousValue && [...select.options].some(option => option.value === previousValue)) {
    select.value = previousValue;
  }

  select.onchange = event => {
    const exerciseValue = event.target.value;
    const exerciseText = exerciseValue ? event.target.options[event.target.selectedIndex].text : "";
    renderExerciseCharts(sessionLogs, exerciseValue, exerciseText);
  };

  if (select.value) {
    const selectedText = select.options[select.selectedIndex]?.text || "";
    renderExerciseCharts(sessionLogs, select.value, selectedText);
    return;
  }

  renderExerciseCharts(sessionLogs, "", "");
}

