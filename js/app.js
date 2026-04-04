import { $, $all, formatDate, formatDuration, showToast, showLoading, openModal, closeModal, loadExerciseImage, applyImageFallback, uid } from "./utils.js";
import { DB } from "./db.js";
import { Auth } from "./auth.js";
import { i18n } from "./i18n.js";
import { getImprovedDescription } from "./improved-descriptions.js";
import { getExerciseTips } from "./exercise-tips.js";
import { getExerciseNameTranslation } from "./exercise-names-translations.js";
import { getAllMuscleFocus, getAllMusclePortion, getAllContractionTypes, getExerciseById, getSimilarExercises } from "./exercises.js";
import { buildWorkoutFromExercises, buildWorkoutFromRecentLog, completeCurrentSet, skipCurrentSet, skipCurrentExercise, replaceCurrentExercise, buildSessionLogFromWorkout, getCurrentBlock, getCurrentSet, isWorkoutComplete } from "./workout.js";
import { renderWeightChart } from "./charts.js";

const state = {
  user: null,
  profile: null,
  programs: [],
  exercises: [],
  sessionLogs: [],
  weightLog: [],
  workout: null,
  activeView: "home",
  restInterval: null,
  restRemaining: 0,
  launcherTab: "free",
  currentProgramId: null,
  currentEditSessionId: null
};

function t(key, variables = {}) {
  return i18n.t(key, variables);
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDateForUi(input) {
  return formatDate(input, i18n.getLocale());
}

function getExerciseName(exercise) {
  if (!exercise) return "";
  return getExerciseNameTranslation(exercise.id, i18n.getLanguage()) || exercise.name;
}

function translateExerciseValue(category, value) {
  return i18n.translateValue(category, value);
}

function getSessionTypeLabel(type) {
  return translateExerciseValue("type", type) || type || "";
}

function getExerciseMeta(exercise) {
  return {
    type: translateExerciseValue("type", exercise?.type),
    muscleFocus: translateExerciseValue("muscle_focus", exercise?.muscle_focus),
    musclePortion: translateExerciseValue("muscle_portion", exercise?.muscle_portion),
    contractionType: translateExerciseValue("contraction_type", exercise?.contraction_type),
    equipment: translateExerciseValue("equipment", exercise?.equipment),
    difficulty: translateExerciseValue("difficulty", exercise?.difficulty)
  };
}

function buildExerciseSearchText(exercise) {
  const meta = getExerciseMeta(exercise);
  return normalizeText([
    exercise?.id,
    exercise?.name,
    getExerciseName(exercise),
    exercise?.type,
    meta.type,
    exercise?.muscle_focus,
    meta.muscleFocus,
    exercise?.muscle_portion,
    meta.musclePortion,
    exercise?.contraction_type,
    meta.contractionType,
    exercise?.equipment,
    meta.equipment,
    exercise?.difficulty,
    meta.difficulty
  ].filter(Boolean).join(" "));
}

function updateSyncBadge() {
  const badge = $("#sync-badge");
  if (!badge) return;
  badge.textContent = state.user ? t("syncCloud") : t("syncLocal");
}

function applyStaticTranslations() {
  document.title = t("appTitle");

  $all("[data-i18n]").forEach(node => {
    node.textContent = t(node.dataset.i18n);
  });

  $all("[data-i18n-placeholder]").forEach(node => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });

  $all("[data-i18n-title]").forEach(node => {
    node.title = t(node.dataset.i18nTitle);
  });

  updateSyncBadge();
}

function init() {
  applyStaticTranslations();
  bindGlobalEvents();
  showLoading(true);

  Auth.onAuthStateChanged(async firebaseUser => {
    if (firebaseUser) {
      await loadApp(firebaseUser);
      return;
    }

    state.user = null;
    state.profile = null;
    state.programs = [];
    state.exercises = [];
    state.sessionLogs = [];
    state.weightLog = [];
    state.workout = null;
    showLoading(false);
    updateSyncBadge();
    closeProfileDrawer();
    $("#app-screen").classList.add("hidden");
    $("#auth-screen").classList.remove("hidden");
  });
}

function bindGlobalEvents() {
  $("#google-signin-btn").addEventListener("click", handleGoogleSignIn);

  $("#profile-btn").addEventListener("click", openProfileDrawer);
  $("#drawer-close-btn").addEventListener("click", closeProfileDrawer);
  $("#drawer-overlay").addEventListener("click", closeProfileDrawer);
  $("#drawer-logout-btn").addEventListener("click", () => { closeProfileDrawer(); handleLogout(); });
  $("#drawer-language-btn").addEventListener("click", () => openModal("modal-language"));
  $("#drawer-progress-btn").addEventListener("click", () => { closeProfileDrawer(); setView("progress"); });
  $("#drawer-about-btn").addEventListener("click", toggleDrawerAbout);
  $("#progress-back-btn").addEventListener("click", () => setView("home"));

  $all(".drawer-tab").forEach(tab => {
    tab.addEventListener("click", () => switchAboutTab(tab.dataset.aboutTab));
  });
  $("#lang-fr").addEventListener("click", () => {
    i18n.setLanguage("fr");
    closeModal("modal-language");
    updateUILanguage();
    showToast(t("languageActivated"));
  });
  $("#lang-en").addEventListener("click", () => {
    i18n.setLanguage("en");
    closeModal("modal-language");
    updateUILanguage();
    showToast(t("languageActivated"));
  });

  $("#open-launcher-btn").addEventListener("click", openLauncher);
  $("#open-weight-btn").addEventListener("click", openWeightModal);
  $("#save-weight-btn").addEventListener("click", saveWeight);
  $("#export-btn").addEventListener("click", exportData);
  $("#create-program-btn").addEventListener("click", () => openModal("modal-create-program"));
  $("#save-program-btn").addEventListener("click", createProgram);

  const backProgramsButton = $("#back-programs-btn");
  if (backProgramsButton) backProgramsButton.addEventListener("click", () => setView("programs"));

  const addProgramSessionButton = $("#add-prog-session-btn");
  if (addProgramSessionButton) addProgramSessionButton.addEventListener("click", () => openModal("modal-add-prog-session"));

  const saveProgramSessionButton = $("#save-prog-session-btn");
  if (saveProgramSessionButton) saveProgramSessionButton.addEventListener("click", saveProgSession);

  const deleteProgramButton = $("#delete-program-btn");
  if (deleteProgramButton) deleteProgramButton.addEventListener("click", deleteCurrentProgram);

  const searchManageExercises = $("#search-manage-exercises");
  if (searchManageExercises) searchManageExercises.addEventListener("input", renderManageExercisesList);

  $("#launch-free-btn").addEventListener("click", launchFreeWorkout);
  $("#launch-program-btn").addEventListener("click", launchProgramWorkout);
  $("#program-select").addEventListener("change", renderProgramSessionOptions);
  $("#launcher-add-program-btn").addEventListener("click", launcherAddProgram);
  $("#launcher-add-session-btn").addEventListener("click", launcherAddSession);

  $all(".launcher-tab").forEach(button => {
    button.addEventListener("click", () => switchLauncherTab(button.dataset.launcherTab));
  });

  $("#exercise-search").addEventListener("input", renderExerciseList);
  $("#filter-type").addEventListener("change", renderExerciseList);
  $("#filter-muscle").addEventListener("change", () => {
    updatePortionFilter();
    renderExerciseList();
  });
  $("#filter-portion").addEventListener("change", renderExerciseList);
  $("#filter-contraction").addEventListener("change", renderExerciseList);

  $("#next-btn").addEventListener("click", handleNext);
  $("#skip-open-btn").addEventListener("click", () => openModal("modal-skip"));
  $("#skip-set-btn").addEventListener("click", () => {
    closeModal("modal-skip");
    skipSetFlow();
  });
  $("#skip-exercise-btn").addEventListener("click", () => {
    closeModal("modal-skip");
    skipExerciseFlow();
  });
  $("#similar-btn").addEventListener("click", openSimilarModal);
  $("#details-btn").addEventListener("click", openExerciseDetails);
  $("#stop-workout-btn").addEventListener("click", () => openModal("modal-stop"));
  $("#confirm-stop-btn").addEventListener("click", stopWorkout);
  $("#rest-skip-btn").addEventListener("click", stopRest);
  $("#rest-add-btn").addEventListener("click", () => addRest(30));

  $all("[data-view]").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  $all("[data-close]").forEach(button => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
  });

  document.addEventListener("click", event => {
    if (event.target.classList.contains("modal")) {
      event.target.classList.add("hidden");
    }
  });
}

function showAuthError(message) {
  const node = $("#auth-error");
  node.textContent = message;
  node.classList.remove("hidden");
}

async function handleGoogleSignIn() {
  try {
    showLoading(true);
    await Auth.signInWithGoogle();
  } catch (error) {
    showLoading(false);
    showAuthError(error.message || t("authError"));
  }
}

async function handleLogout() {
  stopRest();
  state.workout = null;
  await Auth.signOut();
}

function openProfileDrawer() {
  $("#drawer-overlay").classList.remove("hidden");
  requestAnimationFrame(() => {
    $("#drawer-overlay").classList.add("open");
    $("#profile-drawer").classList.add("open");
  });
}

function closeProfileDrawer() {
  $("#drawer-overlay").classList.remove("open");
  $("#profile-drawer").classList.remove("open");
  setTimeout(() => $("#drawer-overlay").classList.add("hidden"), 300);
}

function toggleDrawerAbout() {
  const section = $("#drawer-about-section");
  section.classList.toggle("hidden");
  if (!section.classList.contains("hidden")) {
    renderAboutCurrentStats();
  }
}

function switchAboutTab(tab) {
  $all(".drawer-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.aboutTab === tab));
  $("#about-tab-current").classList.toggle("hidden", tab !== "current");
  $("#about-tab-radar").classList.toggle("hidden", tab !== "radar");
  if (tab === "current") renderAboutCurrentStats();
  if (tab === "radar") renderRadarChart();
}

function renderAboutCurrentStats() {
  const totalSessions = state.sessionLogs.length;
  const totalVolume = state.sessionLogs.reduce((sum, log) => {
    return sum + (log.exercises || []).reduce((exSum, ex) => {
      return exSum + (ex.sets || []).filter(s => s.status === "done").reduce((sSum, s) => sSum + (s.reps || 0) * (s.weight || 0), 0);
    }, 0);
  }, 0);
  const lastWeight = state.weightLog.length ? state.weightLog[state.weightLog.length - 1].weight + " kg" : "-";

  $("#about-current-stats").innerHTML = `
    <div class="stat-box"><div class="stat-value">${totalSessions}</div><div class="stat-label">${t("sessionsCompleted")}</div></div>
    <div class="stat-box"><div class="stat-value">${Math.round(totalVolume / 1000)}t</div><div class="stat-label">${t("totalVolumeStat")}</div></div>
    <div class="stat-box"><div class="stat-value">${lastWeight}</div><div class="stat-label">${t("weightLabel")}</div></div>
    <div class="stat-box"><div class="stat-value">${state.exercises.length}</div><div class="stat-label">${t("exercisesLabel")}</div></div>
  `;

  const topExercises = {};
  for (const log of state.sessionLogs) {
    for (const ex of (log.exercises || [])) {
      const maxW = Math.max(...(ex.sets || []).filter(s => s.status === "done").map(s => s.weight || 0), 0);
      const name = getExerciseNameTranslation(ex.exerciseId, i18n.getLanguage()) || ex.exerciseName || ex.exerciseId;
      topExercises[name] = Math.max(topExercises[name] || 0, maxW);
    }
  }
  const topList = Object.entries(topExercises).sort((a, b) => b[1] - a[1]).slice(0, 5);
  $("#about-top-exercises").innerHTML = topList.length ? `
    <div class="drawer-section-title" style="font-size:16px; margin-top:12px;">${t("topExercises")}</div>
    ${topList.map(([name, w]) => `
      <div class="about-top-item">
        <span class="about-top-name">${name}</span>
        <span class="about-top-weight">${w} kg</span>
      </div>
    `).join("")}
  ` : "";
}

function computeMuscleGroupScores() {
  const groups = {};
  for (const log of state.sessionLogs) {
    for (const ex of (log.exercises || [])) {
      const exercise = state.exercises.find(e => e.id === ex.exerciseId);
      const muscle = exercise?.muscle_focus || ex.muscleFocus || "other";
      if (!groups[muscle]) groups[muscle] = { volume: 0, maxWeight: 0, sessions: 0 };
      const doneSets = (ex.sets || []).filter(s => s.status === "done");
      if (doneSets.length === 0) continue;
      groups[muscle].sessions++;
      groups[muscle].maxWeight = Math.max(groups[muscle].maxWeight, ...doneSets.map(s => s.weight || 0));
      groups[muscle].volume += doneSets.reduce((sum, s) => sum + (s.reps || 0) * (s.weight || 0), 0);
    }
  }

  const maxVolume = Math.max(...Object.values(groups).map(g => g.volume), 1);
  const result = {};
  for (const [muscle, data] of Object.entries(groups)) {
    result[muscle] = Math.min(100, Math.round((data.volume / maxVolume) * 100));
  }
  return result;
}

function scoreToRank(score) {
  if (score >= 90) return "S";
  if (score >= 70) return "A";
  if (score >= 50) return "B";
  if (score >= 30) return "C";
  if (score >= 15) return "D";
  return "E";
}

function renderRadarChart() {
  const scores = computeMuscleGroupScores();
  const muscles = Object.keys(scores);
  if (muscles.length === 0) {
    $("#radar-chart").parentElement.innerHTML = `<div class="card" style="text-align:center;padding:24px;"><div class="item-subtitle">${t("noPreviousSessions")}</div></div>`;
    $("#radar-legend").innerHTML = "";
    $("#radar-overall").innerHTML = "";
    return;
  }

  const labels = muscles.map(m => translateExerciseValue("muscle_focus", m) || m);
  const values = muscles.map(m => scores[m]);

  const canvas = document.getElementById("radar-chart");
  const existingChart = Chart.getChart(canvas);
  if (existingChart) existingChart.destroy();

  new Chart(canvas.getContext("2d"), {
    type: "radar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: "rgba(125,92,255,0.25)",
        borderColor: "#7d5cff",
        borderWidth: 2,
        pointBackgroundColor: "#dff542",
        pointBorderColor: "#dff542",
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false, stepSize: 20 },
          grid: { color: "rgba(45,45,53,0.8)" },
          angleLines: { color: "rgba(45,45,53,0.8)" },
          pointLabels: { color: "#9c9ca8", font: { family: "DM Mono", size: 10 } }
        }
      }
    }
  });

  $("#radar-legend").innerHTML = muscles.map((m, i) => {
    const rank = scoreToRank(values[i]);
    return `
      <div class="radar-legend-item">
        <span class="radar-legend-name">${labels[i]}</span>
        <span class="radar-legend-rank rank-${rank}">${rank}</span>
      </div>
    `;
  }).join("");

  const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const overallRank = scoreToRank(avg);
  $("#radar-overall").innerHTML = `
    <div class="radar-overall-rank rank-${overallRank}">${overallRank}</div>
    <div class="radar-overall-label">${t("overallRank")}</div>
  `;
}

async function loadApp(firebaseUser) {
  try {
    showLoading(true);
    await DB.initCloud(firebaseUser.uid);

    const migrated = await DB.migrateFromLocal();
    if (migrated) {
      showToast(t("localDataMigrated"));
    }

    const data = DB.getData();
    data.profile = {
      id: firebaseUser.uid,
      email: firebaseUser.email,
      name: firebaseUser.displayName || firebaseUser.email,
      photoURL: firebaseUser.photoURL || null,
      createdAt: data.profile?.createdAt || Date.now()
    };
    DB.saveData(data);

    state.user = { id: firebaseUser.uid, email: firebaseUser.email, name: firebaseUser.displayName };
    state.profile = DB.getProfile();
    state.programs = DB.getPrograms();
    state.exercises = DB.getExercises();
    state.sessionLogs = DB.getSessionLogs();
    state.weightLog = DB.getWeightLog();

    const initial = (firebaseUser.displayName || "t").slice(0, 1);
    $("#profile-btn").textContent = initial;
    $("#drawer-avatar").textContent = initial;
    $("#drawer-name").textContent = firebaseUser.displayName || "";
    $("#drawer-email").textContent = firebaseUser.email || "";
    const createdAt = data.profile?.createdAt;
    if (createdAt) {
      $("#drawer-since").textContent = `${t("memberSince")} ${formatDateForUi(createdAt)}`;
    }
    $("#auth-screen").classList.add("hidden");
    $("#app-screen").classList.remove("hidden");

    applyStaticTranslations();
    renderAll();
  } catch (error) {
    showAuthError(`${t("loadErrorPrefix")}: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

function renderAll() {
  setView("home");
  renderHome();
  renderPrograms();
  renderExerciseFilters();
  renderExerciseList();
}

function setView(view) {
  state.activeView = view;

  $all(".view").forEach(node => node.classList.remove("active"));
  $all(".nav-btn").forEach(node => node.classList.toggle("active", node.dataset.view === view));

  const activeNode = document.getElementById(`view-${view}`);
  if (activeNode) activeNode.classList.add("active");

  if (view === "home") renderHome();
  if (view === "programs") renderPrograms();
  if (view === "exercises") renderExerciseList();
  if (view === "progress") renderProgress();
  if (view === "workout") renderWorkout();
}

function renderHome() {
  const displayName = String(state.profile?.name || "").trim() || t("athlete");
  $("#home-title").textContent = t("homeGreeting", { name: displayName });

  const lastWeight = state.weightLog.length ? state.weightLog[state.weightLog.length - 1].weight : "-";
  const stats = [
    { value: state.sessionLogs.length, label: t("sessionsLabel") },
    { value: lastWeight, label: t("weightLabel") },
    { value: state.programs.length, label: t("programsLabel") },
    { value: state.exercises.length, label: t("exercisesLabel") }
  ];

  $("#stats-grid").innerHTML = stats.map(item => `
    <div class="stat-box">
      <div class="stat-value">${item.value}</div>
      <div class="stat-label">${item.label}</div>
    </div>
  `).join("");

  const recent = state.sessionLogs.slice(0, 8);
  $("#recent-sessions-list").innerHTML = recent.length ? recent.map(log => {
    const completedSets = (log.exercises || []).reduce((total, exercise) => {
      return total + (exercise.sets || []).filter(set => set.status === "done").length;
    }, 0);

    const exerciseDetails = (log.exercises || []).map(ex => {
      const doneSets = (ex.sets || []).filter(s => s.status === "done");
      const maxWeight = doneSets.length ? Math.max(...doneSets.map(s => s.weight || 0)) : 0;
      const totalSets = doneSets.length;
      const bestReps = doneSets.length ? doneSets.reduce((best, s) => (s.weight || 0) >= maxWeight ? s.reps : best, 0) : 0;
      const name = getExerciseNameTranslation(ex.exerciseId, i18n.getLanguage()) || ex.exerciseName || ex.exerciseId;
      return { name, maxWeight, totalSets, bestReps };
    }).filter(ex => ex.totalSets > 0);

    const exerciseListHtml = exerciseDetails.length ? `
      <div class="session-exercise-details hidden" data-details-for="${log.id}">
        ${exerciseDetails.map(ex => `
          <div class="session-exercise-row">
            <span class="session-exercise-name">${ex.name}</span>
            <span class="session-exercise-stats">${ex.totalSets}×${ex.bestReps} · ${ex.maxWeight} kg</span>
          </div>
        `).join("")}
      </div>
    ` : "";

    return `
      <div class="session-item" data-toggle-details="${log.id}" style="cursor:pointer;">
        <div class="session-item-head">
          <div>
            <div class="item-title">${log.sessionName}</div>
            <div class="item-subtitle">${formatDateForUi(log.date)} · ${getSessionTypeLabel(log.type)}</div>
            <div class="small-meta">${t("validatedSetsCount", { count: completedSets })} · ${formatDuration(log.durationMs || 0)}</div>
          </div>
          <button class="btn btn-ghost btn-sm" data-repeat="${log.id}">${t("replay")}</button>
        </div>
        ${exerciseListHtml}
      </div>
    `;
  }).join("") : `<div class="card">${t("noPreviousSessions")}</div>`;

  $all("[data-toggle-details]").forEach(item => {
    item.addEventListener("click", (e) => {
      if (e.target.closest("[data-repeat]")) return;
      const details = item.querySelector("[data-details-for]");
      if (details) details.classList.toggle("hidden");
    });
  });

  $all("[data-repeat]").forEach(button => {
    button.addEventListener("click", () => repeatWorkout(button.dataset.repeat));
  });
}

function openWeightModal() {
  $("#weight-input").value = "";
  $("#weight-history").innerHTML = state.weightLog.slice(-6).reverse().map(item => `
    <div class="progress-item" style="padding:10px;">
      <div class="item-title">${item.weight} kg</div>
      <div class="item-subtitle" style="margin-top:0;">${formatDateForUi(item.date)}</div>
    </div>
  `).join("");
  openModal("modal-weight");
}

function saveWeight() {
  const weight = Number($("#weight-input").value);
  if (!weight || weight < 20 || weight > 300) {
    showToast(t("invalidWeight"));
    return;
  }

  DB.addWeight(weight);
  state.weightLog = DB.getWeightLog();
  closeModal("modal-weight");
  renderHome();

  if (state.activeView === "progress") {
    renderProgress();
  }

  showToast(t("weightSaved"));
}

function exportData() {
  const data = DB.exportCurrentData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tracklift_data.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(t("exportDownloaded"));
}

function renderPrograms() {
  $("#programs-list").innerHTML = state.programs.length ? state.programs.map(program => `
    <div class="program-item" style="cursor:pointer;" data-program-id="${program.id}">
      <div class="program-item-head">
        <div>
          <div class="item-title">${program.name}</div>
          <div class="item-subtitle">${program.description || ""}</div>
          <div class="small-meta">${t("sessionsCount", { count: program.sessions.length })}</div>
        </div>
      </div>
    </div>
  `).join("") : `<div class="card">${t("noProgramsYet")}</div>`;

  $all("[data-program-id]").forEach(card => {
    card.addEventListener("click", () => openProgramDetail(card.dataset.programId));
  });
}

function createProgram() {
  const name = $("#program-name-input").value.trim();
  const description = $("#program-desc-input").value.trim();

  if (!name) {
    showToast(t("nameRequired"));
    return;
  }

  DB.createProgram({ name, description });
  state.programs = DB.getPrograms();
  $("#program-name-input").value = "";
  $("#program-desc-input").value = "";
  closeModal("modal-create-program");
  renderPrograms();

  const launcher = $("#modal-launcher");
  if (launcher && !launcher.classList.contains("hidden")) {
    const latestProgram = state.programs[state.programs.length - 1];
    renderProgramSelectOptions();
    if (latestProgram) {
      $("#program-select").value = latestProgram.id;
    }
    renderProgramSessionOptions();
  }

  showToast(t("programCreated"));
}

function openProgramDetail(id) {
  state.currentProgramId = id;
  const program = state.programs.find(item => item.id === id);
  if (!program) return;

  $("#detail-program-title").textContent = program.name;
  $("#detail-program-desc").textContent = program.description || "";
  renderProgSessions(program);
  setView("program-detail");
}

function renderProgSessions(program) {
  const container = $("#prog-sessions-list");
  if (!container) return;

  if (!program.sessions || program.sessions.length === 0) {
    container.innerHTML = `<div class="card"><div class="item-subtitle text-center">${t("noSessionsYet")}</div></div>`;
    return;
  }

  container.innerHTML = program.sessions.map(session => `
    <div class="program-item card">
      <div class="program-item-head">
        <div>
          <div class="item-title">${session.name}</div>
          <span class="badge mt-12">${getSessionTypeLabel(session.type)}</span>
          <div class="small-meta mt-4">${t("configuredExercisesCount", { count: (session.exerciseIds || []).length })}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-surface btn-sm" data-edit-sess="${session.id}">${t("manageExercises")}</button>
          <button class="btn btn-primary btn-sm" data-play-sess="${session.id}">${t("play")}</button>
        </div>
      </div>
    </div>
  `).join("");

  $all("[data-edit-sess]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      openManageExercises(event.target.dataset.editSess);
    });
  });

  $all("[data-play-sess]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      launchSpecificProgSession(event.target.dataset.playSess);
    });
  });
}

function saveProgSession() {
  const name = $("#prog-sess-name").value.trim();
  const type = $("#prog-sess-type").value;

  if (!name) {
    showToast(t("nameRequired"));
    return;
  }

  if (!state.currentProgramId) return;

  const data = DB.getData();
  const program = data.programs.find(item => item.id === state.currentProgramId);
  if (!program) return;

  if (!program.sessions) {
    program.sessions = [];
  }

  const newSession = { id: uid(), name, type, exerciseIds: [] };
  program.sessions.push(newSession);
  DB.saveData(data);
  state.programs = DB.getPrograms();

  $("#prog-sess-name").value = "";
  closeModal("modal-add-prog-session");

  const updatedProgram = state.programs.find(item => item.id === state.currentProgramId);
  if (updatedProgram) {
    renderProgSessions(updatedProgram);
  }

  const launcher = $("#modal-launcher");
  if (launcher && !launcher.classList.contains("hidden")) {
    renderProgramSessionOptions();
  }

  showToast(t("sessionCreatedAddExercises"));
  setTimeout(() => openManageExercises(newSession.id), 300);
}

function deleteCurrentProgram() {
  if (!state.currentProgramId) return;
  if (!confirm(t("deleteProgramConfirm"))) return;

  const data = DB.getData();
  data.programs = data.programs.filter(program => program.id !== state.currentProgramId);
  DB.saveData(data);

  state.programs = DB.getPrograms();
  state.currentProgramId = null;
  setView("programs");
  showToast(t("programDeleted"));
}

function openManageExercises(sessionId) {
  state.currentEditSessionId = sessionId;
  $("#search-manage-exercises").value = "";
  renderManageExercisesList();
  openModal("modal-manage-exercises");
}

function renderManageExercisesList() {
  const program = state.programs.find(item => item.id === state.currentProgramId);
  const session = program?.sessions.find(item => item.id === state.currentEditSessionId);
  if (!session) return;

  const selectedIds = session.exerciseIds || [];
  const search = normalizeText($("#search-manage-exercises").value);
  const filtered = state.exercises.filter(exercise => !search || buildExerciseSearchText(exercise).includes(search));

  $("#manage-exercises-list").innerHTML = filtered.map(exercise => {
    const isSelected = selectedIds.includes(exercise.id);
    const meta = getExerciseMeta(exercise);

    return `
      <div class="exercise-item" style="display:flex; justify-content:space-between; align-items:center; padding: 12px; background: var(--surface2); border-radius: 12px;">
        <div>
          <div class="item-title" style="font-size: 14px;">${getExerciseName(exercise)}</div>
          <div class="item-subtitle" style="font-size: 11px;">${meta.muscleFocus}</div>
        </div>
        <div style="display:flex; gap: 8px;">
          <button class="btn btn-surface btn-sm" data-manage-details="${exercise.id}">${t("details")}</button>
          <button class="btn ${isSelected ? "btn-danger" : "btn-ghost"} btn-sm" data-toggle-ex="${exercise.id}">
            ${isSelected ? `x ${t("remove")}` : `+ ${t("add")}`}
          </button>
        </div>
      </div>
    `;
  }).join("");

  $all("[data-toggle-ex]").forEach(button => {
    button.addEventListener("click", event => {
      toggleExerciseInSession(event.target.dataset.toggleEx);
    });
  });

  $all("[data-manage-details]").forEach(button => {
    button.addEventListener("click", event => {
      const detailsModal = $("#modal-details");
      if (detailsModal) detailsModal.style.zIndex = "60";
      showExerciseDetails(event.target.dataset.manageDetails);
    });
  });
}

function toggleExerciseInSession(exerciseId) {
  const program = state.programs.find(item => item.id === state.currentProgramId);
  const session = program?.sessions.find(item => item.id === state.currentEditSessionId);
  if (!session) return;

  if (!session.exerciseIds) {
    session.exerciseIds = [];
  }

  if (session.exerciseIds.includes(exerciseId)) {
    session.exerciseIds = session.exerciseIds.filter(id => id !== exerciseId);
  } else {
    session.exerciseIds.push(exerciseId);
  }

  const data = DB.getData();
  const dbProgram = data.programs.find(item => item.id === state.currentProgramId);
  const dbSession = dbProgram?.sessions.find(item => item.id === state.currentEditSessionId);
  if (!dbSession) return;

  dbSession.exerciseIds = session.exerciseIds;
  DB.saveData(data);
  state.programs = DB.getPrograms();

  renderManageExercisesList();
  renderProgSessions(state.programs.find(item => item.id === state.currentProgramId));
}

function launchSpecificProgSession(sessionId) {
  const program = state.programs.find(item => item.id === state.currentProgramId);
  const session = program?.sessions.find(item => item.id === sessionId);
  if (!session || !session.exerciseIds?.length) {
    showToast(t("addExercisesFirst"));
    return;
  }

  state.workout = buildWorkoutFromExercises({
    sessionName: session.name,
    type: session.type,
    exerciseIds: session.exerciseIds,
    exercises: state.exercises,
    sessionLogs: state.sessionLogs
  });

  setView("workout");
}

function renderExerciseFilters() {
  const selectedMuscle = $("#filter-muscle").value;
  const selectedContraction = $("#filter-contraction").value;
  const muscles = getAllMuscleFocus(state.exercises);
  const contractions = getAllContractionTypes(state.exercises);

  $("#filter-muscle").innerHTML = `<option value="">${t("all")}</option>` + muscles.map(item => {
    return `<option value="${item}">${translateExerciseValue("muscle_focus", item)}</option>`;
  }).join("");

  $("#filter-contraction").innerHTML = `<option value="">${t("all")}</option>` + contractions.map(item => {
    return `<option value="${item}">${translateExerciseValue("contraction_type", item)}</option>`;
  }).join("");

  if (selectedMuscle && muscles.includes(selectedMuscle)) {
    $("#filter-muscle").value = selectedMuscle;
  }

  if (selectedContraction && contractions.includes(selectedContraction)) {
    $("#filter-contraction").value = selectedContraction;
  }

  updatePortionFilter();
}

function updatePortionFilter() {
  const selectedMuscle = $("#filter-muscle").value;
  const currentPortion = $("#filter-portion").value;
  const source = selectedMuscle
    ? state.exercises.filter(exercise => exercise.muscle_focus === selectedMuscle)
    : state.exercises;
  const portions = getAllMusclePortion(source);

  $("#filter-portion").innerHTML = `<option value="">${t("allFeminine")}</option>` + portions.map(item => {
    return `<option value="${item}">${translateExerciseValue("muscle_portion", item)}</option>`;
  }).join("");

  if (currentPortion && portions.includes(currentPortion)) {
    $("#filter-portion").value = currentPortion;
    return;
  }

  $("#filter-portion").value = "";
}

function renderExerciseList() {
  const search = normalizeText($("#exercise-search").value);
  const filterType = $("#filter-type").value;
  const filterMuscle = $("#filter-muscle").value;
  const filterPortion = $("#filter-portion").value;
  const filterContraction = $("#filter-contraction").value;

  const filtered = state.exercises.filter(exercise => {
    const matchesSearch = !search || buildExerciseSearchText(exercise).includes(search);
    const matchesType = !filterType || exercise.type === filterType;
    const matchesMuscle = !filterMuscle || exercise.muscle_focus === filterMuscle;
    const matchesPortion = !filterPortion || exercise.muscle_portion === filterPortion;
    const matchesContraction = !filterContraction || exercise.contraction_type === filterContraction;
    return matchesSearch && matchesType && matchesMuscle && matchesPortion && matchesContraction;
  });

  $("#exercise-list").innerHTML = filtered.map(exercise => {
    const meta = getExerciseMeta(exercise);
    const subtitle = [meta.type, meta.muscleFocus, meta.musclePortion].filter(Boolean).join(" · ");
    const smallMeta = [meta.equipment, meta.difficulty, meta.contractionType].filter(Boolean).join(" · ");

    return `
      <div class="exercise-item">
        <div class="exercise-item-head">
          <div>
            <div class="item-title">${getExerciseName(exercise)}</div>
            <div class="item-subtitle">${subtitle}</div>
            <div class="small-meta">${smallMeta}</div>
          </div>
          <button class="btn btn-ghost btn-sm" data-details-id="${exercise.id}">${t("details")}</button>
        </div>
      </div>
    `;
  }).join("");

  $all("[data-details-id]").forEach(button => {
    button.addEventListener("click", () => showExerciseDetails(button.dataset.detailsId));
  });
}

const CHART_COLORS = [
  "#7d5cff", "#dff542", "#ff5252", "#41d97d", "#ff9f43",
  "#36a2eb", "#ff6b9d", "#c084fc", "#22d3ee", "#fb923c"
];

let progressActiveExercises = new Set();
let progressChartInstances = { exercise: null, volume: null };

function getUsedExerciseIds() {
  const ids = new Set();
  for (const log of state.sessionLogs) {
    for (const ex of (log.exercises || [])) {
      const hasDone = (ex.sets || []).some(s => s.status === "done");
      if (hasDone) ids.add(ex.exerciseId);
    }
  }
  return [...ids];
}

function renderProgress() {
  renderWeightChart(state.weightLog);

  const usedIds = getUsedExerciseIds();

  if (progressActiveExercises.size === 0) {
    usedIds.forEach(id => progressActiveExercises.add(id));
  }

  renderProgressChips(usedIds);
  renderProgressCharts();

  const search = $("#progress-exercise-search");
  search.oninput = () => renderProgressChips(usedIds, search.value);
}

function renderProgressChips(usedIds, filter = "") {
  const normalized = normalizeText(filter);
  const container = $("#progress-exercise-chips");

  const chips = usedIds.map(id => {
    const ex = state.exercises.find(e => e.id === id);
    const name = ex ? getExerciseName(ex) : id;
    if (normalized && !normalizeText(name).includes(normalized)) return "";
    const active = progressActiveExercises.has(id);
    return `<button class="exercise-chip ${active ? "active" : ""}" data-chip-id="${id}">${name}</button>`;
  }).join("");

  container.innerHTML = chips;

  $all(".exercise-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const id = chip.dataset.chipId;
      if (progressActiveExercises.has(id)) {
        progressActiveExercises.delete(id);
      } else {
        progressActiveExercises.add(id);
      }
      chip.classList.toggle("active");
      renderProgressCharts();
    });
  });
}

function renderProgressCharts() {
  if (progressChartInstances.exercise) progressChartInstances.exercise.destroy();
  if (progressChartInstances.volume) progressChartInstances.volume.destroy();
  progressChartInstances = { exercise: null, volume: null };

  const activeIds = [...progressActiveExercises];
  const statsCard = $("#exercise-stats-card");

  if (activeIds.length === 0) {
    statsCard.innerHTML = "";
    return;
  }

  const allDates = new Set();
  const exerciseData = {};

  for (const id of activeIds) {
    exerciseData[id] = {};
    for (const log of state.sessionLogs) {
      const exEntry = (log.exercises || []).find(e => e.exerciseId === id);
      if (!exEntry) continue;
      const doneSets = (exEntry.sets || []).filter(s => s.status === "done");
      if (doneSets.length === 0) continue;
      const dateKey = new Date(log.date).toLocaleDateString(i18n.getLocale(), { day: "2-digit", month: "short" });
      allDates.add(dateKey);
      const maxW = Math.max(...doneSets.map(s => s.weight || 0));
      const vol = doneSets.reduce((sum, s) => sum + (s.reps || 0) * (s.weight || 0), 0);
      exerciseData[id][dateKey] = { maxWeight: maxW, volume: vol };
    }
  }

  const labels = [...allDates];

  const weightDatasets = activeIds.map((id, i) => {
    const ex = state.exercises.find(e => e.id === id);
    const name = ex ? getExerciseName(ex) : id;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    return {
      label: name,
      data: labels.map(d => exerciseData[id][d]?.maxWeight ?? null),
      borderColor: color,
      backgroundColor: color + "22",
      fill: false,
      tension: 0.4,
      pointRadius: 3,
      borderWidth: 2,
      spanGaps: true
    };
  });

  const volumeDatasets = activeIds.map((id, i) => {
    const ex = state.exercises.find(e => e.id === id);
    const name = ex ? getExerciseName(ex) : id;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    return {
      label: name,
      data: labels.map(d => exerciseData[id][d]?.volume ?? null),
      backgroundColor: color + "88",
      borderRadius: 3
    };
  });

  const chartOpts = {
    responsive: true,
    plugins: {
      legend: { display: activeIds.length > 1, labels: { color: "#9c9ca8", font: { family: "DM Mono", size: 10 }, boxWidth: 12 } }
    },
    scales: {
      x: { grid: { color: "#2d2d35" }, ticks: { color: "#9c9ca8", font: { family: "DM Mono", size: 10 } } },
      y: { grid: { color: "#2d2d35" }, ticks: { color: "#9c9ca8", font: { family: "DM Mono", size: 10 } } }
    }
  };

  progressChartInstances.exercise = new Chart(document.getElementById("chart-exercise").getContext("2d"), {
    type: "line",
    data: { labels, datasets: weightDatasets },
    options: chartOpts
  });

  progressChartInstances.volume = new Chart(document.getElementById("chart-volume").getContext("2d"), {
    type: "bar",
    data: { labels, datasets: volumeDatasets },
    options: chartOpts
  });

  const statRows = activeIds.map((id, i) => {
    const ex = state.exercises.find(e => e.id === id);
    const name = ex ? getExerciseName(ex) : id;
    const points = Object.values(exerciseData[id]);
    const record = points.length ? Math.max(...points.map(p => p.maxWeight)) : 0;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    return `<div class="stat-box" style="border-left:3px solid ${color}"><div class="stat-value">${record}kg</div><div class="stat-label">${name}</div></div>`;
  });
  statsCard.innerHTML = statRows.join("");
}

function openLauncher() {
  renderLauncher();
  openModal("modal-launcher");
}

function switchLauncherTab(tab) {
  state.launcherTab = tab;
  $all(".launcher-tab").forEach(button => {
    button.classList.toggle("active", button.dataset.launcherTab === tab);
  });
  $("#launcher-free").classList.toggle("hidden", tab !== "free");
  $("#launcher-program").classList.toggle("hidden", tab !== "program");
  $("#launcher-recent").classList.toggle("hidden", tab !== "recent");
}

function renderProgramSelectOptions() {
  const currentProgramId = $("#program-select").value;
  $("#program-select").innerHTML = `<option value="">${t("select")}</option>` + state.programs.map(program => {
    return `<option value="${program.id}">${program.name}</option>`;
  }).join("");

  if (currentProgramId && state.programs.some(program => program.id === currentProgramId)) {
    $("#program-select").value = currentProgramId;
  }
}

function renderLauncher() {
  switchLauncherTab(state.launcherTab);
  renderProgramSelectOptions();
  renderProgramSessionOptions();

  const recentLogs = state.sessionLogs.slice(0, 6);
  $("#recent-launch-list").innerHTML = recentLogs.length ? recentLogs.map(log => `
    <div class="session-item">
      <div class="session-item-head">
        <div>
          <div class="item-title">${log.sessionName}</div>
          <div class="item-subtitle">${formatDateForUi(log.date)} · ${getSessionTypeLabel(log.type)}</div>
        </div>
        <button class="btn btn-primary btn-sm" data-repeat-launch="${log.id}">${t("startWorkout")}</button>
      </div>
    </div>
  `).join("") : `<div class="card">${t("noRecentSessions")}</div>`;

  $all("[data-repeat-launch]").forEach(button => {
    button.addEventListener("click", () => {
      closeModal("modal-launcher");
      repeatWorkout(button.dataset.repeatLaunch);
    });
  });
}

function renderProgramSessionOptions() {
  const select = $("#program-session-select");
  const programId = $("#program-select").value;
  const program = state.programs.find(item => item.id === programId);
  const sessions = program?.sessions || [];
  const currentSessionId = select.value;

  select.innerHTML = sessions.length ? sessions.map(session => {
    return `<option value="${session.id}">${session.name}</option>`;
  }).join("") : `<option value="">${t("noSessionsYet")}</option>`;

  if (currentSessionId && sessions.some(session => session.id === currentSessionId)) {
    select.value = currentSessionId;
  }
}

function launcherAddProgram() {
  openModal("modal-create-program");
}

function launcherAddSession() {
  const programId = $("#program-select").value;
  if (!programId) {
    showToast(t("chooseProgramFirst"));
    return;
  }

  state.currentProgramId = programId;
  openModal("modal-add-prog-session");
}

function launchFreeWorkout() {
  const sessionName = $("#free-session-name").value.trim() || t("freeSessionFallback");
  const type = $("#free-session-type").value;
  const exerciseIds = state.exercises.filter(item => item.type === type).slice(0, 5).map(item => item.id);

  if (!exerciseIds.length) {
    showToast(t("noCompatibleExercise"));
    return;
  }

  state.workout = buildWorkoutFromExercises({
    sessionName,
    type,
    exerciseIds,
    exercises: state.exercises,
    sessionLogs: state.sessionLogs
  });

  closeModal("modal-launcher");
  setView("workout");
}

function launchProgramWorkout() {
  const programId = $("#program-select").value;
  if (!programId) {
    showToast(t("chooseProgram"));
    return;
  }

  const program = state.programs.find(item => item.id === programId);
  const session = program?.sessions?.find(item => item.id === $("#program-session-select").value);
  if (!session || !session.exerciseIds?.length) {
    showToast(t("noProgrammedSession"));
    return;
  }

  state.workout = buildWorkoutFromExercises({
    sessionName: session.name,
    type: session.type,
    exerciseIds: session.exerciseIds,
    exercises: state.exercises,
    sessionLogs: state.sessionLogs
  });

  closeModal("modal-launcher");
  setView("workout");
}

function repeatWorkout(logId) {
  const log = state.sessionLogs.find(item => item.id === logId);
  if (!log) return;
  state.workout = buildWorkoutFromRecentLog(log, state.exercises);
  setView("workout");
}

function renderWorkout() {
  if (!state.workout) {
    setView("home");
    return;
  }

  if (isWorkoutComplete(state.workout)) {
    finishWorkout();
    return;
  }

  const block = getCurrentBlock(state.workout);
  const currentSet = getCurrentSet(state.workout);
  const exercise = getExerciseById(block.exerciseId, state.exercises);
  const tips = getExerciseTips(exercise?.id, i18n.getLanguage());
  const meta = getExerciseMeta(exercise);
  const displayTip = tips.length > 0 ? tips[0] : (exercise?.tips || "");

  $("#guided-session-name").textContent = state.workout.sessionName;
  $("#guided-progress").textContent = t("exerciseProgress", {
    current: state.workout.currentExerciseIndex + 1,
    total: state.workout.blocks.length
  });
  $("#guided-type-badge").textContent = meta.type || getSessionTypeLabel("other");
  $("#guided-muscle-badge").textContent = meta.muscleFocus || t("muscle");
  $("#guided-exercise-name").textContent = exercise ? getExerciseName(exercise) : t("exerciseFallback");
  $("#guided-exercise-tip").textContent = displayTip;
  $("#guided-set-progress").textContent = t("setProgress", {
    current: state.workout.currentSetIndex + 1,
    total: block.sets.length
  });
  $("#guided-target-reps").textContent = currentSet?.targetReps ?? currentSet?.reps ?? "-";
  $("#rest-time-value").textContent = `${block.restSeconds}s`;
  $("#guided-reps-input").value = currentSet?.reps ?? currentSet?.targetReps ?? 0;
  $("#guided-weight-input").value = currentSet?.weight ?? 0;
}

function handleNext() {
  if (!state.workout) return;

  const reps = Number($("#guided-reps-input").value);
  const weight = Number($("#guided-weight-input").value);
  completeCurrentSet(state.workout, reps, weight);
  startRest(getCurrentBlock(state.workout)?.restSeconds || 60);
  renderWorkout();
}

function skipSetFlow() {
  if (!state.workout) return;
  skipCurrentSet(state.workout);
  renderWorkout();
  showToast(t("setSkipped"));
}

function skipExerciseFlow() {
  if (!state.workout) return;
  skipCurrentExercise(state.workout);
  renderWorkout();
  showToast(t("exerciseSkipped"));
}

function startRest(seconds) {
  stopRest();
  state.restRemaining = seconds;
  $("#rest-bar").classList.remove("hidden");
  updateRestUi();
  state.restInterval = setInterval(() => {
    state.restRemaining -= 1;
    updateRestUi();
    if (state.restRemaining <= 0) {
      stopRest();
      showToast(t("restFinished"));
    }
  }, 1000);
}

function updateRestUi() {
  $("#rest-countdown").textContent = formatDuration(state.restRemaining * 1000);
}

function stopRest() {
  clearInterval(state.restInterval);
  state.restInterval = null;
  $("#rest-bar").classList.add("hidden");
}

function addRest(seconds) {
  state.restRemaining += seconds;
  updateRestUi();
}

function openSimilarModal() {
  if (!state.workout) return;

  const block = getCurrentBlock(state.workout);
  const currentExercise = getExerciseById(block.exerciseId, state.exercises);
  const list = getSimilarExercises(currentExercise, state.exercises, 8);

  $("#similar-list").innerHTML = list.length ? list.map(exercise => {
    const meta = getExerciseMeta(exercise);
    return `
      <div class="exercise-item">
        <div class="exercise-item-head">
          <div>
            <div class="item-title">${getExerciseName(exercise)}</div>
            <div class="item-subtitle">${[meta.type, meta.muscleFocus].filter(Boolean).join(" · ")}</div>
            <div class="small-meta">${[meta.equipment, meta.difficulty].filter(Boolean).join(" · ")}</div>
          </div>
          <button class="btn btn-primary btn-sm" data-replace-id="${exercise.id}">${t("choose")}</button>
        </div>
      </div>
    `;
  }).join("") : `<div class="card">${t("noSimilarExercises")}</div>`;

  $all("[data-replace-id]").forEach(button => {
    button.addEventListener("click", () => {
      replaceCurrentExercise(state.workout, button.dataset.replaceId, state.exercises, state.sessionLogs);
      closeModal("modal-similar");
      renderWorkout();
      showToast(t("exerciseReplaced"));
    });
  });

  openModal("modal-similar");
}

function openExerciseDetails() {
  if (!state.workout) return;
  const block = getCurrentBlock(state.workout);
  const exercise = getExerciseById(block.exerciseId, state.exercises);
  if (!exercise) return;
  renderExerciseDetails(exercise);
  openModal("modal-details");
}

function showExerciseDetails(exerciseId) {
  const exercise = getExerciseById(exerciseId, state.exercises);
  if (!exercise) return;
  renderExerciseDetails(exercise);
  openModal("modal-details");
}

function renderExerciseDetails(exercise) {
  const startImage = loadExerciseImage(exercise, "start");
  const endImage = loadExerciseImage(exercise, "end");
  const similarExercises = getSimilarExercises(exercise, state.exercises, 6);
  const improvedDescription = getImprovedDescription(exercise.id, i18n.getLanguage());
  const description = improvedDescription || exercise.description || "-";
  const tips = getExerciseTips(exercise.id, i18n.getLanguage());
  const tipsHtml = tips.length ? `<ol class="tips-list">${tips.map(item => `<li>${item}</li>`).join("")}</ol>` : "-";
  const meta = getExerciseMeta(exercise);
  const exerciseDisplayName = getExerciseName(exercise);
  const secondaryMuscles = (exercise.secondary_muscles || []).map(item => {
    return `<span class="badge badge-secondary">${translateExerciseValue("muscle_focus", item)}</span>`;
  }).join("") || "-";

  const detailsModal = $("#modal-details");
  if (detailsModal) detailsModal.dataset.currentExerciseId = exercise.id;

  $("#exercise-details").innerHTML = `
    <div class="detail-block">
      <div class="item-title">${exerciseDisplayName}</div>
      <div class="item-subtitle">${[meta.type, meta.muscleFocus, meta.musclePortion].filter(Boolean).join(" · ")}</div>
      <div class="small-meta">${[meta.equipment, meta.difficulty, meta.contractionType].filter(Boolean).join(" · ")}</div>
    </div>
    <div class="detail-grid mb-12">
      <div class="detail-block">
        <div class="meta-label">${t("startMovement")}</div>
        <img class="detail-photo" id="img-detail-start" alt="${t("startMovement")} ${exerciseDisplayName}">
      </div>
      <div class="detail-block">
        <div class="meta-label">${t("endMovement")}</div>
        <img class="detail-photo" id="img-detail-end" alt="${t("endMovement")} ${exerciseDisplayName}">
      </div>
    </div>
    <div class="detail-block">
      <div class="meta-label">${t("description")}</div>
      <div class="description-text">${description}</div>
    </div>
    <div class="detail-block">
      <div class="meta-label">${t("tips")}</div>
      <div>${tipsHtml}</div>
    </div>
    <div class="detail-block">
      <div class="meta-label">${t("secondaryMuscles")}</div>
      <div class="detail-list">${secondaryMuscles}</div>
    </div>
    <div class="detail-block">
      <div class="meta-label">${t("similar")}</div>
      <div class="detail-list">${similarExercises.map(item => `<span class="badge">${getExerciseName(item)}</span>`).join("") || "-"}</div>
    </div>
  `;

  applyImageFallback($("#img-detail-start"), startImage.urls, startImage.fallback);
  applyImageFallback($("#img-detail-end"), endImage.urls, endImage.fallback);
}

function updateUILanguage() {
  applyStaticTranslations();

  if (state.profile) {
    renderHome();
    renderPrograms();
    renderExerciseFilters();
    renderExerciseList();
    renderProgress();

    if (state.currentProgramId) {
      const currentProgram = state.programs.find(item => item.id === state.currentProgramId);
      if (currentProgram) {
        $("#detail-program-title").textContent = currentProgram.name;
        $("#detail-program-desc").textContent = currentProgram.description || "";
        renderProgSessions(currentProgram);
      }
    }
  }

  if (state.workout) {
    renderWorkout();
  }

  const detailsModal = $("#modal-details");
  if (detailsModal && !detailsModal.classList.contains("hidden")) {
    const currentExerciseId = detailsModal.dataset.currentExerciseId;
    if (currentExerciseId) {
      const exercise = getExerciseById(currentExerciseId, state.exercises);
      if (exercise) renderExerciseDetails(exercise);
    }
  }

  const similarModal = $("#modal-similar");
  if (similarModal && !similarModal.classList.contains("hidden")) {
    openSimilarModal();
  }

  const launcherModal = $("#modal-launcher");
  if (launcherModal && !launcherModal.classList.contains("hidden")) {
    renderLauncher();
  }

  const weightModal = $("#modal-weight");
  if (weightModal && !weightModal.classList.contains("hidden")) {
    openWeightModal();
  }

  const manageModal = $("#modal-manage-exercises");
  if (manageModal && !manageModal.classList.contains("hidden")) {
    renderManageExercisesList();
  }
}

function stopWorkout() {
  state.workout = null;
  stopRest();
  closeModal("modal-stop");
  setView("home");
  showToast(t("sessionStopped"));
}

function finishWorkout() {
  const log = buildSessionLogFromWorkout(state.workout, state.exercises);
  DB.saveSessionLog(log);
  state.sessionLogs = DB.getSessionLogs();
  state.workout = null;
  stopRest();
  renderHome();
  setView("home");
  showToast(t("sessionSaved"));
}

init();
