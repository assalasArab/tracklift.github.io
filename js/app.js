import { $, $all, formatDate, formatDuration, showToast, showLoading, openModal, closeModal, loadExerciseImage, applyImageFallback, illustrationHtml, uid } from "./utils.js?v=20261030a";
import { DB } from "./db.js?v=20261030a";
import { Auth } from "./auth.js?v=20261030a";
import { i18n } from "./i18n.js?v=20261030a";
import { EXERCISE_ALIASES } from "./exercise-aliases.js?v=20261030a";
import { muscleName } from "./muscles.js?v=20261030a";
import { openCustomExerciseForm } from "./custom-exercise.js?v=20261030a";
import { getAllMuscleFocus, getAllMusclePortion, getAllContractionTypes, getExerciseById, getSimilarExercises } from "./exercises.js?v=20261030a";
import { ExerciseDBAPI } from "./exercisedb-api.js?v=20261030a";
import { buildWorkoutFromExercises, buildWorkoutFromRecentLog, completeCurrentSet, skipCurrentSet, skipCurrentExercise, replaceCurrentExercise, buildSessionLogFromWorkout, getCurrentBlock, getCurrentSet, isWorkoutComplete, findLatestExerciseLog } from "./workout.js?v=20261030a";
import { renderWeightChart } from "./charts.js?v=20261030a";
import { mountNutrition, unmountNutrition } from "./nutrition.js?v=20261030a";
import { openProgramWizard } from "./program-wizard.js?v=20261030a";
import { muscleMapHtml, muscleChipsHtml, primaryMusclesLabel } from "./muscle-map.js?v=20261030a";
import { bodyMapHtml, exerciseInZone, zoneName, zoneRank } from "./body-map.js?v=20261030a";
import { openIntro } from "./onboarding.js?v=20261030a";
import { openNotionImport, captureNotionRedirect } from "./notion-import.js?v=20261030a";
import { computeStreak, STREAK_MILESTONES } from "./streak.js?v=20261030a";
import { Social } from "./social.js?v=20261030a";
import { mountPotes, unmountPotes, resetPotesView, bindPotes, editMyAvatar, setInvite, showPotesTab } from "./potes.js?v=20261030a";
import { avatarSvg } from "./avatar.js?v=20261030a";
import { Bridge } from "./potes-ui.js?v=20261030a";
import { mountBell, watchLive, renderHomeLine, bindHomeLine } from "./potes-notifs.js?v=20261030a";
import { openFriendPage, openMyProfileAsFriend } from "./potes-friend.js?v=20261030a";
import { openSettings } from "./potes-settings.js?v=20261030a";
import { openProgramShare, openProgramPreview, openProgramCompetition, openCommunity } from "./potes-programs.js?v=20261030a";
import { SharedPrograms } from "./community.js?v=20261030a";
import { buildSharedItems, findRecord, weekSessions, recordHistory, monthKey, programStats } from "./social-stats.js?v=20261030a";

// Retour de la page d'autorisation Notion (#notion_auth=…) : lu avant tout, puis l'URL est nettoyée
let notionReturn = captureNotionRedirect();

// Liens de la partie Potes : ?pote=<pseudo> (invitation) et ?programme=<id> (programme partagé)
const potesLink = (() => {
  const query = new URLSearchParams(location.search);
  const link = { pote: query.get("pote"), programme: query.get("programme") };
  if (link.pote || link.programme) history.replaceState(null, "", location.pathname + location.hash);
  return link;
})();

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
  return (i18n.getLanguage() === "fr" && exercise.name_fr) || exercise.name;
}

function exerciseNameById(id) {
  return getExerciseName(getExerciseById(id, state.exercises));
}

/* Ancienne base (free-exercise-db) → RepDB : on renomme les identifiants dans les programmes et l'historique */
const EXERCISE_DB_VERSION = "repdb-1";
function migrateExerciseIds(data) {
  if (data.exerciseDb === EXERCISE_DB_VERSION) return;
  const map = id => EXERCISE_ALIASES[id] || id;
  (data.programs || []).forEach(program => (program.sessions || []).forEach(session => {
    session.exerciseIds = [...new Set((session.exerciseIds || []).map(map))];
    if (session.plan) session.plan = Object.fromEntries(Object.entries(session.plan).map(([id, plan]) => [map(id), plan]));
  }));
  (data.sessionLogs || []).forEach(log => (log.exercises || []).forEach(ex => { ex.exerciseId = map(ex.exerciseId); }));
  data.exerciseDb = EXERCISE_DB_VERSION;
  DB.saveData(data);
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
    musclePortion: exercise?.muscle_portion ? muscleName(exercise.muscle_portion, i18n.getLanguage()) : "",
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
    exercise?.name_fr,
    primaryMusclesLabel(exercise, "fr"),
    primaryMusclesLabel(exercise, "en"),
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

  $all("[data-i18n-aria]").forEach(node => {
    node.setAttribute("aria-label", t(node.dataset.i18nAria));
  });

  $all("[data-i18n-title]").forEach(node => {
    node.title = t(node.dataset.i18nTitle);
  });

  updateSyncBadge();
}

function init() {
  applyStaticTranslations();
  bindGlobalEvents();
  DB.onSaveState = onSaveState;
  // un enregistrement raté repart dès que le réseau revient
  window.addEventListener("online", () => { if (DB.saveError) DB._saveToCloud(); });
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
    DB.stopListening();
    unmountNutrition();
    unmountPotes();
    resetPotesView();
    Social.reset();
    showLoading(false);
    updateSyncBadge();
    closeProfileDrawer();
    $("#app-screen").classList.add("hidden");
    $("#auth-screen").classList.remove("hidden");
  });
}

function bindGlobalEvents() {
  $("#google-signin-btn").addEventListener("click", handleGoogleSignIn);
$("#email-signin-btn").addEventListener("click", handleEmailSignIn);
  $("#email-signup-btn").addEventListener("click", handleEmailSignUp);
  $("#forgot-password-btn").addEventListener("click", async () => {
    const email = $("#auth-email-input").value.trim();
    if (!email) { showToast(t("resetNeedEmail")); $("#auth-email-input").focus(); return; }
    try { await Auth.resetPassword(email); showToast(t("resetSent")); }
    catch { showToast(t("resetError")); }
  });

  $("#profile-btn").addEventListener("click", openProfileDrawer);
  $("#drawer-close-btn").addEventListener("click", closeProfileDrawer);
  $("#drawer-overlay").addEventListener("click", closeProfileDrawer);
  $("#drawer-logout-btn").addEventListener("click", () => { closeProfileDrawer(); handleLogout(); });
  $("#drawer-language-btn").addEventListener("click", () => openModal("modal-language"));
  $("#drawer-progress-btn").addEventListener("click", () => { closeProfileDrawer(); setView("progress"); });
  // partie Potes et avatar
  $("#drawer-potes-btn").addEventListener("click", () => { closeProfileDrawer(); setView("potes"); });
  ["#drawer-avatar", "#drawer-avatar-link"].forEach(sel => $(sel).addEventListener("click", () => { closeProfileDrawer(); editMyAvatar(); }));
  bindPotes($("#view-potes"));
  setupPotesBridge();
  mountBell($("#bell-btn"));
  watchLive();
  bindHomeLine($("#potes-line"));
  $("#community-btn").addEventListener("click", openCommunity);
  $("#programs-list").addEventListener("click", event => {
    if (event.target.closest("[data-groups-go]")) { event.stopPropagation(); goToGroups(); return; }
    const share = event.target.closest("[data-share-program]");
    const update = event.target.closest("[data-program-update]");
    if (share) { event.stopPropagation(); openProgramShare(share.dataset.shareProgram); }
    if (update) { event.stopPropagation(); openProgramPreview(update.dataset.programUpdate); }
  }, true);
  Social.onChange(onSocialChange);
  $("#drawer-about-btn").addEventListener("click", toggleDrawerAbout);
  $("#drawer-exercisedb-btn").addEventListener("click", toggleDrawerExerciseDB);
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

  $("#perf-card").addEventListener("click", event => {
    if (event.target.closest("[data-open-wizard]")) openWizard();
  });
  $("#guided-program-btn").addEventListener("click", openWizard);
  $("#drawer-wizard-btn").addEventListener("click", () => { closeProfileDrawer(); openWizard(); });
  $("#drawer-notion-btn").addEventListener("click", () => { closeProfileDrawer(); openNotion(); });
  $("#drawer-intro-btn").addEventListener("click", () => { closeProfileDrawer(); openIntroFlow({ replay: true }); });

  $("#perf-card").addEventListener("change", event => {
    if (event.target.id !== "perf-program") return;
    setPerfProgramId(event.target.value);
    renderPerfCard();
  });

  $("#open-launcher-btn").addEventListener("click", openLauncher);
  $("#open-weight-btn").addEventListener("click", openWeightModal);
  $("#hero-start-btn").addEventListener("click", startHeroSession);
  $("#recent-more-btn").addEventListener("click", () => { state.showAllSessions = !state.showAllSessions; renderHome(); });
  $("#streak-pill").addEventListener("click", focusStreakCard);
  $("#streak-card").addEventListener("click", event => {
    if (event.target.closest("[data-streak-save]")) saveStreakWeight();
    if (event.target.closest("[data-streak-edit]")) { state.streakEditing = true; renderStreak(); focusField("#streak-input"); }
    if (event.target.closest("[data-streak-cancel]")) { state.streakEditing = false; renderStreak(); }
    if (event.target.closest("[data-kcal-save]")) saveKcal();
    if (event.target.closest("[data-kcal-edit]")) { state.kcalEditing = true; renderStreak(); focusField("#kcal-input"); }
    if (event.target.closest("[data-kcal-cancel]")) { state.kcalEditing = false; renderStreak(); }
    if (event.target.closest("[data-streak-history]")) openWeightModal();
  });
  $("#streak-card").addEventListener("keydown", event => {
    if (event.key === "Enter" && event.target.id === "streak-input") saveStreakWeight();
    if (event.key === "Enter" && event.target.id === "kcal-input") saveKcal();
    if (event.key === "Escape" && (state.streakEditing || state.kcalEditing)) { state.streakEditing = state.kcalEditing = false; renderStreak(); }
  });
  $("#save-weight-btn").addEventListener("click", saveWeight);
  $("#open-export-btn").addEventListener("click", () => { closeProfileDrawer(); openModal("modal-export"); });
  $("#export-perf-btn").addEventListener("click", () => { closeModal("modal-export"); exportPerfExcel(); });
  $("#export-programs-btn").addEventListener("click", () => { closeModal("modal-export"); exportProgramsExcel(); });
  $("#export-gmail-btn").addEventListener("click", () => { closeModal("modal-export"); exportAndSendGmail(); });
  $("#export-json-btn").addEventListener("click", () => { closeModal("modal-export"); exportData(); });
  $("#import-file-input").addEventListener("change", handleImportFile);
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

  // chaque nouvelle recherche ou filtre repart des 30 premiers résultats
  const resetExerciseList = () => { state.exerciseLimit = EXERCISE_PAGE; renderExerciseList(); };
  $("#exercise-search").addEventListener("input", resetExerciseList);
  ["#filter-type", "#filter-portion", "#filter-contraction"].forEach(sel => $(sel).addEventListener("change", () => { state.exerciseLimit = EXERCISE_PAGE; }));
  $("#filter-muscle").addEventListener("change", () => { state.exerciseLimit = EXERCISE_PAGE; });
  $("#filters-toggle").addEventListener("click", () => {
    const panel = $("#ex-filters");
    panel.hidden = !panel.hidden;
    $("#filters-toggle").setAttribute("aria-expanded", String(!panel.hidden));
  });
  // carte du corps : toucher un muscle filtre la liste, le retoucher l'enlève
  const pickZone = key => {
    state.bodyZone = state.bodyZone === key ? null : key;
    resetExerciseList();
    // sur téléphone la liste est sous la carte : on descend jusqu'au muscle choisi et ses exercices
    const list = $("#exercise-list");
    if (state.bodyZone && list.getBoundingClientRect().top > window.innerHeight - 160) {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      $("#body-zone-bar").scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
    }
  };
  $("#body-map").addEventListener("click", event => {
    const zone = event.target.closest("[data-zone]");
    if (zone) pickZone(zone.dataset.zone);
  });
  $("#body-map").addEventListener("keydown", event => {
    const zone = event.target.closest("[data-zone]");
    if (!zone || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    pickZone(zone.dataset.zone);
  });
  $("#body-zone-clear").addEventListener("click", () => pickZone(null));
  $("#filters-reset").addEventListener("click", () => {
    state.bodyZone = null;
    ["#filter-type", "#filter-muscle", "#filter-portion", "#filter-contraction"].forEach(sel => { $(sel).value = ""; });
    renderExerciseFilters();
    resetExerciseList();
  });
  $("#exercise-more-btn").addEventListener("click", () => { state.exerciseLimit += EXERCISE_PAGE; renderExerciseList(); });
  $("#exercise-list").addEventListener("click", event => {
    const row = event.target.closest("[data-details-id]");
    if (row) showExerciseDetails(row.dataset.detailsId);
  });
  $("#create-exercise-btn").addEventListener("click", () => openCustomExercise());
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
  $("#stop-workout-btn").addEventListener("click", () => {
    const anyDone = state.workout?.blocks.some(block => block.sets.some(set => set.status === "done"));
    $("#finish-save-btn").classList.toggle("hidden", !anyDone);
    $("#confirm-stop-btn").textContent = t(anyDone ? "abandonWorkout" : "quitWorkout");
    openModal("modal-stop");
  });
  $("#confirm-stop-btn").addEventListener("click", stopWorkout);
  document.addEventListener("click", event => {
    const go = event.target.closest("[data-view-go]");
    if (go) setView(go.dataset.viewGo);
  });
  $("#finish-save-btn").addEventListener("click", () => {
    closeModal("modal-stop");
    const anyDone = state.workout?.blocks.some(block => block.sets.some(set => set.status === "done"));
    if (anyDone) finishWorkout(); else stopWorkout();
  });
  $("#view-workout").addEventListener("click", event => {
    const btn = event.target.closest("[data-step-for]");
    if (btn) stepInput(btn.dataset.stepFor, Number(btn.dataset.step));
  });
  $("#rest-skip-btn").addEventListener("click", stopRest);
  $("#rest-add-btn").addEventListener("click", () => addRest(30));

  $all("[data-view]").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  $all("[data-close]").forEach(button => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
  });

  // clic sur le fond : ferme la fenêtre, sauf la création de programme (trop facile de tout perdre)
  document.addEventListener("click", event => {
    if (event.target.classList.contains("modal") && !event.target.classList.contains("wz-modal")) {
      event.target.classList.add("hidden");
    }
  });

  // ExerciseDB API key & sync
  const exercisedbKeyInput = $("#exercisedb-api-key");
  if (exercisedbKeyInput) {
    exercisedbKeyInput.value = ExerciseDBAPI.getApiKey();
    exercisedbKeyInput.addEventListener("change", () => {
      ExerciseDBAPI.setApiKey(exercisedbKeyInput.value);
      showToast(t("apiKeySaved"));
    });
  }

  const syncBtn = $("#exercisedb-sync-btn");
  if (syncBtn) syncBtn.addEventListener("click", syncExerciseDB);

  const clearBtn = $("#exercisedb-clear-btn");
  if (clearBtn) clearBtn.addEventListener("click", () => {
    ExerciseDBAPI.clearCache();
    state.exercises.forEach(ex => { delete ex.gifUrl; });
    updateExerciseDBStatus();
    showToast(t("exercisedbCacheCleared"));
  });

  updateExerciseDBStatus();
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

async function handleEmailSignIn() {
  const email = $("#auth-email-input").value.trim();
  const password = $("#auth-password-input").value;
  if (!email || !password) { showAuthError(t("emailRequired")); return; }
  try {
    showLoading(true);
    await Auth.signInWithEmail(email, password);
  } catch (error) {
    showLoading(false);
    showAuthError(error.message || t("authError"));
  }
}

async function handleEmailSignUp() {
  const email = $("#auth-email-input").value.trim();
  const password = $("#auth-password-input").value;
  if (!email || !password) { showAuthError(t("emailRequired")); return; }
  if (password.length < 6) { showAuthError(t("passwordTooShort")); return; }
  try {
    showLoading(true);
    await Auth.signUpWithEmail(email, password);
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
  $("#profile-drawer").inert = false;
  $("#profile-drawer").removeAttribute("aria-hidden");
  $("#drawer-overlay").classList.remove("hidden");
  requestAnimationFrame(() => {
    $("#drawer-overlay").classList.add("open");
    $("#profile-drawer").classList.add("open");
  });
}

function closeProfileDrawer() {
  $("#drawer-overlay").classList.remove("open");
  $("#profile-drawer").classList.remove("open");
  $("#profile-drawer").inert = true;
  $("#profile-drawer").setAttribute("aria-hidden", "true");
  setTimeout(() => $("#drawer-overlay").classList.add("hidden"), 300);
}

function toggleDrawerAbout() {
  const section = $("#drawer-about-section");
  section.classList.toggle("hidden");
  if (!section.classList.contains("hidden")) {
    renderAboutCurrentStats();
  }
}

function toggleDrawerExerciseDB() {
  const section = $("#drawer-exercisedb-section");
  if (section) {
    section.classList.toggle("hidden");
    if (!section.classList.contains("hidden")) {
      updateExerciseDBStatus();
      const keyInput = $("#exercisedb-api-key");
      if (keyInput) keyInput.value = ExerciseDBAPI.getApiKey();
    }
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
      const name = exerciseNameById(ex.exerciseId) || ex.exerciseName || ex.exerciseId;
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
        backgroundColor: "rgba(122,132,80,0.3)",
        borderColor: "#7a8450",
        borderWidth: 2,
        pointBackgroundColor: "#ff7a00",
        pointBorderColor: "#ff7a00",
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
          grid: { color: "rgba(76,46,5,0.12)" },
          angleLines: { color: "rgba(76,46,5,0.12)" },
          pointLabels: { color: "#6b5232", font: { family: "Poppins", size: 11 } }
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
    migrateExerciseIds(data);
    const profile = {
      ...(data.profile || {}),
      id: firebaseUser.uid,
      email: firebaseUser.email,
      name: firebaseUser.displayName || firebaseUser.email,
      photoURL: firebaseUser.photoURL || null,
      createdAt: data.profile?.createdAt || Date.now(),
      onboardingDone: data.profile?.onboardingDone || false,
      trainingProfile: data.profile?.trainingProfile || null,
      introSeen: data.profile?.introSeen || false
    };
    // on n'écrit au démarrage que si le profil a vraiment changé (une vieille fenêtre ne réécrit plus tout)
    if (JSON.stringify(profile) !== JSON.stringify(data.profile)) {
      data.profile = profile;
      DB.saveData(data);
    }
    if (DB.loadFailed) setTimeout(() => showToast(t("dataLoadFailed")), 600);

    state.user = { id: firebaseUser.uid, email: firebaseUser.email, name: firebaseUser.displayName };
    state.profile = DB.getProfile();
    state.programs = DB.getPrograms();
    state.exercises = DB.getExercises();
    state.sessionLogs = DB.getSessionLogs();
    state.weightLog = DB.getWeightLog();

    renderMyAvatar();
    $("#drawer-name").textContent = firebaseUser.displayName || "";
    $("#drawer-email").textContent = firebaseUser.email || "";
    const createdAt = data.profile?.createdAt;
    if (createdAt) {
      $("#drawer-since").textContent = `${t("memberSince")} ${formatDateForUi(createdAt)}`;
    }
    $("#auth-screen").classList.add("hidden");
    $("#app-screen").classList.remove("hidden");

    // L'API ExerciseDB gratuite ne renvoie plus que 25 exercices : on purge les GIF mal associés.
    // Les illustrations viennent désormais de free-exercise-db (voir utils.js).
    ExerciseDBAPI.clearCache();

    applyStaticTranslations();
    renderAll();
    // changements faits dans une autre fenêtre ou sur un autre appareil : repris en direct
    DB.listen(onRemoteData);
    // partie Potes : chargée à côté, sans retarder l'appli ; une erreur la laisse simplement de côté
    Social.load(firebaseUser.uid);

    if (notionReturn) {
      const back = notionReturn;
      notionReturn = null;
      if (back.ok) {
        DB.setNotion(back.connection);
        showToast(t("notionConnected"));
      }
      if (!state.profile?.onboardingDone) state.profile = DB.updateProfile({ onboardingDone: true });
      setTimeout(() => openNotion(back.ok ? "" : back.error), 300);
    } else if (!state.sessionLogs.length && !state.programs.length && !state.profile?.onboardingDone) {
      // première connexion : présentation de l'appli, puis création du programme
      setTimeout(() => (state.profile?.introSeen ? openWizard() : openIntroFlow()), 450);
    } else {
      const streak = computeStreak(state.weightLog);
      if (streak.atRisk) setTimeout(() => showToast(t("streakRisk", { count: streak.current })), 900);
    }
  } catch (error) {
    showAuthError(`${t("loadErrorPrefix")}: ${error.message}`);
  } finally {
    showLoading(false);
  }
}

/** Données changées ailleurs (autre fenêtre, autre appareil) : on se remet à jour sans rien perdre */
function onRemoteData(kind) {
  state.profile = DB.getProfile();
  state.programs = DB.getPrograms();
  state.exercises = DB.getExercises();
  state.sessionLogs = DB.getSessionLogs();
  state.weightLog = DB.getWeightLog();
  const view = state.activeView;
  if (view === "home") renderHome();
  else renderStreak();
  if (view === "programs") renderPrograms();
  if (view === "program-detail") {
    const program = state.programs.find(item => item.id === state.currentProgramId);
    if (program) renderProgSessions(program);
  }
  if (view === "progress") renderProgress();
  if (kind === "main" || kind === "days") Social.queuePublish();
}

/** Enregistrement impossible : on le dit (une seule fois), et on réessaie au retour du réseau */
let saveWarned = false;
function onSaveState(stateName, error) {
  if (stateName === "ok") { if (saveWarned) showToast(t("dataSavedAgain")); saveWarned = false; return; }
  if (saveWarned) return;
  saveWarned = true;
  if (stateName === "blocked") showToast(t("dataLoadFailed"));
  else showToast(t("dataSaveFailed", { code: error?.code || "?" }));
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
  document.body.classList.toggle("in-workout", view === "workout");
  // chaque onglet s'ouvre en haut de page
  window.scrollTo(0, 0);

  $all(".view").forEach(node => node.classList.remove("active"));
  const navView = view === "progress" ? "home" : view;
  $all(".nav-btn").forEach(node => node.classList.toggle("active", node.dataset.view === navView));

  const activeNode = document.getElementById(`view-${view}`);
  if (activeNode) activeNode.classList.add("active");

  if (view === "home") renderHome();
  if (view === "programs") renderPrograms();
  if (view === "exercises") renderExerciseList();
  if (view === "progress") renderProgress();
  if (view === "workout") renderWorkout();
  if (view === "nutrition") renderNutrition();
  if (view === "potes") mountPotes($("#view-potes"));
  else unmountPotes();
}

/* ─── Partie Potes : branchements avec le reste de l'appli ─── */
/** Textes venus d'autres utilisateurs (programmes, exercices) : sans balises, avant d'entrer dans tes données */
function cleanForeign(value, max = 80) {
  return String(value ?? "").replace(/[<>"'`&]/g, "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}
const SESSION_TYPES = ["push", "pull", "legs", "full", "other"];
const cleanList = list => (Array.isArray(list) ? list : []).map(item => cleanForeign(item, 30)).filter(Boolean).slice(0, 8);

/** Exercice venu d'un autre (communauté ou programme partagé) → exercice perso */
function foreignExercise(ex, extra) {
  return {
    id: `custom-${uid()}`,
    name: cleanForeign(ex.name, 60) || "exercice",
    name_fr: cleanForeign(ex.name, 60) || "exercice",
    type: SESSION_TYPES.includes(ex.type) ? ex.type : "other",
    muscle_focus: cleanForeign(ex.muscle_focus, 30) || "autre",
    muscle_portion: ex.muscle_portion ? cleanForeign(ex.muscle_portion, 30) : null,
    contraction_type: ex.contraction_type ? cleanForeign(ex.contraction_type, 30) : null,
    primary_muscles: cleanList(ex.primary_muscles),
    secondary_muscles: cleanList(ex.secondary_muscles),
    secondary_detail: [],
    equipment: cleanForeign(ex.equipment, 30) || "autre",
    difficulty: "intermediaire",
    bodyweight: !!ex.bodyweight,
    unilateral: false,
    description: cleanForeign(ex.description, 400),
    instructions: [],
    tips: [],
    img: null,
    similar_exercises: [],
    custom: true,
    createdAt: Date.now(),
    ...extra
  };
}

/** Séances d'un programme partagé → séances locales (exercices inconnus écartés, charges à régler) */
function sessionsFromShared(shared) {
  const idFor = {};
  for (const custom of shared.customs || []) {
    const tag = `${shared.id}:${custom.id}`;
    const existing = DB.getCustomExercises().find(ex => ex.sharedFrom === tag);
    idFor[custom.id] = (existing || DB.saveCustomExercise(foreignExercise(custom, { sharedFrom: tag }))).id;
  }
  state.exercises = DB.getExercises();
  const known = id => idFor[id] || (getExerciseById(id, state.exercises) ? id : null);
  return (shared.sessions || []).slice(0, 14).map(session => {
    const exerciseIds = [];
    const plan = {};
    for (const id of session.exerciseIds || []) {
      const real = known(id);
      if (!real || exerciseIds.includes(real)) continue;
      exerciseIds.push(real);
      const p = session.plan?.[id];
      if (p) plan[real] = {
        sets: Math.min(12, Math.max(1, Number(p.sets) || 3)),
        reps: Math.min(100, Math.max(1, Number(p.reps) || 10)),
        weight: 0,
        ...(Array.isArray(p.setList) ? { setList: p.setList.slice(0, 12).map(item => ({ reps: Number(item.reps) || 0, weight: 0, kind: ["warmup", "drop", "work"].includes(item.kind) ? item.kind : "work" })) } : {})
      };
    }
    return { id: uid(), name: cleanForeign(session.name, 40) || t("session"), type: SESSION_TYPES.includes(session.type) ? session.type : "other", exerciseIds, plan };
  });
}

function joinSharedProgram(shared) {
  const saved = { id: uid(), name: cleanForeign(shared.name) || t("program"), description: cleanForeign(shared.description, 300), createdAt: Date.now(), sessions: sessionsFromShared(shared) };
  DB.addProgram(saved);
  state.programs = DB.getPrograms();
  renderPrograms();
  return saved.id;
}

function updateProgramCopy(localId, shared) {
  const data = DB.getData();
  const program = data.programs.find(p => p.id === localId);
  if (!program) return;
  program.name = cleanForeign(shared.name) || program.name;
  program.description = cleanForeign(shared.description, 300);
  program.sessions = sessionsFromShared(shared);
  DB.saveData(data);
  state.programs = DB.getPrograms();
  state.programUpdates?.delete(localId);
  renderPrograms();
}

/** Mes chiffres du classement, calculés sur mes données (les mêmes que ceux publiés) */
function mySocialStats() {
  const month = monthKey(Date.now());
  return {
    sessions: weekSessions(state.sessionLogs).length,
    streak: computeStreak(state.weightLog).current,
    records: recordHistory(state.sessionLogs).filter(r => monthKey(r.date) === month).length
  };
}

function setupPotesBridge() {
  Object.assign(Bridge, {
    nameOf: id => exerciseNameById(id) || id,
    getPrograms: () => state.programs,
    getCustomExercises: () => DB.getCustomExercises(),
    translate: (category, value) => translateExerciseValue(category, value),
    sessionTypeLabel: type => getSessionTypeLabel(type),
    myStats: mySocialStats,
    programStats: localId => programStats(state.sessionLogs, localId),
    openFriend: openFriendPage,
    openSettings,
    openMyProfile: openMyProfileAsFriend,
    openProgram: openProgramPreview,
    goPotes: tab => { setView("potes"); if (tab) showPotesTab(tab); },
    openProgramDetail: localId => { if (state.programs.some(p => p.id === localId)) openProgramDetail(localId); },
    newProgram: then => openWizard({ afterCreate: then }),
    joinProgram: joinSharedProgram,
    updateProgramCopy,
    addCommunityExercise: ex => { DB.saveCustomExercise(foreignExercise(ex, { communityId: ex.id })); refreshExercises(); },
    refresh: () => { renderPrograms(); renderHome(); }
  });
  // le résumé partagé : SEULEMENT ce que l'utilisateur a choisi de montrer
  Social.summaryProvider = () => buildSharedItems({
    share: Social.share,
    board: Social.board,
    weeklyGoal: Social.weeklyGoal,
    logs: state.sessionLogs,
    weightLog: state.weightLog,
    program: getNextSession()?.program || state.programs[0] || null,
    nutrition: DB.getNutrition(),
    sharedPrograms: SharedPrograms.publishedList(state.programs),
    nameOf: id => exerciseNameById(id) || id
  });
}

let socialSignature = "";
function onSocialChange() {
  renderMyAvatar();
  $("#community-btn").classList.toggle("hidden", !Social.joined);
  if (state.activeView === "home") renderHomeLine($("#potes-line"));
  // programmes : étiquettes de partage seulement si elles ont changé
  const signature = JSON.stringify([Social.loaded, Social.joined, SharedPrograms.shares, SharedPrograms.joined, SharedPrograms.competing, Social.invitesIn.length]);
  if (signature !== socialSignature) {
    socialSignature = signature;
    renderPrograms();
    checkProgramUpdates();
    // page d'un programme ouverte : la carte « compétition » suit
    const open = state.activeView === "program-detail" && state.programs.find(item => item.id === state.currentProgramId);
    if (open) renderProgSessions(open);
  }
  // liens ouverts avant la connexion : traités une fois la partie Potes chargée
  if (Social.loaded && (potesLink.pote || potesLink.programme)) {
    const { pote, programme } = potesLink;
    potesLink.pote = potesLink.programme = null;
    if (pote && !Social.error) { setView("potes"); setInvite(pote); }
    if (programme) setTimeout(() => openProgramPreview(programme), pote ? 400 : 0);
  }
}

/** Programmes suivis : une nouvelle version chez l'auteur ? (vérifié une fois par ouverture) */
async function checkProgramUpdates() {
  if (!Social.joined) return;
  state.programUpdates = state.programUpdates || new Set();
  state.programChecked = state.programChecked || new Set();
  for (const [id, entry] of Object.entries(SharedPrograms.joined)) {
    if (state.programChecked.has(id)) continue;
    state.programChecked.add(id);
    const shared = await SharedPrograms.get(id);
    if (shared && shared.version > entry.version) { state.programUpdates.add(entry.localId); renderPrograms(); }
  }
}

/** Après une séance : records et objectif de la semaine pour les potes (si partagés), puis résumé à jour */
function shareSessionWithPotes(recap) {
  if (!Social.joined) return;
  for (const record of recap.records.slice(0, 5)) Social.postEvent("record", { name: String(record.name || "").slice(0, 60), weight: record.weight, gain: record.gain });
  const count = weekSessions(state.sessionLogs).length;
  if (count === Social.weeklyGoal) Social.postEvent("weekGoal", { count, goal: Social.weeklyGoal });
  Social.queuePublish();
  pushCompetitionStats();
}

/** Compétitions de programmes partagés : mes chiffres (nombres seulement) à jour */
function pushCompetitionStats() {
  if (!Social.joined || !Object.keys(SharedPrograms.competing).length) return;
  SharedPrograms.pushStats(shareId => {
    const localId = SharedPrograms.localIdOf(shareId);
    return localId ? programStats(state.sessionLogs, localId) : null;
  }).catch(() => {});
}

/** Avatar dans le bouton profil et le tiroir ; la lettre du nom tant qu'il n'y a pas d'avatar */
function renderMyAvatar() {
  const avatar = Social.avatar;
  const initial = String(state.user?.name || state.user?.email || "t").slice(0, 1);
  const btn = $("#profile-btn");
  const drawerAvatar = $("#drawer-avatar");
  btn.classList.toggle("has-avatar", !!avatar);
  drawerAvatar.classList.toggle("has-avatar", !!avatar);
  btn.setAttribute("aria-label", t("profile"));
  if (avatar) {
    btn.innerHTML = avatarSvg(avatar, { size: 38 });
    drawerAvatar.innerHTML = avatarSvg(avatar, { size: 84 });
  } else {
    btn.textContent = initial;
    drawerAvatar.textContent = initial;
  }
  $("#drawer-avatar-link").textContent = t(avatar ? "avatarEdit" : "avatarCreate");
  const pseudo = $("#drawer-pseudo");
  pseudo.classList.toggle("hidden", !Social.joined);
  pseudo.textContent = Social.joined ? t("potesPseudo", { name: Social.username }) : "";
}

function renderNutrition() {
  mountNutrition($("#view-nutrition"), {
    load: () => DB.getNutrition(),
    save: profile => DB.saveNutrition(profile),
    getLatestWeight: () => {
      const last = state.weightLog[state.weightLog.length - 1];
      return last ? last.weight : null;
    }
  });
}

// ─── Performances moyennes (par programme) ──────────────
const PERF_PROGRAM_KEY = "tracklift_perf_program";

function getPerfProgramId() {
  try { return localStorage.getItem(PERF_PROGRAM_KEY) || ""; } catch { return ""; }
}

function setPerfProgramId(id) {
  try { localStorage.setItem(PERF_PROGRAM_KEY, id); } catch { /* stockage indisponible */ }
}

// Les séances récentes portent leur programId ; les plus anciennes sont rattachées par le nom de séance.
function logBelongsToProgram(log, program) {
  if (log.programId) return log.programId === program.id;
  const target = normalizeText(log.sessionName);
  return (program.sessions || []).some(session => normalizeText(session.name) === target);
}

/** une séance compte dans les statistiques à partir de 3 séries faites (pas les essais ni les abandons) */
function countsInStats(log) {
  return (log.exercises || []).reduce((n, ex) => n + (ex.sets || []).filter(set => set.status === "done").length, 0) >= 3;
}

function computePerformance(logs) {
  logs = logs.filter(countsInStats);
  if (!logs.length) return null;
  let doneSets = 0, totalSets = 0, totalReps = 0, loadSum = 0, loadCount = 0, durationSum = 0, durationCount = 0;

  const perSession = logs.map(log => {
    let volume = 0, sets = 0;
    (log.exercises || []).forEach(exercise => (exercise.sets || []).forEach(set => {
      totalSets++;
      if (set.status !== "done") return;
      const reps = Number(set.reps) || 0;
      const weight = Number(set.weight) || 0;
      sets++;
      totalReps += reps;
      volume += reps * weight;
      if (weight > 0) { loadSum += weight; loadCount++; }
    }));
    doneSets += sets;
    if ((log.durationMs || 0) > 60000) { durationSum += log.durationMs; durationCount++; }
    return { date: log.date, volume, sets, name: log.sessionName };
  }).sort((a, b) => a.date - b.date);

  const n = perSession.length;
  const weeks = Math.max(1, (Date.now() - perSession[0].date) / (7 * 864e5));
  const avg = list => list.reduce((sum, item) => sum + item.volume, 0) / Math.max(1, list.length);
  const third = Math.max(1, Math.floor(n / 3));
  const firstAvg = avg(perSession.slice(0, third));
  const progression = n >= 4 && firstAvg > 0 ? (avg(perSession.slice(-third)) - firstAvg) / firstAvg * 100 : null;

  return {
    sessions: n,
    perWeek: n / weeks,
    avgDurationMs: durationCount ? durationSum / durationCount : null,
    avgVolume: avg(perSession),
    avgSets: doneSets / n,
    avgLoad: loadCount ? loadSum / loadCount : null,
    avgReps: doneSets ? totalReps / doneSets : null,
    completion: totalSets ? doneSets / totalSets : null,
    progression,
    series: perSession.slice(-12)
  };
}

function formatNumber(value, digits = 0) {
  return Number(value).toLocaleString(i18n.getLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function perfSparkline(series) {
  if (series.length < 2) return "";
  const W = 300, H = 56, gap = 3;
  const max = Math.max(...series.map(item => item.volume), 1);
  const barW = (W - gap * (series.length - 1)) / series.length;
  const bars = series.map((item, index) => {
    const h = Math.max(3, item.volume / max * (H - 4));
    const x = index * (barW + gap);
    const label = `${formatDateForUi(item.date)} · ${item.name} · ${formatNumber(item.volume)} kg`;
    return `<rect class="perf-bar${index === series.length - 1 ? " perf-bar-last" : ""}" x="${x.toFixed(1)}" y="${(H - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3"><title>${label}</title></rect>`;
  }).join("");
  return `<svg class="perf-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${t("perfTrend", { count: series.length })}">${bars}</svg>`;
}

function renderPerfCard() {
  const container = $("#perf-card");
  if (!container) return;

  let programId = getPerfProgramId();
  const program = state.programs.find(item => item.id === programId);
  if (!program) programId = "";
  const logs = program ? state.sessionLogs.filter(log => logBelongsToProgram(log, program)) : state.sessionLogs;
  const perf = computePerformance(logs);
  const levelLabel = state.profile?.trainingProfile?.levelLabel || "";

  const options = [`<option value="">${t("perfAllPrograms")}</option>`]
    .concat(state.programs.map(item => `<option value="${item.id}" ${item.id === programId ? "selected" : ""}>${item.name}</option>`))
    .join("");

  const head = `
    <div class="perf-head">
      <div>
        <div class="perf-title">${t("perfTitle")}</div>
        <div class="perf-sub">${perf ? t("perfSessionsCount", { count: perf.sessions }) : t("perfAverages")}</div>
        ${levelLabel ? `<span class="level-chip">${t("levelChip", { level: levelLabel })}</span>` : ""}
      </div>
      <select id="perf-program" class="perf-select" aria-label="${t("program")}">${options}</select>
    </div>`;

  if (!perf) {
    const hasPrograms = state.programs.length > 0;
    container.innerHTML = `${head}
      <div class="perf-empty">${hasPrograms ? t("perfNoData") : t("perfStartIntro")}</div>
      <div class="perf-cta">
        <button class="btn ${hasPrograms ? "btn-ghost" : "btn-primary"} btn-sm" data-open-wizard>${hasPrograms ? t("wizardRedo") : t("wizardStart")}</button>
      </div>`;
    return;
  }

  const dash = "—";
  const tiles = [
    { label: t("perfPerWeek"), value: formatNumber(perf.perWeek, 1), unit: "" },
    { label: t("perfDuration"), value: perf.avgDurationMs ? formatNumber(perf.avgDurationMs / 60000) : dash, unit: perf.avgDurationMs ? "min" : "" },
    { label: t("perfVolume"), value: formatNumber(perf.avgVolume), unit: "kg" },
    { label: t("perfCompletion"), value: perf.completion !== null ? formatNumber(perf.completion * 100) : dash, unit: perf.completion !== null ? "%" : "" }
  ];

  let progressHtml = "";
  if (perf.progression !== null) {
    const up = perf.progression >= 0;
    progressHtml = `<span class="perf-progress ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${up ? "+" : ""}${formatNumber(perf.progression)} %</span>`;
  }

  container.innerHTML = `
    ${head}
    <div class="perf-grid">
      ${tiles.map(tile => `
        <div class="perf-tile">
          <div class="perf-value">${tile.value}${tile.unit ? `<small>${tile.unit}</small>` : ""}</div>
          <div class="perf-label">${tile.label}</div>
        </div>`).join("")}
    </div>
    ${perf.series.length >= 2 ? `
    <div class="perf-trend">
      <div class="perf-trend-head">
        <span>${t("perfTrend", { count: perf.series.length })}</span>
        ${progressHtml ? `<span class="perf-trend-right">${t("perfProgress")} ${progressHtml}</span>` : ""}
      </div>
      ${perfSparkline(perf.series)}
    </div>` : ""}
    <button type="button" class="btn btn-surface btn-block perf-more" data-view-go="progress">${t("seeProgress")}</button>
  `;
}

function openWizard({ afterCreate } = {}) {
  const last = state.weightLog[state.weightLog.length - 1];
  openProgramWizard({
    exercises: state.exercises,
    nameOf: getExerciseName,
    bodyweight: last ? last.weight : "",
    createExercise: (name, done) => openCustomExercise({ name, onCreated: done }),
    onNotion: () => setTimeout(() => openNotion(), 50),
    // brouillon propre à chaque compte (un téléphone peut servir à plusieurs personnes)
    draftKey: state.user ? `tl-wizard-draft-${state.user.id}` : null,
    showDetails: exerciseId => {
      const detailsModal = $("#modal-details");
      if (detailsModal) detailsModal.style.zIndex = "60";
      showExerciseDetails(exerciseId);
    },
    onCreate: (generated, answers) => {
      const program = {
        id: uid(),
        name: generated.name,
        description: generated.description,
        createdAt: Date.now(),
        generated: true,
        sessions: generated.sessions.map(session => ({ id: uid(), ...session }))
      };
      DB.addProgram(program);
      state.profile = DB.updateProfile({ onboardingDone: true, trainingProfile: answers });
      state.programs = DB.getPrograms();
      // le poids saisi dans le questionnaire allume la flamme du jour
      const bodyweight = Number(answers.bodyweight);
      if (bodyweight >= 20 && bodyweight <= 300 && !computeStreak(state.weightLog).doneToday) logWeight(bodyweight, { silent: true });
      setPerfProgramId(program.id);
      renderHome();
      renderPrograms();
      showToast(t("wizardCreated"));
      // créé depuis « mettre un programme en commun » : on enchaîne sur la mise en commun
      if (afterCreate) setTimeout(() => afterCreate(program.id), 300);
    },
    onDismiss: () => {
      if (!state.profile?.onboardingDone) state.profile = DB.updateProfile({ onboardingDone: true });
    }
  });
}

// ─── Exercices personnels ───────────────────────────────
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function refreshExercises() {
  state.exercises = DB.getExercises();
  state.programs = DB.getPrograms();
  renderExerciseFilters();
  renderExerciseList();
}

/** opts: { exercise (à modifier), name (pré-rempli), onCreated(exercise) } */
function openCustomExercise(opts = {}) {
  openCustomExerciseForm({
    exercise: opts.exercise || null,
    name: opts.name || "",
    lang: i18n.getLanguage(),
    t,
    translate: translateExerciseValue,
    onSave: exercise => {
      DB.saveCustomExercise(exercise);
      refreshExercises();
      showToast(t("customSaved"));
      const details = $("#modal-details");
      if (opts.exercise && details && !details.classList.contains("hidden")) renderExerciseDetails(exercise);
      opts.onCreated && opts.onCreated(exercise);
    },
    onDelete: exercise => {
      DB.deleteCustomExercise(exercise.id);
      refreshExercises();
      closeModal("modal-details");
      if (state.currentProgramId) {
        const program = state.programs.find(item => item.id === state.currentProgramId);
        if (program) renderProgSessions(program);
      }
      showToast(t("customDeleted"));
    }
  });
}

/** Présentation de l'appli ; « Créer mon programme » ou « Passer » enchaînent sur le questionnaire */
function openIntroFlow({ replay = false } = {}) {
  openIntro({
    onFinish: result => {
      state.profile = DB.updateProfile({ introSeen: true });
      if (result === "start" || (result === "skip" && !replay && !state.programs.length)) setTimeout(openWizard, 150);
      else if (!state.profile?.onboardingDone) state.profile = DB.updateProfile({ onboardingDone: true });
    }
  });
}

function openNotion(error = "") {
  openNotionImport({
    exercises: state.exercises,
    nameOf: getExerciseName,
    existingIds: new Set(state.sessionLogs.map(log => log.id)),
    connection: DB.getNotion(),
    saveConnection: connection => DB.setNotion(connection),
    error,
    onImport: logs => {
      DB.addSessionLogs(logs);
      state.sessionLogs = DB.getSessionLogs();
      renderHome();
      showToast(t("importSuccess", { count: logs.length }));
    },
    onCreateProgram: createProgramFromNotion
  });
}

/** Programme lu dans Notion : crée les exercices perso manquants puis le programme */
function createProgramFromNotion({ program, customs }) {
  const idFor = {};
  for (const item of customs) {
    const existing = DB.getCustomExercises().find(ex => normalizeText(ex.name).replace(/[^a-z0-9]+/g, " ").trim() === item.key);
    const exercise = existing || DB.saveCustomExercise({
      id: `custom-${uid()}`,
      name: item.name,
      name_fr: item.name,
      type: item.type || "other",
      muscle_focus: "autre",
      muscle_portion: null,
      contraction_type: null,
      primary_muscles: [],
      secondary_muscles: [],
      secondary_detail: [],
      equipment: "autre",
      difficulty: "intermediaire",
      bodyweight: false,
      unilateral: false,
      description: "Importé de Notion",
      instructions: [],
      tips: [],
      img: null,
      similar_exercises: [],
      custom: true,
      source: "notion",
      createdAt: Date.now()
    });
    idFor[`custom:${item.key}`] = exercise.id;
  }
  const sessions = program.sessions.map(session => {
    const plan = {};
    const exerciseIds = session.exerciseIds.map(id => {
      const realId = idFor[id] || id;
      plan[realId] = session.plan[id];
      return realId;
    });
    return { id: uid(), name: session.name, type: session.type, exerciseIds, plan };
  });
  const saved = { id: uid(), name: program.name, description: program.description, createdAt: Date.now(), source: "notion", sessions };
  DB.addProgram(saved);
  state.exercises = DB.getExercises();
  state.programs = DB.getPrograms();
  if (!state.profile?.onboardingDone) state.profile = DB.updateProfile({ onboardingDone: true });
  setPerfProgramId(saved.id);
  renderAll();
  showToast(t("notionProgramCreated", { name: saved.name }));
}

/** Prochaine séance du programme en cours : celle qui suit la dernière faite */
function getNextSession() {
  const lastProgramLog = state.sessionLogs.find(log => log.programId && state.programs.some(p => p.id === log.programId));
  const program = state.programs.find(p => p.id === lastProgramLog?.programId) || state.programs.find(p => (p.sessions || []).some(s => s.exerciseIds?.length));
  const sessions = (program?.sessions || []).filter(s => s.exerciseIds?.length);
  if (!program || !sessions.length) return null;
  const lastIndex = lastProgramLog ? sessions.findIndex(s => s.name === lastProgramLog.sessionName) : -1;
  return { program, session: sessions[(lastIndex + 1) % sessions.length] };
}

function renderHero() {
  const next = getNextSession();
  const title = $("#hero-title"), sub = $("#hero-subtitle");
  $("#hero-card").classList.toggle("has-next", !!next);
  if (next) {
    title.textContent = next.session.name;
    sub.textContent = t("nextSessionMeta", { count: next.session.exerciseIds.length });
  } else {
    title.textContent = t("newSession");
    sub.textContent = t("guideModeSubtitle");
  }
}

function startHeroSession() {
  const next = getNextSession();
  if (!next) { openLauncher(); return; }
  state.currentProgramId = next.program.id;
  launchSpecificProgSession(next.session.id);
}

function renderHome() {
  const displayName = String(state.profile?.name || "").trim() || t("athlete");
  $("#home-title").textContent = t("homeGreeting", { name: displayName });

  renderHero();
  renderStreak();
  renderHomeLine($("#potes-line"));
  renderPerfCard();

  // 3 dernières séances, le reste derrière « voir tout »
  const recent = state.sessionLogs.slice(0, state.showAllSessions ? 20 : 3);
  const moreBtn = $("#recent-more-btn");
  moreBtn.classList.toggle("hidden", state.sessionLogs.length <= 3);
  moreBtn.textContent = t(state.showAllSessions ? "seeLess" : "seeAll");
  $("#recent-sessions-list").innerHTML = recent.length ? recent.map(log => {
    const completedSets = (log.exercises || []).reduce((total, exercise) => {
      return total + (exercise.sets || []).filter(set => set.status === "done").length;
    }, 0);

    const exerciseDetails = (log.exercises || []).map(ex => {
      const doneSets = (ex.sets || []).filter(s => s.status === "done");
      const maxWeight = doneSets.length ? Math.max(...doneSets.map(s => s.weight || 0)) : 0;
      const totalSets = doneSets.length;
      const bestReps = doneSets.length ? doneSets.reduce((best, s) => (s.weight || 0) >= maxWeight ? s.reps : best, 0) : 0;
      const name = exerciseNameById(ex.exerciseId) || ex.exerciseName || ex.exerciseId;
      return { name, maxWeight, totalSets, bestReps };
    }).filter(ex => ex.totalSets > 0);

    const exerciseListHtml = `
      <div class="session-exercise-details hidden" data-details-for="${log.id}">
        ${exerciseDetails.map(ex => `
          <div class="session-exercise-row">
            <span class="session-exercise-name">${ex.name}</span>
            <span class="session-exercise-stats">${ex.totalSets}×${ex.bestReps}${ex.maxWeight ? ` · ${ex.maxWeight} kg` : ""}</span>
          </div>
        `).join("")}
        <button type="button" class="text-danger-btn session-delete" data-delete-log="${log.id}">${escapeHtml(t("deleteSession"))}</button>
      </div>
    `;

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
      if (e.target.closest("[data-repeat], [data-delete-log]")) return;
      const details = item.querySelector("[data-details-for]");
      if (details) details.classList.toggle("hidden");
    });
  });

  $all("[data-repeat]").forEach(button => {
    button.addEventListener("click", () => repeatWorkout(button.dataset.repeat));
  });

  $all("[data-delete-log]").forEach(button => {
    button.addEventListener("click", () => {
      const removed = DB.deleteSessionLog(button.dataset.deleteLog);
      if (!removed) return;
      state.sessionLogs = DB.getSessionLogs();
      renderHome();
      Social.queuePublish();
      pushCompetitionStats();
      showToast(t("sessionDeleted"), {
        label: t("undo"),
        onClick: () => {
          DB.saveSessionLog(removed);
          state.sessionLogs = DB.getSessionLogs();
          renderHome();
          Social.queuePublish();
          pushCompetitionStats();
        }
      });
    });
  });
}

function openWeightModal() {
  const today = computeStreak(state.weightLog).todayEntry;
  $("#weight-input").value = today ? String(today.weight).replace(".", ",") : "";
  $("#weight-history").innerHTML = DB.getRecentDays(10).map(day => `
    <div class="progress-item weight-day">
      <div class="item-subtitle">${formatDateForUi(new Date(`${day.key}T12:00:00`).getTime())}</div>
      <div class="weight-day-values">
        <b>${day.weight != null ? `${formatNumber(day.weight, 1)} kg` : "—"}</b>
        <span>${day.kcal != null ? `${formatNumber(day.kcal, 0)} kcal` : ""}</span>
      </div>
    </div>
  `).join("");
  openModal("modal-weight");
}

/** Nombre tapé avec une virgule ou un point */
function parseDecimal(value) {
  return Number(String(value ?? "").trim().replace(/\s/g, "").replace(",", "."));
}

function focusField(selector) {
  setTimeout(() => { const input = $(selector); input?.focus(); input?.select?.(); }, 30);
}

function saveWeight() {
  const weight = parseDecimal($("#weight-input").value);
  if (!weight || weight < 20 || weight > 300) {
    showToast(t("invalidWeight"));
    return;
  }
  closeModal("modal-weight");
  logWeight(weight);
}

// ─── Flamme de pesée ────────────────────────────────────
/** Enregistre la pesée du jour, met à jour la flamme et félicite aux paliers */
function logWeight(weight, { silent = false } = {}) {
  const before = computeStreak(state.weightLog);
  DB.setDayWeight(weight);
  state.weightLog = DB.getWeightLog();
  state.streakEditing = false;
  const after = computeStreak(state.weightLog);
  renderHome();
  if (state.activeView === "progress") renderProgress();
  // partie Potes : palier de flamme (si partagée) et résumé à jour
  if (!before.doneToday && STREAK_MILESTONES.includes(after.current)) Social.postEvent("streak", { days: after.current });
  Social.queuePublish();
  if (silent) return;

  if (before.doneToday) {
    showToast(t("weightSaved"));
    return;
  }
  if (STREAK_MILESTONES.includes(after.current)) {
    showToast(t("streakMilestone", { count: after.current }));
    const card = $("#streak-card");
    card?.classList.add("streak-celebrate");
    setTimeout(() => card?.classList.remove("streak-celebrate"), 1600);
  } else {
    showToast(after.current > 1 ? t("streakLit", { count: after.current }) : t("streakFirst"));
  }
}

function saveStreakWeight() {
  const input = $("#streak-input");
  const weight = parseDecimal(input?.value);
  if (!weight || weight < 20 || weight > 300) {
    showToast(t("invalidWeight"));
    input?.focus();
    return;
  }
  logWeight(weight);
}

/** Kcal mangées aujourd'hui (champ vide = effacer) */
function saveKcal() {
  const input = $("#kcal-input");
  const raw = String(input?.value || "").trim();
  const kcal = raw === "" ? null : Math.round(parseDecimal(raw));
  if (kcal !== null && (!Number.isFinite(kcal) || kcal < 0 || kcal > 20000)) {
    showToast(t("kcalInvalid"));
    input?.focus();
    return;
  }
  DB.setDayKcal(kcal);
  state.kcalEditing = false;
  renderStreak();
  showToast(t(kcal === null ? "kcalCleared" : "kcalSaved"));
}

function focusStreakCard() {
  if (state.activeView !== "home") setView("home");
  $("#streak-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => $("#streak-input")?.focus({ preventScroll: true }), 350);
}

const FLAME_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#flame-icon"/></svg>`;

function renderStreak() {
  const card = $("#streak-card");
  if (!card) return;
  const s = computeStreak(state.weightLog);
  const lit = s.doneToday;

  const pill = $("#streak-pill");
  pill.classList.toggle("off", !lit);
  pill.classList.toggle("risk", s.atRisk);
  $("#streak-pill-count").textContent = s.current;

  const week = s.week.map(day => `
    <div class="streak-day${day.done ? " done" : ""}${day.isToday ? " today" : ""}">
      ${FLAME_SVG}
      <span>${day.date.toLocaleDateString(i18n.getLocale(), { weekday: "narrow" })}</span>
    </div>`).join("");

  const message = lit ? t("streakLoggedToday")
    : s.atRisk ? t("streakPromptKeep", { count: s.current })
    : t("streakPromptStart");

  let action;
  if (lit && !state.streakEditing) {
    const delta = s.previousEntry ? s.todayEntry.weight - s.previousEntry.weight : null;
    const deltaHtml = delta === null ? "" : `<span class="streak-delta">${delta > 0 ? "+" : ""}${formatNumber(delta, 1)} kg</span>`;
    action = `
      <div class="streak-done">
        <div class="streak-weight">${formatNumber(s.todayEntry.weight, 1)}<small>kg</small></div>
        ${deltaHtml}
        <button class="btn btn-ghost btn-sm" data-streak-edit>${t("streakEdit")}</button>
      </div>`;
  } else {
    // pesée du jour, ou correction de celle déjà faite (pré-remplie)
    const value = lit ? formatNumber(s.todayEntry.weight, 1) : "";
    const last = s.previousEntry ? formatNumber(s.previousEntry.weight, 1) : "75";
    action = `
      <div class="streak-form">
        <input id="streak-input" class="streak-input" type="text" inputmode="decimal" value="${value}" placeholder="${last}" aria-label="${t("weightToday")}">
        <span class="streak-unit">kg</span>
        <button class="btn btn-primary btn-sm" data-streak-save>${t("streakSave")}</button>
      </div>
      ${lit ? `<button type="button" class="hero-other streak-cancel" data-streak-cancel>${t("streakCancel")}</button>` : ""}`;
  }

  // kcal mangées aujourd'hui : facultatif, modifiable à tout moment
  const kcal = DB.getDay()?.kcal ?? null;
  const kcalHtml = kcal !== null && !state.kcalEditing ? `
    <div class="streak-kcal">
      <span class="streak-kcal-label">${t("kcalLabel")}</span>
      <b class="streak-kcal-value">${formatNumber(kcal, 0)}<small>kcal</small></b>
      <button class="btn btn-ghost btn-sm" data-kcal-edit>${t("streakEdit")}</button>
    </div>` : `
    <div class="streak-kcal">
      <label class="streak-kcal-label" for="kcal-input">${t("kcalLabel")}</label>
      <div class="streak-form streak-form-kcal">
        <input id="kcal-input" class="streak-input" type="text" inputmode="numeric" value="${kcal ?? ""}" placeholder="${t("kcalPlaceholder")}">
        <span class="streak-unit">kcal</span>
        <button class="btn btn-ghost btn-sm" data-kcal-save>${t("kcalSave")}</button>
      </div>
      ${state.kcalEditing ? `<button type="button" class="hero-other streak-cancel" data-kcal-cancel>${t("streakCancel")}</button>` : ""}
    </div>`;

  const nextHtml = s.next ? `
    <div class="streak-next">
      <div class="streak-next-bar"><div style="width:${Math.round(s.current / s.next * 100)}%"></div></div>
      <span>${t("streakNext", { count: s.next - s.current, target: s.next })}</span>
    </div>` : "";

  card.classList.toggle("lit", lit);
  card.classList.toggle("risk", s.atRisk);
  card.innerHTML = `
    <div class="streak-head">
      <div class="streak-flame${lit ? "" : " off"}">${FLAME_SVG}</div>
      <div class="streak-count">
        <b>${s.current}</b>
        <span>${s.current > 1 ? t("streakDaysMany") : t("streakDaysOne")}</span>
      </div>
      <div class="streak-best">${t("streakBest", { count: s.best })}</div>
    </div>
    <div class="streak-msg">${message}</div>
    ${action}
    ${kcalHtml}
    <div class="streak-week">${week}</div>
    ${nextHtml}
    <button type="button" class="hero-other streak-history" data-streak-history>${t("weightHistory")}</button>`;
}

function exportData() {
  const data = DB.exportCurrentData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, "tracklift_data.json");
  showToast(t("exportDownloaded"));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildPerfRows() {
  const rows = [];
  for (const log of state.sessionLogs) {
    const dateStr = new Date(log.date).toLocaleDateString(i18n.getLocale());
    for (const ex of (log.exercises || [])) {
      const doneSets = (ex.sets || []).filter(s => s.status === "done");
      if (doneSets.length === 0) continue;
      const exercise = state.exercises.find(e => e.id === ex.exerciseId);
      const name = exercise ? getExerciseName(exercise) : ex.exerciseName || ex.exerciseId;
      const muscle = exercise ? translateExerciseValue("muscle_focus", exercise.muscle_focus) : "";
      for (const s of doneSets) {
        rows.push({
          [t("colDate")]: dateStr,
          [t("colSession")]: log.sessionName,
          [t("colType")]: getSessionTypeLabel(log.type),
          [t("colMuscleGroup")]: muscle,
          [t("colExercise")]: name,
          [t("colReps")]: s.reps || 0,
          [t("colWeight")]: s.weight || 0,
          [t("colVolume")]: (s.reps || 0) * (s.weight || 0)
        });
      }
    }
  }
  return rows;
}

function buildMuscleGroupRows() {
  const groups = {};
  for (const log of state.sessionLogs) {
    for (const ex of (log.exercises || [])) {
      const exercise = state.exercises.find(e => e.id === ex.exerciseId);
      const muscle = exercise?.muscle_focus || "other";
      const label = translateExerciseValue("muscle_focus", muscle) || muscle;
      if (!groups[label]) groups[label] = { volume: 0, bestWeight: 0, sessions: 0 };
      const doneSets = (ex.sets || []).filter(s => s.status === "done");
      if (doneSets.length === 0) continue;
      groups[label].sessions++;
      groups[label].bestWeight = Math.max(groups[label].bestWeight, ...doneSets.map(s => s.weight || 0));
      groups[label].volume += doneSets.reduce((sum, s) => sum + (s.reps || 0) * (s.weight || 0), 0);
    }
  }
  return Object.entries(groups).map(([label, data]) => ({
    [t("colMuscleGroup")]: label,
    [t("colBestWeight")]: data.bestWeight,
    [t("colTotalVolume")]: data.volume,
    [t("colSessionCount")]: data.sessions
  }));
}

function buildPRRows() {
  const prs = {};
  for (const log of state.sessionLogs) {
    for (const ex of (log.exercises || [])) {
      const doneSets = (ex.sets || []).filter(s => s.status === "done");
      if (doneSets.length === 0) continue;
      const exercise = state.exercises.find(e => e.id === ex.exerciseId);
      const name = exercise ? getExerciseName(exercise) : ex.exerciseName || ex.exerciseId;
      const maxW = Math.max(...doneSets.map(s => s.weight || 0));
      if (!prs[name] || maxW > prs[name].weight) {
        prs[name] = { weight: maxW, date: log.date };
      }
    }
  }
  return Object.entries(prs)
    .sort((a, b) => b[1].weight - a[1].weight)
    .map(([name, data]) => ({
      [t("colExercise")]: name,
      [t("colPR")]: data.weight,
      [t("colPRDate")]: new Date(data.date).toLocaleDateString(i18n.getLocale())
    }));
}

function exportPerfExcel() {
  const wb = XLSX.utils.book_new();

  const perfRows = buildPerfRows();
  if (perfRows.length) {
    const ws1 = XLSX.utils.json_to_sheet(perfRows);
    XLSX.utils.book_append_sheet(wb, ws1, t("sheetSessions"));
  }

  const muscleRows = buildMuscleGroupRows();
  if (muscleRows.length) {
    const ws2 = XLSX.utils.json_to_sheet(muscleRows);
    XLSX.utils.book_append_sheet(wb, ws2, t("sheetByMuscle"));
  }

  const prRows = buildPRRows();
  if (prRows.length) {
    const ws3 = XLSX.utils.json_to_sheet(prRows);
    XLSX.utils.book_append_sheet(wb, ws3, t("sheetPRs"));
  }

  const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(new Blob([data], { type: "application/octet-stream" }), "tracklift_performances.xlsx");
  showToast(t("exportPerfDone"));
}

function exportProgramsExcel() {
  const wb = XLSX.utils.book_new();

  for (const program of state.programs) {
    const rows = [];
    for (const session of (program.sessions || [])) {
      for (const exId of (session.exerciseIds || [])) {
        const exercise = state.exercises.find(e => e.id === exId);
        const name = exercise ? getExerciseName(exercise) : exId;
        const muscle = exercise ? translateExerciseValue("muscle_focus", exercise.muscle_focus) : "";
        const type = exercise ? translateExerciseValue("type", exercise.type) : "";
        rows.push({
          [t("colSession")]: session.name,
          [t("colType")]: getSessionTypeLabel(session.type),
          [t("colExercise")]: name,
          [t("colMuscleGroup")]: muscle,
          "Type exo": type
        });
      }
    }
    if (rows.length) {
      const sheetName = program.name.slice(0, 31).replace(/[\\/*?:\[\]]/g, "");
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  }

  if (wb.SheetNames.length === 0) {
    const ws = XLSX.utils.json_to_sheet([{ Info: t("noProgramsYet") }]);
    XLSX.utils.book_append_sheet(wb, ws, "Info");
  }

  const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(new Blob([data], { type: "application/octet-stream" }), "tracklift_programmes.xlsx");
  showToast(t("exportProgramsDone"));
}

function exportAndSendGmail() {
  const wb = XLSX.utils.book_new();

  const perfRows = buildPerfRows();
  if (perfRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(perfRows), t("sheetSessions"));
  const muscleRows = buildMuscleGroupRows();
  if (muscleRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(muscleRows), t("sheetByMuscle"));
  const prRows = buildPRRows();
  if (prRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prRows), t("sheetPRs"));

  const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(new Blob([data], { type: "application/octet-stream" }), "tracklift_performances.xlsx");

  const name = state.profile?.name || "Athlete";
  const date = new Date().toLocaleDateString(i18n.getLocale());
  const subject = encodeURIComponent(`TrackLift - ${t("sheetSessions")} ${date}`);
  const body = encodeURIComponent(
    `${t("homeGreeting", { name })}\n\n` +
    `${t("sheetSessions")}: ${perfRows.length} ${t("colSets").toLowerCase()}\n` +
    `${t("sheetPRs")}: ${prRows.length} ${t("colExercise").toLowerCase()}\n\n` +
    `---\nTrackLift`
  );
  window.open(`https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`, "_blank");
  showToast(t("gmailSent"));
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
      const sheetName = wb.SheetNames.find(n => n === t("sheetSessions") || n === "Seances" || n === "Sessions") || wb.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

      if (!rows.length) {
        showToast(t("importNoData"));
        return;
      }

      const sessionMap = {};
      for (const row of rows) {
        const sessionName = row[t("colSession")] || row["Seance"] || row["Session"] || "Import";
        const dateStr = row[t("colDate")] || row["Date"] || "";
        const key = `${sessionName}_${dateStr}`;

        if (!sessionMap[key]) {
          sessionMap[key] = {
            id: uid(),
            sessionName,
            type: row[t("colType")] || row["Type"] || "other",
            date: parseDateStr(dateStr),
            durationMs: 0,
            exercises: {}
          };
        }

        const exName = row[t("colExercise")] || row["Exercice"] || row["Exercise"] || "";
        if (!exName) continue;

        if (!sessionMap[key].exercises[exName]) {
          const match = state.exercises.find(ex => getExerciseName(ex) === exName || ex.name === exName);
          sessionMap[key].exercises[exName] = {
            exerciseId: match?.id || exName.toLowerCase().replace(/\s+/g, "_"),
            exerciseName: exName,
            muscleFocus: match?.muscle_focus || "other",
            type: match?.type || "other",
            sets: [],
            restSeconds: 90
          };
        }

        sessionMap[key].exercises[exName].sets.push({
          reps: Number(row[t("colReps")] || row["Reps"] || 0),
          weight: Number(row[t("colWeight")] || row["Charge (kg)"] || row["Weight (kg)"] || 0),
          targetReps: Number(row[t("colReps")] || row["Reps"] || 0),
          status: "done"
        });
      }

      let count = 0;
      for (const session of Object.values(sessionMap)) {
        const log = {
          id: session.id,
          sessionName: session.sessionName,
          type: session.type,
          date: session.date,
          durationMs: 0,
          exercises: Object.values(session.exercises)
        };
        DB.saveSessionLog(log);
        count++;
      }

      state.sessionLogs = DB.getSessionLogs();
      renderHome();
      showToast(t("importSuccess", { count }));
    } catch (err) {
      console.error("[TrackLift] import error:", err);
      showToast(t("importError"));
    }
    event.target.value = "";
  };
  reader.readAsArrayBuffer(file);
}

function parseDateStr(str) {
  if (!str) return Date.now();
  const parts = str.split(/[/.\-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number);
    if (a > 31) return new Date(a, b - 1, c).getTime();
    if (c > 31) return new Date(c, b - 1, a).getTime();
    return new Date(c, a - 1, b).getTime();
  }
  const parsed = Date.parse(str);
  return isNaN(parsed) ? Date.now() : parsed;
}

/** Carte « programmes en commun » en tête de l'onglet Programmes */
function groupsEntryHtml() {
  if (!Social.loaded || Social.error) return "";
  if (!Social.joined) return `
    <div class="card gr-entry">
      <div><b>${escapeHtml(t("grEntryTitle"))}</b><small>${escapeHtml(t("grEntryJoin"))}</small></div>
      <button type="button" class="btn btn-ghost btn-sm" data-groups-go>${escapeHtml(t("grEntryJoinBtn"))}</button>
    </div>`;
  const groups = SharedPrograms.myGroups(state.programs).length;
  const invites = Social.invitesIn.length;
  const line = invites ? t("grEntryInvites", { count: invites }) : groups ? t("grEntryCount", { count: groups }) : t("grEntryEmpty");
  return `
    <div class="card gr-entry${invites ? " has-news" : ""}">
      <div><b>${escapeHtml(t("grEntryTitle"))}</b><small>${escapeHtml(line)}</small></div>
      <button type="button" class="btn btn-ghost btn-sm" data-groups-go>${escapeHtml(t(invites ? "grEntrySeeInvites" : "grEntrySee"))}</button>
    </div>`;
}

function goToGroups() {
  setView("potes");
  showPotesTab(Social.joined ? "programs" : "friends");
}

function renderPrograms() {
  // partie Potes : étiquette « partagé » / « programme d'un pote » et bouton « en commun » (seulement si rejoint)
  const followed = Object.entries(Social.joined ? SharedPrograms.joined : {});
  $("#programs-list").innerHTML = groupsEntryHtml() + (state.programs.length ? state.programs.map(program => {
    const shared = Social.joined && SharedPrograms.shares[program.id];
    const follow = followed.find(([, entry]) => entry.localId === program.id);
    const update = follow && state.programUpdates?.has(program.id);
    return `
    <div class="program-item" style="cursor:pointer;" data-program-id="${program.id}">
      <div class="program-item-head">
        <div>
          <div class="item-title">${escapeHtml(program.name)}</div>
          <div class="item-subtitle">${escapeHtml(program.description || "")}</div>
          <div class="small-meta">${t("sessionsCount", { count: program.sessions.length })}</div>
          ${shared ? `<span class="prog-tag">${escapeHtml(t("spTagShared"))}</span>` : follow ? `<span class="prog-tag">${escapeHtml(t("spTagFollowed"))}</span>` : ""}
          ${update ? `<button type="button" class="prog-update" data-program-update="${escapeHtml(follow[0])}">${escapeHtml(t("spUpdateAvailable"))}</button>` : ""}
        </div>
        ${Social.joined && !follow ? `<button type="button" class="btn btn-surface btn-sm" data-share-program="${program.id}">${escapeHtml(t(shared ? "grShortOpen" : "grShareShort"))}</button>` : ""}
      </div>
    </div>`;
  }).join("") : `<div class="card">${t("noProgramsYet")}</div>`);

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

  // programme partagé (le mien) ou suivi : la compétition entre membres
  const shareId = Social.joined ? (SharedPrograms.shares[program.id]
    || Object.entries(SharedPrograms.joined).find(([, entry]) => entry.localId === program.id)?.[0]) : null;
  const competeCard = shareId ? `
    <div class="card cp-card">
      <div><b>${escapeHtml(t("cpCardTitle"))}</b><small>${escapeHtml(t(SharedPrograms.competing[shareId] ? "cpCardIn" : "cpCardOut"))}</small></div>
      <button type="button" class="btn btn-ghost btn-sm" data-open-compete="${escapeHtml(shareId)}">${escapeHtml(t("cpCardBtn"))}</button>
    </div>` : "";

  container.innerHTML = competeCard + program.sessions.map(session => `
    <div class="program-item card">
      <div class="program-item-head">
        <div>
          <div class="item-title">${escapeHtml(session.name)}</div>
          <span class="badge mt-12">${getSessionTypeLabel(session.type)}</span>
          <div class="small-meta mt-4">${t("configuredExercisesCount", { count: (session.exerciseIds || []).length })}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-surface btn-sm" data-edit-sess="${session.id}">${t("manageExercises")}</button>
          <button class="btn btn-primary btn-sm" data-play-sess="${session.id}">${t("play")}</button>
        </div>
      </div>
      ${sessionExercisesHtml(session)}
    </div>
  `).join("");

  $all("[data-edit-sess]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      openManageExercises(event.target.dataset.editSess);
    });
  });
  container.querySelector("[data-open-compete]")?.addEventListener("click", event => openProgramCompetition(event.currentTarget.dataset.openCompete));

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

  DB.deleteProgram(state.currentProgramId);

  state.programs = DB.getPrograms();
  state.currentProgramId = null;
  setView("programs");
  showToast(t("programDeleted"));
}

/** Prévu pour un exercice : « 4 × 8 · 60 kg » */
function planLabel(plan) {
  if (!plan) return "";
  const work = plan.setList?.filter(item => !item.kind || item.kind === "work");
  const sets = work?.length || plan.sets;
  const reps = work?.[0]?.reps || plan.reps;
  const weight = Number(plan.weight) || Number(work?.[0]?.weight) || 0;
  return `${sets || 3} × ${reps || 10}${weight ? ` · ${String(weight).replace(".", ",")} kg` : ""}`;
}

/** Liste des exercices d'une séance, dans l'ordre, sur la page du programme */
function sessionExercisesHtml(session) {
  const ids = session.exerciseIds || [];
  if (!ids.length) return "";
  return `<ol class="ps-ex">${ids.map(id => {
    const exercise = getExerciseById(id, state.exercises);
    const name = exercise ? getExerciseName(exercise) : id;
    const plan = planLabel(session.plan?.[id]);
    return `<li><span>${escapeHtml(name)}</span>${plan ? `<small>${escapeHtml(plan)}</small>` : ""}</li>`;
  }).join("")}</ol>`;
}

function currentEditSession() {
  const program = state.programs.find(item => item.id === state.currentProgramId);
  return program?.sessions.find(item => item.id === state.currentEditSessionId) || null;
}

/** Modifie la séance en cours d'édition et enregistre */
function updateEditSession(change) {
  const data = DB.getData();
  const dbProgram = data.programs.find(item => item.id === state.currentProgramId);
  const dbSession = dbProgram?.sessions.find(item => item.id === state.currentEditSessionId);
  if (!dbSession) return;
  dbSession.exerciseIds = dbSession.exerciseIds || [];
  change(dbSession);
  DB.saveData(data);
  state.programs = DB.getPrograms();
  const program = state.programs.find(item => item.id === state.currentProgramId);
  if (program) renderProgSessions(program);
}

function openManageExercises(sessionId) {
  state.currentEditSessionId = sessionId;
  $("#search-manage-exercises").value = "";
  renderManageSession();
  renderManageExercisesList();
  openModal("modal-manage-exercises");
  bindManageSession();
}

/** Les exercices de la séance : ordre, séries, reps, charge, détails, retrait */
function renderManageSession(flashId = null) {
  const session = currentEditSession();
  const box = $("#manage-session-items");
  if (!session || !box) return;
  const ids = session.exerciseIds || [];
  const rows = ids.map((id, i) => {
    const exercise = getExerciseById(id, state.exercises);
    const label = exercise ? getExerciseName(exercise) : id;
    const name = escapeHtml(label);
    const plan = session.plan?.[id] || {};
    const work = plan.setList?.filter(item => !item.kind || item.kind === "work");
    const sets = work?.length || plan.sets || 3;
    const reps = work?.[0]?.reps || plan.reps || 10;
    const weight = plan.weight ?? work?.[0]?.weight ?? "";
    return `
      <li class="wz-item${flashId === id ? " is-new" : ""}" data-ms-item="${escapeHtml(id)}">
        <div class="wz-item-h">
          <span class="wz-item-n">${i + 1}</span>
          <span class="wz-item-name">${name}</span>
          <span class="wz-item-tools">
            <button type="button" class="wz-tool" data-ms-act="info" data-ms-id="${escapeHtml(id)}" aria-label="${escapeHtml(t("msDetailsOf", { name: label }))}">i</button>
            <button type="button" class="wz-tool" data-ms-act="up" data-ms-i="${i}" aria-label="${escapeHtml(t("msUp", { name: label }))}"${i === 0 ? " disabled" : ""}>↑</button>
            <button type="button" class="wz-tool" data-ms-act="down" data-ms-i="${i}" aria-label="${escapeHtml(t("msDown", { name: label }))}"${i === ids.length - 1 ? " disabled" : ""}>↓</button>
            <button type="button" class="wz-tool wz-tool-x" data-ms-act="remove" data-ms-id="${escapeHtml(id)}" aria-label="${escapeHtml(t("msRemove", { name: label }))}">✕</button>
          </span>
        </div>
        <div class="wz-item-f">
          <label><em>${t("msSets")}</em><input type="number" inputmode="numeric" min="1" max="20" data-ms-field="sets" data-ms-id="${escapeHtml(id)}" value="${escapeHtml(sets)}"></label>
          <label><em>${t("msReps")}</em><input type="number" inputmode="numeric" min="1" max="100" data-ms-field="reps" data-ms-id="${escapeHtml(id)}" value="${escapeHtml(reps)}"></label>
          <label><em>${t("msWeight")}</em><input type="number" inputmode="decimal" min="0" max="500" step="0.5" placeholder="—" data-ms-field="weight" data-ms-id="${escapeHtml(id)}" value="${escapeHtml(weight || "")}"></label>
        </div>
      </li>`;
  }).join("");
  box.innerHTML = `
    <h4 class="ms-title">${t("msInSession", { count: ids.length })}</h4>
    ${ids.length ? `<ol class="wz-items ms-items">${rows}</ol><p class="ms-hint">${t("msPlanHint")}</p>` : `<p class="ms-empty">${t("msEmpty")}</p>`}`;
}

let manageBound = false;
function bindManageSession() {
  if (manageBound) return;
  manageBound = true;
  const box = $("#manage-session-items");
  box.addEventListener("click", event => {
    const btn = event.target.closest("[data-ms-act]");
    if (!btn) return;
    const act = btn.dataset.msAct;
    if (act === "info") {
      const detailsModal = $("#modal-details");
      if (detailsModal) detailsModal.style.zIndex = "60";
      showExerciseDetails(btn.dataset.msId);
      return;
    }
    if (act === "remove") {
      const id = btn.dataset.msId;
      updateEditSession(session => {
        session.exerciseIds = session.exerciseIds.filter(item => item !== id);
        if (session.plan) delete session.plan[id];
      });
      renderManageSession();
      renderManageExercisesList();
      return;
    }
    const from = Number(btn.dataset.msI);
    const to = act === "up" ? from - 1 : from + 1;
    updateEditSession(session => {
      if (to < 0 || to >= session.exerciseIds.length) return;
      [session.exerciseIds[from], session.exerciseIds[to]] = [session.exerciseIds[to], session.exerciseIds[from]];
    });
    renderManageSession();
    // le focus suit l'exercice déplacé
    const same = box.querySelector(`[data-ms-act="${act}"][data-ms-i="${to}"]`);
    const other = box.querySelector(`[data-ms-act="${act === "up" ? "down" : "up"}"][data-ms-i="${to}"]`);
    (same && !same.disabled ? same : other)?.focus();
  });
  // séries / reps / charge prévues : enregistrées quand on quitte le champ
  box.addEventListener("change", event => {
    const input = event.target.closest("[data-ms-field]");
    if (!input) return;
    const { msField: field, msId: id } = input.dataset;
    const value = input.value === "" ? 0 : Number(input.value);
    if (!Number.isFinite(value) || value < 0) return;
    updateEditSession(session => {
      session.plan = session.plan || {};
      const plan = { sets: 3, reps: 10, weight: 0, ...(session.plan[id] || {}) };
      plan[field] = field === "weight" ? Math.round(value * 2) / 2 : Math.max(1, Math.round(value));
      // les séries détaillées (import) ne collent plus si on change séries ou reps
      if (field !== "weight") delete plan.setList;
      session.plan[id] = plan;
    });
  });
}

function renderManageExercisesList() {
  const session = currentEditSession();
  if (!session) return;

  const selectedIds = session.exerciseIds || [];
  const search = normalizeText($("#search-manage-exercises").value);
  // le catalogue ne montre que ce qui n'est pas déjà dans la séance (la séance est listée au-dessus)
  const filtered = state.exercises.filter(exercise => !selectedIds.includes(exercise.id) && (!search || buildExerciseSearchText(exercise).includes(search)));
  const query = $("#search-manage-exercises").value.trim();
  const createRow = query && !filtered.some(exercise => normalizeText(getExerciseName(exercise)) === search)
    ? `<button type="button" class="create-row" data-create-ex>+ ${t("customCreateNamed", { name: escapeHtml(query) })}</button>`
    : "";

  $("#manage-exercises-list").innerHTML = createRow + filtered.map(exercise => {
    const isSelected = selectedIds.includes(exercise.id);
    const meta = getExerciseMeta(exercise);

    return `
      <div class="exercise-item" style="display:flex; justify-content:space-between; align-items:center; padding: 12px; background: var(--surface2); border-radius: 12px;">
        <div class="ex-row">
          ${illustrationHtml(exercise, "thumb")}
          <div class="ex-row-text">
            <div class="item-title" style="font-size: 14px;">${getExerciseName(exercise)}</div>
            <div class="item-subtitle" style="font-size: 11px;">${meta.muscleFocus}</div>
          </div>
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

  $("#manage-exercises-list [data-create-ex]")?.addEventListener("click", () => {
    openCustomExercise({ name: query, onCreated: exercise => {
      if (!(currentEditSession()?.exerciseIds || []).includes(exercise.id)) toggleExerciseInSession(exercise.id);
      $("#search-manage-exercises").value = "";
      renderManageExercisesList();
    } });
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
  let added = false;
  updateEditSession(session => {
    if (session.exerciseIds.includes(exerciseId)) {
      session.exerciseIds = session.exerciseIds.filter(id => id !== exerciseId);
    } else {
      session.exerciseIds.push(exerciseId);
      added = true;
    }
  });
  renderManageSession(added ? exerciseId : null);
  renderManageExercisesList();
  // l'exercice ajouté apparaît en bas de la séance, à l'écran
  if (added) $(`#manage-session-items [data-ms-item="${CSS.escape(exerciseId)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
    sessionLogs: state.sessionLogs,
    plan: session.plan
  });
  state.workout.programId = program.id;

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
    return `<option value="${item}">${muscleName(item, i18n.getLanguage())}</option>`;
  }).join("");

  if (currentPortion && portions.includes(currentPortion)) {
    $("#filter-portion").value = currentPortion;
    return;
  }

  $("#filter-portion").value = "";
}

const EXERCISE_PAGE = 30;

/** Carte du corps : dessinée une fois par langue, puis on ne change que la sélection. */
function renderBodyMap(searching = false) {
  const lang = i18n.getLanguage();
  const map = $("#body-map");
  if (map.dataset.lang !== lang) {
    map.innerHTML = bodyMapHtml(state.bodyZone, { lang, labels: { front: t("bodyFront"), back: t("bodyBack") } });
    map.dataset.lang = lang;
  }
  map.querySelectorAll(".bm-zone").forEach(zone => {
    const on = zone.dataset.zone === state.bodyZone;
    zone.classList.toggle("is-on", on);
    zone.setAttribute("aria-pressed", String(on));
  });
  map.classList.toggle("has-pick", Boolean(state.bodyZone));
  // pendant une recherche, la carte se replie pour laisser la place aux résultats
  $("#body-map-card").classList.toggle("is-searching", searching);
  $("#body-zone-bar").classList.toggle("hidden", !state.bodyZone);
  $("#body-zone-name").textContent = state.bodyZone ? zoneName(state.bodyZone, lang) : "";
}

function renderExerciseList() {
  if (!state.exerciseLimit) state.exerciseLimit = EXERCISE_PAGE;
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
    const matchesZone = !state.bodyZone || exerciseInZone(exercise, state.bodyZone);
    return matchesSearch && matchesType && matchesMuscle && matchesPortion && matchesContraction && matchesZone;
  });
  renderBodyMap(Boolean(search));

  const activeFilters = [filterType, filterMuscle, filterPortion, filterContraction].filter(Boolean).length;
  const badge = $("#filters-count");
  badge.textContent = activeFilters;
  badge.classList.toggle("hidden", !activeFilters);
  $("#exercise-count").textContent = filtered.length === 1 ? t("exerciseCountOne") : t("exerciseCount", { count: filtered.length });

  const rank = state.bodyZone ? exercise => zoneRank(exercise, state.bodyZone) : () => 0;
  filtered.sort((a, b) => (b.custom ? 1 : 0) - (a.custom ? 1 : 0) || rank(a) - rank(b) || getExerciseName(a).localeCompare(getExerciseName(b), i18n.getLocale()));
  const shown = filtered.slice(0, state.exerciseLimit);
  const more = $("#exercise-more-btn");
  more.classList.toggle("hidden", filtered.length <= shown.length);
  more.textContent = t("showMore", { count: filtered.length - shown.length });

  if (!filtered.length) {
    $("#exercise-list").innerHTML = `<p class="empty-state">${t("noExerciseFound")}</p>`;
    return;
  }

  $("#exercise-list").innerHTML = shown.map(exercise => {
    const meta = getExerciseMeta(exercise);
    const subtitle = [exercise.type === "other" ? "" : meta.type, primaryMusclesLabel(exercise, i18n.getLanguage())].filter(Boolean).join(" · ");
    const smallMeta = [...new Set([meta.equipment, meta.difficulty, meta.contractionType].filter(Boolean))].join(" · ");

    return `
      <button type="button" class="exercise-item exercise-row" data-details-id="${exercise.id}">
        <span class="ex-row">
          ${illustrationHtml(exercise, "thumb").replace(/<div/g, "<span").replace(/<\/div>/g, "</span>")}
          <span class="ex-row-text">
            <span class="item-title">${getExerciseName(exercise)}${exercise.custom ? ` <span class="custom-tag">${t("customBadge")}</span>` : ""}</span>
            <span class="item-subtitle">${subtitle}</span>
            <span class="small-meta">${smallMeta}</span>
          </span>
        </span>
        <svg class="row-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </button>
    `;
  }).join("");
}

const CHART_COLORS = [
  "#7a8450", "#ff7a00", "#5aa86a", "#95969d", "#b5762c",
  "#aebd93", "#3f6b3a", "#6d6e75", "#c9a227", "#8fa36a"
];

let progressActiveExercises = new Set();
let progressChartInstances = { exercise: null, volume: null };

function getUsedExerciseIds() {
  const counts = new Map();
  for (const log of state.sessionLogs) {
    for (const ex of (log.exercises || [])) {
      const hasDone = (ex.sets || []).some(s => s.status === "done");
      if (hasDone) counts.set(ex.exerciseId, (counts.get(ex.exerciseId) || 0) + 1);
    }
  }
  // les exercices les plus pratiqués d'abord
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

function renderProgress() {
  renderWeightChart(state.weightLog);

  const usedIds = getUsedExerciseIds();

  // un seul exercice suivi à la fois : le plus pratiqué par défaut
  const kept = [...progressActiveExercises].find(id => usedIds.includes(id));
  // par défaut : l'exercice avec charge le plus pratiqué (un record « 0 kg » ne dit rien)
  const weighted = usedIds.find(id => state.sessionLogs.some(log => (log.exercises || []).some(e => e.exerciseId === id && (e.sets || []).some(s => s.status === "done" && Number(s.weight) > 0))));
  progressActiveExercises = new Set(kept ? [kept] : [weighted || usedIds[0]].filter(Boolean));

  renderProgressChips(usedIds);
  renderProgressCharts();

  const search = $("#progress-exercise-search");
  search.oninput = () => renderProgressChips(usedIds, search.value);
}

function renderProgressChips(usedIds, filter = "") {
  const normalized = normalizeText(filter);
  const container = $("#progress-exercise-chips");

  // sans recherche : les 8 exercices les plus pratiqués (+ celui suivi)
  const visible = normalized ? usedIds : usedIds.filter((id, i) => i < 8 || progressActiveExercises.has(id));
  const chips = visible.map(id => {
    const ex = state.exercises.find(e => e.id === id);
    const name = ex ? getExerciseName(ex) : id;
    if (normalized && !normalizeText(name).includes(normalized)) return "";
    const active = progressActiveExercises.has(id);
    return `<button class="exercise-chip ${active ? "active" : ""}" data-chip-id="${id}" aria-pressed="${active}">${name}</button>`;
  }).join("");

  container.innerHTML = chips;

  $all(".exercise-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      progressActiveExercises = new Set([chip.dataset.chipId]);
      $all(".exercise-chip").forEach(c => {
        const on = c === chip;
        c.classList.toggle("active", on);
        c.setAttribute("aria-pressed", String(on));
      });
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

  const chronological = [...state.sessionLogs].sort((a, b) => a.date - b.date);
  for (const id of activeIds) {
    exerciseData[id] = {};
    for (const log of chronological) {
      const exEntry = (log.exercises || []).find(e => e.exerciseId === id);
      if (!exEntry) continue;
      const doneSets = (exEntry.sets || []).filter(s => s.status === "done");
      if (doneSets.length === 0) continue;
      const dateKey = new Date(log.date).toLocaleDateString(i18n.getLocale(), { day: "2-digit", month: "short" });
      allDates.add(dateKey);
      const maxW = Math.max(...doneSets.map(s => s.weight || 0));
      const vol = doneSets.reduce((sum, s) => sum + (s.reps || 0) * (s.weight || 0), 0);
      const maxReps = Math.max(...doneSets.map(s => Number(s.reps) || 0));
      exerciseData[id][dateKey] = { maxWeight: maxW, volume: vol, maxReps, date: log.date };
    }
  }

  const labels = [...allDates];

  const weightDatasets = activeIds.map((id, i) => {
    const ex = state.exercises.find(e => e.id === id);
    const name = ex ? getExerciseName(ex) : id;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const values = labels.map(d => exerciseData[id][d]?.maxWeight ?? null);
    // un point orange plus gros chaque fois que la charge dépasse tout ce qui précède
    let best = -Infinity;
    const isRecord = values.map((v, k) => { if (v === null) return false; const rec = k > 0 && v > best; best = Math.max(best, v); return rec; });
    return {
      label: name,
      data: values,
      borderColor: color,
      backgroundColor: color + "22",
      fill: false,
      tension: 0.4,
      pointRadius: isRecord.map(r => r ? 6 : 3),
      pointHoverRadius: isRecord.map(r => r ? 8 : 5),
      pointBackgroundColor: isRecord.map(r => r ? "#ff7a00" : color),
      pointBorderColor: isRecord.map(r => r ? "#c94400" : color),
      pointBorderWidth: isRecord.map(r => r ? 2 : 1),
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
      legend: { display: activeIds.length > 1, labels: { color: "#6b5232", font: { family: "Poppins", size: 11 }, boxWidth: 12 } }
    },
    scales: {
      x: { grid: { color: "rgba(76,46,5,0.12)" }, ticks: { color: "#6b5232", font: { family: "Poppins", size: 11 } } },
      y: { grid: { color: "rgba(76,46,5,0.12)" }, ticks: { color: "#6b5232", font: { family: "Poppins", size: 11 } } }
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
    options: { ...chartOpts, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, beginAtZero: true } } }
  });

  statsCard.innerHTML = activeIds.map(id => winCardHtml(id, Object.values(exerciseData[id]))).join("");
}

/** « +10 kg sur Développé couché depuis le 29 sept. » : le progrès en une phrase, avec la mascotte */
function winCardHtml(id, points) {
  if (!points.length) return "";
  const ex = state.exercises.find(e => e.id === id);
  const name = ex ? getExerciseName(ex) : id;
  const loaded = points.some(p => p.maxWeight > 0);
  const timed = isTimed(ex);
  const value = p => loaded ? p.maxWeight : p.maxReps;
  const unit = loaded ? "kg" : timed ? "s" : t("recapRepsShort");
  const num = v => Number(v).toLocaleString(i18n.getLocale(), { maximumFractionDigits: 1 });
  const first = points[0];
  const record = Math.max(...points.map(value));
  const gain = record - value(first);
  const since = new Date(first.date).toLocaleDateString(i18n.getLocale(), { day: "numeric", month: "short" });
  const big = gain > 0 ? `+${num(gain)}<small> ${escapeHtml(unit)}</small>` : `${num(record)}<small> ${escapeHtml(unit)}</small>`;
  const line = points.length === 1 ? t("winFirstLine", { exercise: name })
    : gain > 0 ? t("winGainLine", { exercise: name, date: since })
    : t("winHoldLine", { exercise: name });
  const meta = t("winMeta", { record: `${num(record)} ${unit}`, count: points.length, plural: points.length > 1 ? "s" : "" });
  return `<div class="win-card${gain > 0 ? " is-up" : ""}">
      <div class="win-text">
        <p class="win-big">${big}</p>
        <p class="win-line">${escapeHtml(line)}</p>
        <p class="win-meta">${escapeHtml(meta)}</p>
        ${loaded && points.length > 2 ? `<p class="win-legend"><i aria-hidden="true"></i>${escapeHtml(t("winRecordDot"))}</p>` : ""}
      </div>
      <img class="win-illu" src="./assets/illustrations/intro-03-progres.webp" alt="" width="84" height="140">
    </div>`;
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

  // sinon : le programme suivi dans la carte performances, ou le seul programme existant
  const fallbackId = state.programs.some(program => program.id === getPerfProgramId())
    ? getPerfProgramId()
    : (state.programs.length === 1 ? state.programs[0].id : "");
  const selectedId = state.programs.some(program => program.id === currentProgramId) ? currentProgramId : fallbackId;
  if (selectedId) $("#program-select").value = selectedId;
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
    sessionLogs: state.sessionLogs,
    plan: session.plan
  });
  state.workout.programId = program.id;

  closeModal("modal-launcher");
  setView("workout");
}

function repeatWorkout(logId) {
  const log = state.sessionLogs.find(item => item.id === logId);
  if (!log) return;
  state.workout = buildWorkoutFromRecentLog(log, state.exercises);
  state.workout.programId = log.programId || null;
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
  const meta = getExerciseMeta(exercise);
  // les conseils RepDB n'existent qu'en anglais : on ne les montre pas en français
  const displayTip = i18n.getLanguage() === "fr" ? "" : (exercise?.tips || [])[0] || "";

  $("#guided-session-name").textContent = state.workout.sessionName;
  $("#guided-progress").textContent = t("exerciseProgress", {
    current: state.workout.currentExerciseIndex + 1,
    total: state.workout.blocks.length
  });
  $("#guided-type-badge").textContent = meta.type || getSessionTypeLabel("other");
  $("#guided-muscle-badge").textContent = meta.muscleFocus || t("muscle");
  $("#guided-exercise-name").textContent = exercise ? getExerciseName(exercise) : t("exerciseFallback");
  const illuBox = $("#guided-illu");
  if (illuBox && illuBox.dataset.exerciseId !== (exercise?.id || "")) {
    illuBox.dataset.exerciseId = exercise?.id || "";
    // petite vignette : l'image en grand et la carte des muscles sont dans « en savoir plus »
    illuBox.innerHTML = illustrationHtml(exercise, "thumb");
  }
  $("#guided-exercise-tip").textContent = displayTip;
  $("#guided-last").textContent = lastTimeText(exercise?.id);
  const allSets = state.workout.blocks.flatMap(b => b.sets);
  const doneShare = allSets.length ? allSets.filter(s => s.status !== "pending").length / allSets.length : 0;
  $("#guided-progressbar-fill").style.width = `${Math.round(doneShare * 100)}%`;
  $(".guided-progressbar").setAttribute("aria-valuenow", String(Math.round(doneShare * 100)));
  const setKind = currentSet?.kind === "warmup" ? ` · ${t("setWarmup")}` : currentSet?.kind === "drop" ? ` · ${t("setDrop")}` : "";
  $("#guided-set-progress").textContent = t("setProgress", {
    current: state.workout.currentSetIndex + 1,
    total: block.sets.length
  }) + setKind;
  const timed = isTimed(exercise);
  $("#guided-target-label").textContent = t(timed ? "targetSeconds" : "targetReps");
  $("#guided-reps-label").textContent = t(timed ? "fillSeconds" : "fillReps");
  $all('[data-step-unit="reps"]').forEach(button => {
    const up = Number(button.dataset.step) > 0;
    button.dataset.step = String((up ? 1 : -1) * (timed ? 5 : 1));
    button.setAttribute("aria-label", t(timed ? (up ? "moreSeconds" : "lessSeconds") : (up ? "moreReps" : "lessReps")));
  });
  $("#guided-target-reps").textContent = currentSet?.targetReps ?? currentSet?.reps ?? "-";
  renderSetChips(block, state.workout.currentSetIndex, timed);
  $("#rest-time-value").textContent = `${block.restSeconds} s`;
  $("#guided-reps-input").value = currentSet?.targetReps ?? currentSet?.reps ?? 0;
  $("#guided-weight-input").value = currentSet?.weight ?? 0;
}

/** gainage, positions tenues : on compte des secondes, pas des répétitions */
function isTimed(exercise) {
  return exercise?.contraction_type === "isometrique";
}

/** « 9 × 20 kg », « 30 s », « 12 » : une série en clair */
function setLabel(set, timed) {
  const kg = String(Number(set.weight) || 0).replace(".", ",");
  const amount = timed ? `${set.reps} s` : String(set.reps);
  return Number(set.weight) ? `${amount} × ${kg} kg` : amount;
}

/** Les séries de l'exercice en cours : faites (avec le détail), passées, en cours, à venir */
function renderSetChips(block, currentIndex, timed) {
  const list = $("#guided-sets");
  if (!list) return;
  list.classList.toggle("hidden", block.sets.length < 2);
  list.innerHTML = block.sets.map((set, index) => {
    const n = `S${index + 1}`;
    if (set.status === "done") return `<li class="set-chip is-done"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg><span>${n}</span> ${escapeHtml(setLabel(set, timed))}</li>`;
    if (set.status === "skipped") return `<li class="set-chip is-skipped"><span>${n}</span> ${escapeHtml(t("setChipSkipped"))}</li>`;
    if (index === currentIndex) return `<li class="set-chip is-now" aria-current="step"><span>${n}</span> ${escapeHtml(t("setChipNow"))}</li>`;
    return `<li class="set-chip"><span>${n}</span></li>`;
  }).join("");
}

/** « la dernière fois : 4 × 8 à 80 kg » (séries faites lors de la dernière séance de cet exercice) */
function lastTimeText(exerciseId) {
  if (!exerciseId) return "";
  const last = findLatestExerciseLog(exerciseId, state.sessionLogs);
  const done = (last?.sets || []).filter(set => set.status === "done" && set.kind !== "warmup");
  if (!done.length) return "";
  const timed = isTimed(getExerciseById(exerciseId, state.exercises));
  const unit = timed ? " s" : "";
  const kg = value => String(value).replace(".", ",");
  const sameReps = done.every(set => set.reps === done[0].reps);
  const sameWeight = done.every(set => set.weight === done[0].weight);
  let text;
  if (sameReps && sameWeight) text = `${done.length} × ${done[0].reps}${unit}${done[0].weight ? ` à ${kg(done[0].weight)} kg` : ""}`;
  else text = done.map(set => `${set.reps}${unit}${set.weight ? ` × ${kg(set.weight)}` : ""}`).join(" · ") + (done.some(set => set.weight) ? " kg" : "");
  return t("lastTime", { sets: text });
}

/** + / − sur les répétitions et le poids */
function stepInput(inputId, delta) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const next = Math.max(0, Math.round(((Number(input.value) || 0) + delta) * 10) / 10);
  input.value = String(next);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

// copie de la séance juste avant la dernière action, pour pouvoir l'annuler
function snapshotWorkout() {
  return JSON.parse(JSON.stringify(state.workout));
}

function offerUndo(snapshot, message) {
  // la séance est finie : le récap a pris le relais, plus rien à annuler
  if (!state.workout || isWorkoutComplete(state.workout)) return;
  showToast(message, {
    label: t("undo"),
    onClick: () => {
      if (!state.workout) return;
      state.workout = snapshot;
      stopRest();
      renderWorkout();
    }
  });
}

function handleNext() {
  if (!state.workout) return;

  const snapshot = snapshotWorkout();
  const reps = Number($("#guided-reps-input").value);
  const weight = Number($("#guided-weight-input").value);
  completeCurrentSet(state.workout, reps, weight);
  // une baisse de charge s'enchaîne sans repos
  if (getCurrentSet(state.workout)?.kind === "drop") stopRest();
  else startRest(getCurrentBlock(state.workout)?.restSeconds || 60);
  renderWorkout();
  offerUndo(snapshot, t("setDone"));
}

function skipSetFlow() {
  if (!state.workout) return;
  const snapshot = snapshotWorkout();
  skipCurrentSet(state.workout);
  renderWorkout();
  offerUndo(snapshot, t("setSkipped"));
}

function skipExerciseFlow() {
  if (!state.workout) return;
  const snapshot = snapshotWorkout();
  skipCurrentExercise(state.workout);
  renderWorkout();
  offerUndo(snapshot, t("exerciseSkipped"));
}

function startRest(seconds) {
  stopRest();
  document.body.classList.add("resting");
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
  document.body.classList.remove("resting");
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
  const lang = i18n.getLanguage();
  // exercices ajoutés par TrackLift : textes en français (repli sur le français si l'anglais manque)
  const frText = Boolean(exercise.description_fr);
  const pickText = (fr, en) => (lang === "fr" && fr?.length ? fr : (en?.length ? en : fr));
  const englishOnly = lang === "fr" && !exercise.custom && !frText;
  const description = pickText(exercise.description_fr, exercise.description) || "-";
  const instructions = pickText(exercise.instructions_fr, exercise.instructions) || [];
  const instructionsHtml = instructions.length ? `<ol class="tips-list">${instructions.map(item => `<li>${item}</li>`).join("")}</ol>` : "-";
  const tips = pickText(exercise.tips_fr, exercise.tips) || [];
  const tipsHtml = tips.length ? `<ul class="tips-list">${tips.map(item => `<li>${item}</li>`).join("")}</ul>` : "-";
  const meta = getExerciseMeta(exercise);
  const exerciseDisplayName = getExerciseName(exercise);
  const musclesLabel = primaryMusclesLabel(exercise, lang);

  const detailsModal = $("#modal-details");
  if (detailsModal) detailsModal.dataset.currentExerciseId = exercise.id;

  // Use GIF from ExerciseDB if available, otherwise fall back to static images
  const hasGif = false;
  // pas d'illustration (exercices ajoutés sans dessin) : on n'affiche pas deux cadres vides
  const imageHtml = !startImage.urls.length ? "" : hasGif
    ? `<div class="detail-gif-container mb-12">
        <div class="detail-block">
          <div class="meta-label">${t("animatedDemo")}</div>
          <img class="detail-gif" src="${exercise.gifUrl}" alt="${exerciseDisplayName}" loading="lazy">
        </div>
      </div>`
    : `<div class="detail-grid mb-12">
        <div class="detail-block">
          <div class="meta-label">${t("startMovement")}</div>
          <img class="detail-photo" id="img-detail-start" alt="${t("startMovement")} ${exerciseDisplayName}">
        </div>
        <div class="detail-block">
          <div class="meta-label">${t("endMovement")}</div>
          <img class="detail-photo" id="img-detail-end" alt="${t("endMovement")} ${exerciseDisplayName}">
        </div>
      </div>`;

  $("#exercise-details").innerHTML = `
    ${exercise.custom ? `<div class="section-actions mb-12"><span class="custom-tag">${t("customBadge")}</span><button type="button" class="btn btn-surface btn-sm" data-edit-custom>${t("customEdit")}</button></div>` : ""}
    <div class="detail-block">
      <div class="item-title">${exerciseDisplayName}</div>
      <div class="item-subtitle">${[meta.type, musclesLabel].filter(Boolean).join(" · ")}</div>
      <div class="small-meta">${[meta.equipment, meta.difficulty, meta.contractionType].filter(Boolean).join(" · ")}</div>
    </div>
    ${imageHtml}
    ${(exercise.primary_muscles || []).length ? `<div class="detail-block">
      <div class="meta-label">${t("musclesWorked")}</div>
      ${muscleMapHtml(exercise, { size: "md", label: musclesLabel })}
      ${muscleChipsHtml(exercise, { lang, labels: { primary: t("primaryMuscles"), secondary: t("secondaryMuscles") } })}
      <div class="mm-credit">${t("muscleMapCredit")}</div>
    </div>` : ""}
    ${englishOnly ? `<p class="detail-note">${t("noFrenchText")}</p>` : `
    <div class="detail-block">
      <div class="meta-label">${t("description")}</div>
      <div class="description-text">${description}</div>
    </div>
    <div class="detail-block">
      <div class="meta-label">${t("instructions")}</div>
      <div>${instructionsHtml}</div>
    </div>
    <div class="detail-block">
      <div class="meta-label">${t("tips")}</div>
      <div>${tipsHtml}</div>
    </div>`}
    <div class="detail-block">
      <div class="meta-label">${t("similar")}</div>
      <div class="detail-list">${similarExercises.map(item => `<span class="badge badge-link" data-similar-id="${item.id}">${getExerciseName(item)}</span>`).join("") || "-"}</div>
    </div>
  `;

  // Apply static image fallbacks only when not using GIF
  if (!hasGif) {
    applyImageFallback($("#img-detail-start"), startImage.urls, startImage.fallback);
    applyImageFallback($("#img-detail-end"), endImage.urls, endImage.fallback);
  }

  $("#exercise-details [data-edit-custom]")?.addEventListener("click", () => openCustomExercise({ exercise }));

  $("#exercise-details").querySelectorAll("[data-similar-id]").forEach(badge => {
    badge.addEventListener("click", () => {
      const similarExercise = getExerciseById(badge.dataset.similarId, state.exercises);
      if (similarExercise) renderExerciseDetails(similarExercise);
    });
  });
}

function updateUILanguage() {
  applyStaticTranslations();
  if (state.user) renderMyAvatar();
  if (state.activeView === "potes") mountPotes($("#view-potes"));

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
  // les séries pas encore faites comptent comme passées
  state.workout.blocks.forEach(block => block.sets.forEach(set => { if (set.status === "pending") set.status = "skipped"; }));
  const previousLogs = state.sessionLogs;
  const log = buildSessionLogFromWorkout(state.workout, state.exercises);
  const recap = buildRecap(log, previousLogs);
  DB.saveSessionLog(log);
  state.sessionLogs = DB.getSessionLogs();
  shareSessionWithPotes(recap);
  state.workout = null;
  stopRest();
  renderHome();
  setView("home");
  openRecap(recap);
}

/** Durée, séries, volume et records battus par rapport aux séances précédentes */
function buildRecap(log, previousLogs) {
  let sets = 0, volume = 0, reps = 0;
  const records = [];
  const compare = [];
  for (const ex of log.exercises) {
    const done = ex.sets.filter(set => set.status === "done");
    sets += done.length;
    reps += done.reduce((sum, set) => sum + (Number(set.reps) || 0), 0);
    volume += done.reduce((sum, set) => sum + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0);
    const line = compareWithLastTime(ex, done, previousLogs);
    if (line) compare.push(line);
    // règle commune avec la partie Potes (records du mois, notifications) : js/social-stats.js
    const record = findRecord(ex, previousLogs);
    if (record) {
      const exercise = getExerciseById(ex.exerciseId, state.exercises);
      records.push({ name: exercise ? getExerciseName(exercise) : ex.exerciseName, weight: record.weight, gain: record.gain });
    }
  }
  return { duration: log.durationMs, sets, volume: Math.round(volume), reps, records, compare, name: log.sessionName };
}

/** Meilleure série du jour contre la dernière fois : charge si chargé, sinon répétitions (ou secondes) */
function compareWithLastTime(ex, done, previousLogs) {
  const work = done.filter(set => set.kind !== "warmup");
  if (!work.length) return null;
  const exercise = getExerciseById(ex.exerciseId, state.exercises);
  const timed = isTimed(exercise);
  const loaded = work.some(set => Number(set.weight) > 0);
  const score = set => loaded ? Number(set.weight) || 0 : Number(set.reps) || 0;
  const best = work.reduce((a, b) => (score(b) > score(a) || (score(b) === score(a) && (Number(b.reps) || 0) > (Number(a.reps) || 0)) ? b : a));
  const last = findLatestExerciseLog(ex.exerciseId, previousLogs);
  const lastWork = (last?.sets || []).filter(set => set.status === "done" && set.kind !== "warmup");
  const lastBest = lastWork.length ? Math.max(...lastWork.map(score)) : null;
  return {
    name: exercise ? getExerciseName(exercise) : ex.exerciseName,
    best: setLabel(best, timed),
    delta: lastBest === null ? null : score(best) - lastBest,
    unit: loaded ? "kg" : timed ? "s" : t("recapRepsShort")
  };
}

function recapDuration(ms) {
  const min = Math.max(1, Math.round((ms || 0) / 60000));
  if (min < 60) return `${min}<small> min</small>`;
  return `${Math.floor(min / 60)}<small> h </small>${String(min % 60).padStart(2, "0")}`;
}

function openRecap(recap) {
  document.querySelector(".recap")?.remove();
  const kg = value => Number(value).toLocaleString(i18n.getLocale(), { maximumFractionDigits: 1 });
  const el = document.createElement("div");
  el.className = "recap";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "recap-title");
  const plural = recap.records.length > 1 ? "s" : "";
  const recordNames = new Set(recap.records.map(r => r.name));
  el.innerHTML = `
    <div class="recap-inner">
      <img class="recap-illu" src="./assets/illustrations/intro-03-progres.webp" alt="" width="180" height="300">
      <h2 id="recap-title" class="recap-title">${escapeHtml(t("recapTitle"))}</h2>
      <p class="recap-hand">${escapeHtml(recap.name || "")}</p>
      <div class="recap-stats">
        <div><b>${recapDuration(recap.duration)}</b><span>${escapeHtml(t("recapDuration"))}</span></div>
        <div><b>${recap.sets}</b><span>${escapeHtml(t("recapSets"))}</span></div>
        ${recap.volume > 0
          ? `<div><b>${kg(recap.volume)}<small> kg</small></b><span>${escapeHtml(t("recapVolume"))}</span></div>`
          : `<div><b>${recap.reps}</b><span>${escapeHtml(t("recapReps"))}</span></div>`}
      </div>
      ${recap.compare.length ? `
        <div class="recap-compare">
          <h3 class="recap-subtitle">${escapeHtml(t("recapVsLast"))}</h3>
          <ul>${recap.compare.slice(0, 5).map(c => {
            const tag = c.delta === null ? `<i class="cmp-new">${escapeHtml(t("recapFirst"))}</i>`
              : c.delta > 0 ? `<i class="cmp-up">+${kg(c.delta)} ${escapeHtml(c.unit)}</i>`
              : c.delta < 0 ? `<i class="cmp-down">${kg(c.delta).replace("-", "−")} ${escapeHtml(c.unit)}</i>`
              : `<i class="cmp-same">${escapeHtml(t("recapSame"))}</i>`;
            const record = recordNames.has(c.name) ? `<em class="cmp-record">${escapeHtml(t("recordPr"))}</em>` : "";
            return `<li><span>${escapeHtml(c.name)}${record}</span><b>${escapeHtml(c.best)}</b>${tag}</li>`;
          }).join("")}</ul>
          ${recap.compare.length > 5 ? `<p class="recap-more">${escapeHtml(t("recapMoreExercises", { count: recap.compare.length - 5, plural: recap.compare.length - 5 > 1 ? "s" : "" }))}</p>` : ""}
        </div>` : ""}
      ${recap.records.length && !recap.compare.length ? `
        <div class="recap-records">
          <h3 class="recap-subtitle">${escapeHtml(t("recapRecords", { plural }))}</h3>
          <ul>${recap.records.slice(0, 3).map(r => `<li><span>${escapeHtml(r.name)}</span><b>${kg(r.weight)} kg <small>+${kg(r.gain)} kg</small></b></li>`).join("")}</ul>
          ${recap.records.length > 3 ? `<p class="recap-more">${escapeHtml(t("recordMore", { count: recap.records.length - 3, plural: recap.records.length - 3 > 1 ? "s" : "" }))}</p>` : ""}
        </div>` : recap.records.length ? "" : `<p class="recap-none">${escapeHtml(t("recapNoRecord"))}</p>`}
      <div class="recap-actions">
        <button type="button" class="btn btn-primary btn-block recap-done">${escapeHtml(t("recapDone"))}</button>
        <button type="button" class="recap-link">${escapeHtml(t("seeProgress"))}</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  document.documentElement.classList.add("ob-open");
  const close = goProgress => {
    el.remove();
    document.documentElement.classList.remove("ob-open");
    document.removeEventListener("keydown", onKey);
    if (goProgress) setView("progress");
  };
  const onKey = event => { if (event.key === "Escape") close(false); };
  document.addEventListener("keydown", onKey);
  el.querySelector(".recap-done").addEventListener("click", () => close(false));
  el.querySelector(".recap-link").addEventListener("click", () => close(true));
  el.querySelector(".recap-done").focus();
}

// ─── ExerciseDB sync ───────────────────────────────────────────

function updateExerciseDBStatus() {
  const statusEl = $("#exercisedb-status");
  if (!statusEl) return;

  const info = ExerciseDBAPI.getSyncInfo();
  if (info.synced) {
    const date = new Date(info.lastSync).toLocaleDateString();
    statusEl.textContent = `${info.matchCount} GIFs (${date})`;
    statusEl.className = "exercisedb-status synced";
  } else {
    statusEl.textContent = t("exercisedbNotSynced");
    statusEl.className = "exercisedb-status";
  }
}

async function syncExerciseDB() {
  const syncBtn = $("#exercisedb-sync-btn");
  if (syncBtn) syncBtn.disabled = true;

  try {
    showToast(t("exercisedbSyncing"));
    const result = await ExerciseDBAPI.syncExercises(null, state.exercises, (msg) => {
      console.log("[ExerciseDB]", msg);
    });

    // Apply gif URLs to current exercises and re-render
    ExerciseDBAPI.applyGifUrls(state.exercises);
    updateExerciseDBStatus();
    renderExerciseList();
    showToast(`${t("exercisedbSyncDone")} ${result.matchCount}/${state.exercises.length} GIFs`);
  } catch (error) {
    console.error("[ExerciseDB] sync error:", error);
    showToast(`${t("exercisedbSyncError")}: ${error.message}`);
  } finally {
    if (syncBtn) syncBtn.disabled = false;
  }
}

init();
