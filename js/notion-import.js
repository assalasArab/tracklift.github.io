/* ═══════════════════════════════════════════════════════════
   Import depuis Notion.
   1. « Mon Notion » : l'utilisateur connecte son propre Notion (OAuth, comme Google),
      coche ses bases, l'appli en fait un programme (une base = une séance)
      ou importe l'historique si les lignes sont datées.
      Les appels passent par le relais notion-proxy/worker.js (secret côté serveur).
   2. « Fichier CSV » : export Markdown & CSV de Notion, mêmes deux usages.
   ═══════════════════════════════════════════════════════════ */
import { NOTION_PROXY_URL } from "./notion-config.js?v=20261024e";
import {
  buildIndex, suggest, AUTO_MATCH, guessProgramMapping, parseSessionTable,
  planFromSets, describeSets, guessSessionType, cleanName, norm as normName
} from "./notion-program.js?v=20261024e";

const SETTINGS_KEY = "tracklift_notion";
const NONCE_KEY = "tracklift_notion_nonce";

const FIELDS = [
  ["date", "Date", /^(date|jour|day|quand|when)/i],
  ["session", "Séance", /(s[eé]ance|session|workout|entra[iî]nement|training|name|nom|titre|title)/i],
  ["exercise", "Exercice", /(exercice|exercise|mouvement|movement|exo)/i],
  ["sets", "Séries", /^(s[eé]ries?|sets?|nb ?s[eé]ries)$/i],
  ["reps", "Répétitions", /^(r[eé]p[eé]titions?|r[eé]ps?|nb ?reps?)\b/i],
  ["weight", "Charge (kg)", /(poids|charge|kg|weight|load|lourd)/i]
];

const PROGRAM_FIELDS = [
  ["exercise", "Exercice"],
  ["weight", "Poids"],
  ["reps", "Répétitions"],
  ["sets", "Séries (si une ligne = un exercice)"],
  ["kind", "Chauffe / travail"],
  ["dropWeight", "Poids baisse de charge"],
  ["dropReps", "Reps baisse de charge"],
  ["status", "Statut (en pause = ignoré)"]
];

const SESSION_TYPES = [["push", "Push"], ["pull", "Pull"], ["legs", "Jambes"], ["full", "Haut / complet"], ["other", "Autre"]];

const FR_MONTHS = { janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6, aout: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11 };

let ui = null;

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; }
}
function saveSettings(patch) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...loadSettings(), ...patch })); } catch { /* stockage indisponible */ }
}

function norm(value) {
  return String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------- CSV (RFC 4180, séparateur , ou ; détecté) ---------- */
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] || "";
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows.filter(r => r.some(c => c.trim() !== ""));
  if (!header) return { columns: [], rows: [] };
  const columns = header.map(h => h.trim());
  return { columns, rows: body.map((r, i) => ({ __created: String(i).padStart(6, "0"), ...Object.fromEntries(columns.map((c, j) => [c, (r[j] ?? "").trim()])) })) };
}

/* ---------- détection des colonnes (historique) ---------- */
export function guessMapping(columns) {
  const used = new Set();
  const mapping = {};
  for (const [key, , pattern] of FIELDS) {
    const col = columns.find(c => !used.has(c) && pattern.test(c.trim()));
    if (col) { mapping[key] = col; used.add(col); }
  }
  return mapping;
}

/* ---------- conversions ---------- */
function parseDate(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3], 12).getTime();
  const dmy = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/.exec(s);
  if (dmy) {
    const y = +dmy[3] < 100 ? 2000 + +dmy[3] : +dmy[3];
    return new Date(y, +dmy[2] - 1, +dmy[1], 12).getTime();
  }
  const fr = /(\d{1,2})\s+([a-zéû]+)\s+(\d{4})/i.exec(s);
  if (fr && FR_MONTHS[norm(fr[2])] !== undefined) return new Date(+fr[3], FR_MONTHS[norm(fr[2])], +fr[1], 12).getTime();
  const parsed = Date.parse(s.replace(/\(.*\)/, "").replace(/→.*$/, ""));
  if (isNaN(parsed)) return null;
  const d = new Date(parsed);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
}

function localDay(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* "8" → [8] · "12,12,10" ou "12/12/10" → [12,12,10] · charge "12,5" → [12.5] (virgule décimale si une seule) */
function numbers(value, decimalComma = false) {
  let s = String(value ?? "");
  if (decimalComma && (s.match(/,/g) || []).length === 1 && /\d,\d{1,2}(?!\d)/.test(s) && !/[;/|]/.test(s)) s = s.replace(",", ".");
  return (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
}

function guessType(sessionName, exercises) {
  const n = norm(sessionName);
  if (/\bpush\b|pec|poussee/.test(n)) return "push";
  if (/\bpull\b|dos|tirage/.test(n)) return "pull";
  if (/leg|jambe|squat|bas\b/.test(n)) return "legs";
  if (/full|complet|haut/.test(n)) return "full";
  const counts = {};
  exercises.forEach(ex => { counts[ex.type] = (counts[ex.type] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "other";
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/**
 * Convertit des lignes datées (objets colonne → valeur) en séances TrackLift.
 * Une ligne = un exercice d'une séance (séries / reps / charge), ou une série si la colonne Séries est vide.
 */
export function rowsToSessionLogs(rows, mapping, { exercises, nameOf }) {
  const lookup = new Map();
  for (const ex of exercises) {
    lookup.set(norm(ex.name), ex);
    const display = nameOf ? nameOf(ex) : "";
    if (display) lookup.set(norm(display), ex);
  }
  const groups = new Map();
  let skipped = 0;

  for (const row of rows) {
    const date = parseDate(row[mapping.date]);
    if (!date) { skipped++; continue; }
    const day = localDay(date);
    const sessionName = (mapping.session && String(row[mapping.session] || "").trim()) || "Séance Notion";
    const key = `${day}|${norm(sessionName)}`;
    if (!groups.has(key)) groups.set(key, { key, date, sessionName, exercises: new Map() });
    const group = groups.get(key);

    const exName = mapping.exercise ? cleanName(row[mapping.exercise]) : "";
    if (!exName) continue;
    const match = lookup.get(norm(exName));
    const exKey = match ? match.id : norm(exName);
    if (!group.exercises.has(exKey)) {
      group.exercises.set(exKey, {
        exerciseId: match ? match.id : `notion_${norm(exName).replace(/ /g, "_")}`,
        exerciseName: match ? match.name : exName,
        muscleFocus: match?.muscle_focus || "other",
        type: match?.type || "other",
        sets: [],
        restSeconds: 90
      });
    }

    const reps = numbers(row[mapping.reps]);
    const weights = numbers(row[mapping.weight], true);
    const declaredSets = Math.round(numbers(row[mapping.sets])[0] || 0);
    const count = Math.max(declaredSets, reps.length, weights.length, 1);
    for (let i = 0; i < count; i++) {
      const r = reps[i] ?? reps[reps.length - 1] ?? 0;
      group.exercises.get(exKey).sets.push({
        reps: r,
        targetReps: r,
        weight: weights[i] ?? weights[weights.length - 1] ?? 0,
        status: "done"
      });
    }
  }

  const logs = [...groups.values()].map(group => {
    const exercisesList = [...group.exercises.values()];
    return {
      id: `notion_${hash(group.key)}`,
      sessionName: group.sessionName,
      type: guessType(group.sessionName, exercisesList),
      programId: null,
      source: "notion",
      date: group.date,
      durationMs: 0,
      exercises: exercisesList
    };
  }).sort((a, b) => a.date - b.date);

  return { logs, skipped };
}

export function extractDatabaseId(input) {
  const hex = String(input || "").replace(/-/g, "").match(/[0-9a-f]{32}/i);
  return hex ? hex[0].toLowerCase() : "";
}

/* ═══════════════════ Connexion Notion (OAuth) ═══════════════════ */
export function notionConnectAvailable() {
  return /^https:\/\//.test(NOTION_PROXY_URL);
}

function proxyUrl(path) {
  return NOTION_PROXY_URL.replace(/\/+$/, "") + path;
}

function randomNonce() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Part vers la page d'autorisation Notion ; le relais renvoie ensuite vers l'appli */
function startNotionAuth() {
  const nonce = randomNonce();
  try { sessionStorage.setItem(NONCE_KEY, nonce); } catch { /* onglet privé : la vérification échouera au retour */ }
  const back = location.origin + location.pathname;
  location.href = proxyUrl(`/oauth/start?return=${encodeURIComponent(back)}&nonce=${encodeURIComponent(nonce)}`);
}

/**
 * À appeler au démarrage, avant tout rendu : lit le retour de Notion dans l'URL (#notion_auth=…)
 * puis nettoie l'URL. → null, { ok:true, connection } ou { ok:false, error }
 */
export function captureNotionRedirect() {
  const match = /^#notion_auth=([A-Za-z0-9_-]+)/.exec(location.hash || "");
  if (!match) return null;
  history.replaceState(null, "", location.pathname + location.search);
  let payload;
  try {
    const bin = atob(match[1].replace(/-/g, "+").replace(/_/g, "/"));
    payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
  } catch {
    return { ok: false, error: "Réponse de Notion illisible. Réessaie." };
  }
  let expected = null;
  try { expected = sessionStorage.getItem(NONCE_KEY); sessionStorage.removeItem(NONCE_KEY); } catch { /* indisponible */ }
  if (!expected || payload.nonce !== expected) return { ok: false, error: "Vérification de sécurité échouée. Relance la connexion depuis l'appli." };
  if (!payload.ok || !payload.connection?.token) return { ok: false, error: payload.error || "Connexion à Notion impossible." };
  return { ok: true, connection: { ...payload.connection, connectedAt: Date.now() } };
}

async function callProxy(path, body) {
  const run = async conn => {
    const response = await fetch(proxyUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${conn.token}` },
      body: JSON.stringify(body || {})
    });
    const data = await response.json().catch(() => ({}));
    return { status: response.status, ok: response.ok, data };
  };
  let res = await run(ui.conn);
  if (res.status === 401 && ui.conn.refreshToken) {
    const refreshed = await fetch(proxyUrl("/oauth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: ui.conn.refreshToken })
    }).then(r => r.ok ? r.json() : null).catch(() => null);
    if (refreshed?.token) {
      ui.conn = { ...ui.conn, ...refreshed };
      ui.ctx.saveConnection(ui.conn);
      res = await run(ui.conn);
    }
  }
  if (res.status === 401) {
    const err = new Error("Ta connexion Notion a expiré. Reconnecte-toi.");
    err.expired = true;
    throw err;
  }
  if (!res.ok) throw new Error(res.data.error || `Erreur ${res.status}`);
  return res.data;
}

/* ═══════════════════ Préparation de l'aperçu ═══════════════════ */
function hasDates(tables) {
  return tables.some(table => {
    const col = guessMapping(table.columns).date;
    return col && table.rows.some(r => parseDate(r[col]));
  });
}

/** Lit les tables chargées et calcule séances, exercices et correspondances */
function prepareReview(input) {
  // ordre de la semaine : push, pull, jambes, haut / complet, autres
  const rank = ["push", "pull", "legs", "full", "other"];
  const tables = [...input].sort((a, b) => rank.indexOf(guessSessionType(a.title)) - rank.indexOf(guessSessionType(b.title)));
  ui.tables = tables;
  ui.canHistory = hasDates(tables);
  ui.mode = "program";
  const columns = [...new Set(tables.flatMap(t => t.columns))];
  const allRows = tables.flatMap(t => t.rows);
  const saved = loadSettings().programMapping || {};
  const guess = guessProgramMapping(columns, allRows);
  ui.pmap = {};
  PROGRAM_FIELDS.forEach(([key]) => { ui.pmap[key] = columns.includes(saved[key]) ? saved[key] : guess[key] || ""; });
  ui.includePaused = false;
  const parents = [...new Set(tables.map(t => t.parentTitle).filter(Boolean))];
  ui.programName = parents.length === 1 ? parents[0] : "Mon programme Notion";
  ui.sessions = tables.map(t => ({ tableId: t.id, name: t.title, type: guessSessionType(t.title), include: true }));
  ui.choices = {};
  // historique
  const hmapSaved = loadSettings().mapping || {};
  const hguess = guessMapping(columns);
  ui.hmap = {};
  FIELDS.forEach(([key]) => { ui.hmap[key] = columns.includes(hmapSaved[key]) ? hmapSaved[key] : hguess[key] || ""; });
  if (!ui.hmap.session && tables.length > 1) ui.hmap.session = "__table";
  computeProgram();
  ui.step = "review";
}

function computeProgram() {
  const index = ui.index || (ui.index = buildIndex(ui.ctx.exercises));
  ui.parsed = ui.tables.map((table, i) => {
    const res = parseSessionTable(table.rows, ui.pmap, { includePaused: ui.includePaused });
    res.exercises.forEach(ex => {
      ex.suggestions = suggest(ex.name, index, 5);
      const key = normName(ex.name);
      ex.choiceKey = key;
      if (!(key in ui.choices)) {
        const top = ex.suggestions[0];
        ui.choices[key] = top && top.score >= AUTO_MATCH ? top.id : "custom";
      }
    });
    const matchedTypes = res.exercises.map(ex => ui.ctx.exercises.find(e => e.id === ui.choices[ex.choiceKey])?.type).filter(Boolean);
    if (!ui.sessions[i].typeTouched) ui.sessions[i].type = guessSessionType(table.title, matchedTypes);
    return res;
  });
}

/** Programme final + exercices perso à créer */
function buildProgram() {
  const customs = new Map();
  const sessions = [];
  ui.parsed.forEach((res, i) => {
    const cfg = ui.sessions[i];
    if (!cfg.include) return;
    const exerciseIds = [];
    const plan = {};
    for (const ex of res.exercises) {
      let id = ui.choices[ex.choiceKey];
      if (!id || id === "skip") continue;
      if (id === "custom") {
        if (!customs.has(ex.choiceKey)) customs.set(ex.choiceKey, { name: ex.name, type: cfg.type });
        id = `custom:${ex.choiceKey}`;
      }
      const p = planFromSets(ex.sets);
      if (plan[id]) {
        // deux lignes Notion vers le même exercice : on additionne les séries
        plan[id].setList.push(...p.setList);
        plan[id].sets += p.sets;
      } else {
        plan[id] = p;
        exerciseIds.push(id);
      }
    }
    if (exerciseIds.length) sessions.push({ name: cfg.name.trim() || `Séance ${sessions.length + 1}`, type: cfg.type, exerciseIds, plan });
  });
  return {
    program: {
      name: ui.programName.trim() || "Mon programme Notion",
      description: `Importé de Notion — ${sessions.length} séance${sessions.length > 1 ? "s" : ""}`,
      split: "custom",
      source: "notion",
      sessions
    },
    customs: [...customs.entries()].map(([key, value]) => ({ key, ...value }))
  };
}

/* ═══════════════════ Interface (feuille modale) ═══════════════════ */
function exerciseLabel(id) {
  const ex = ui.ctx.exercises.find(e => e.id === id);
  return ex ? (ui.ctx.nameOf ? ui.ctx.nameOf(ex) : ex.name) : id;
}

function connectHtml() {
  if (!notionConnectAvailable()) {
    return `<p class="ni-help">La connexion directe à Notion n'est pas encore activée sur cette appli. En attendant, utilise l'onglet <b>Fichier CSV</b>.</p>`;
  }
  if (!ui.conn) {
    return `
      <p class="ni-help">Connecte ton compte Notion, comme pour Google. Sur la page de Notion, coche les pages qui contiennent tes séances : TrackLift ne pourra lire que celles-là.</p>
      <button class="btn btn-primary btn-block" data-ni="connect">Connecter mon Notion</button>`;
  }
  const head = `
    <div class="ni-conn">
      <span>Connecté à <b>${esc(ui.conn.workspaceName || "Notion")}</b></span>
      <span class="ni-conn-actions">
        <button class="ni-link" data-ni="connect">Choisir d'autres pages</button>
        <button class="ni-link" data-ni="disconnect">Déconnecter</button>
      </span>
    </div>`;
  if (ui.loading) return head + `<div class="ni-status">${esc(ui.loading)}</div>`;
  if (!ui.databases) return head;
  if (!ui.databases.length) {
    return head + `<p class="ni-empty">Aucune base accessible. Clique sur <b>Choisir d'autres pages</b> et coche la page qui contient tes séances.</p>`;
  }
  const groups = new Map();
  ui.databases.forEach(db => {
    const key = db.parentTitle || "Autres bases";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(db);
  });
  const list = [...groups.entries()].map(([title, dbs]) => `
    <fieldset class="ni-group">
      <legend>${esc(title)}</legend>
      ${dbs.map(db => `
        <label class="ni-check">
          <input type="checkbox" data-ni-db="${esc(db.id)}" ${ui.selected.has(db.id) ? "checked" : ""}>
          <span>${esc(db.title)}</span>
          <small>${db.columns.length} colonnes</small>
        </label>`).join("")}
    </fieldset>`).join("");
  const n = ui.selected.size;
  return head + `
    <p class="ni-help">Coche une base par séance (par exemple Push, Pull, Legs, Upper).</p>
    ${list}
    <button class="btn btn-primary btn-block mt-12" data-ni="read" ${n ? "" : "disabled"}>${n ? `Lire ${n} base${n > 1 ? "s" : ""}` : "Coche au moins une base"}</button>`;
}

function csvHtml() {
  return `
    <p class="ni-help">Dans Notion, ouvre ta base → <b>⋯</b> → <b>Exporter</b> → format <b>Markdown &amp; CSV</b>. Décompresse le fichier puis choisis un ou plusieurs <b>.csv</b> (un par séance).</p>
    <label class="btn btn-ghost btn-block ni-file">Choisir les fichiers CSV<input type="file" accept=".csv,text/csv" multiple data-ni="file" hidden></label>`;
}

function mappingSelect(map, key, columns, extra = "") {
  return `<select class="input" data-ni-${extra}map="${key}">
    <option value="">— aucune —</option>
    ${extra === "h" && ui.tables.length > 1 && key === "session" ? `<option value="__table" ${map[key] === "__table" ? "selected" : ""}>(nom de la base)</option>` : ""}
    ${columns.map(c => `<option value="${esc(c)}" ${map[key] === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
  </select>`;
}

function programReviewHtml() {
  const columns = [...new Set(ui.tables.flatMap(t => t.columns))];
  const pausedTotal = ui.parsed.reduce((s, r) => s + r.paused, 0);
  const sessionsHtml = ui.parsed.map((res, i) => {
    const cfg = ui.sessions[i];
    const rows = res.exercises.map(ex => {
      const choice = ui.choices[ex.choiceKey];
      const options = ex.suggestions.map(s => `<option value="${esc(s.id)}" ${choice === s.id ? "selected" : ""}>${esc(exerciseLabel(s.id))}</option>`).join("");
      const current = choice && !["custom", "skip"].includes(choice) && !ex.suggestions.some(s => s.id === choice)
        ? `<option value="${esc(choice)}" selected>${esc(exerciseLabel(choice))}</option>` : "";
      return `
        <li class="ni-ex">
          <div class="ni-ex-name"><b>${esc(ex.name)}</b><small>${esc(describeSets(ex.sets))}</small></div>
          <select class="input" data-ni-choice="${esc(ex.choiceKey)}" aria-label="Exercice TrackLift pour ${esc(ex.name)}">
            ${current}${options}
            <option value="custom" ${choice === "custom" ? "selected" : ""}>Créer « ${esc(ex.name)} » (exercice perso)</option>
            <option value="skip" ${choice === "skip" ? "selected" : ""}>Ne pas importer</option>
          </select>
        </li>`;
    }).join("");
    return `
      <section class="ni-session${cfg.include ? "" : " is-off"}">
        <div class="ni-session-head">
          <label class="ni-check ni-check-inline"><input type="checkbox" data-ni-include="${i}" ${cfg.include ? "checked" : ""}><span class="sr-only">Inclure</span></label>
          <input class="input" data-ni-sname="${i}" value="${esc(cfg.name)}" aria-label="Nom de la séance">
          <select class="input ni-type" data-ni-stype="${i}" aria-label="Type de séance">
            ${SESSION_TYPES.map(([v, l]) => `<option value="${v}" ${cfg.type === v ? "selected" : ""}>${l}</option>`).join("")}
          </select>
        </div>
        ${res.exercises.length ? `<ul class="ni-ex-list">${rows}</ul>` : `<p class="ni-empty">Aucun exercice trouvé dans cette base. Vérifie la colonne « Exercice » plus bas.</p>`}
        ${res.paused ? `<p class="ni-note">${res.paused} ligne${res.paused > 1 ? "s" : ""} en pause ignorée${res.paused > 1 ? "s" : ""}.</p>` : ""}
      </section>`;
  }).join("");

  const { program, customs } = buildProgram();
  const exCount = program.sessions.reduce((s, x) => s + x.exerciseIds.length, 0);
  return `
    <label class="label" for="ni-pname">Nom du programme</label>
    <input class="input" id="ni-pname" data-ni="pname" value="${esc(ui.programName)}">
    <p class="ni-help mt-12">Vérifie la correspondance de chaque exercice. Ceux que l'appli ne reconnaît pas sont créés comme exercices perso.</p>
    ${sessionsHtml}
    ${ui.pmap.status ? `<label class="ni-check"><input type="checkbox" data-ni="paused" ${ui.includePaused ? "checked" : ""}><span>Inclure les lignes en pause${pausedTotal && !ui.includePaused ? ` (${pausedTotal})` : ""}</span></label>` : ""}
    <details class="ni-details">
      <summary>Colonnes utilisées</summary>
      <div class="ni-map">${PROGRAM_FIELDS.map(([key, label]) => `
        <label class="ni-map-row"><span>${label}</span>${mappingSelect(ui.pmap, key, columns, "p")}</label>`).join("")}
      </div>
    </details>
    <div class="ni-footer">
      <p class="ni-total">${program.sessions.length} séance${program.sessions.length > 1 ? "s" : ""} · ${exCount} exercice${exCount > 1 ? "s" : ""}${customs.length ? ` · ${customs.length} exercice${customs.length > 1 ? "s" : ""} perso à créer` : ""}</p>
      <button class="btn btn-primary btn-block" data-ni="create" ${exCount ? "" : "disabled"}>Créer le programme</button>
    </div>`;
}

function historyReviewHtml() {
  const columns = [...new Set(ui.tables.flatMap(t => t.columns))];
  const rows = ui.tables.flatMap(t => t.rows.map(r => ({ ...r, __table: t.title })));
  const result = ui.hmap.date ? rowsToSessionLogs(rows, ui.hmap, ui.ctx) : { logs: [], skipped: rows.length };
  const fresh = result.logs.filter(log => !ui.ctx.existingIds.has(log.id));
  ui.result = fresh;
  const unmatched = new Set();
  fresh.forEach(log => log.exercises.forEach(ex => { if (ex.exerciseId.startsWith("notion_")) unmatched.add(ex.exerciseName); }));
  return `
    <p class="ni-help">${rows.length} ligne${rows.length > 1 ? "s" : ""} lue${rows.length > 1 ? "s" : ""}. Associe les colonnes :</p>
    <div class="ni-map">${FIELDS.map(([key, label]) => `
      <label class="ni-map-row"><span>${label}${key === "date" ? " *" : ""}</span>${mappingSelect(ui.hmap, key, columns, "h")}</label>`).join("")}
    </div>
    <div class="ni-footer">
      <p class="ni-total">${ui.hmap.date ? `${fresh.length} nouvelle${fresh.length > 1 ? "s" : ""} séance${fresh.length > 1 ? "s" : ""} à importer${result.logs.length - fresh.length ? ` · ${result.logs.length - fresh.length} déjà importée(s)` : ""}${result.skipped ? ` · ${result.skipped} ligne(s) sans date ignorée(s)` : ""}` : "Choisis au moins la colonne Date."}</p>
      ${unmatched.size ? `<p class="ni-note">Exercices non reconnus (gardés tels quels) : ${[...unmatched].slice(0, 8).map(esc).join(", ")}${unmatched.size > 8 ? "…" : ""}</p>` : ""}
      <button class="btn btn-primary btn-block" data-ni="import" ${fresh.length ? "" : "disabled"}>Importer ${fresh.length} séance${fresh.length > 1 ? "s" : ""}</button>
    </div>`;
}

function render() {
  const body = ui.el.querySelector(".ni-body");
  const scroll = body.scrollTop;
  let html = "";
  if (ui.step === "review") {
    html += `<button class="ni-link ni-back" data-ni="back">← Retour</button>`;
    if (ui.canHistory) {
      html += `<div class="tab-row" role="group" aria-label="Que faire de ces données">
        <button class="tab-btn${ui.mode === "program" ? " active" : ""}" data-ni-mode="program" aria-pressed="${ui.mode === "program"}">Créer un programme</button>
        <button class="tab-btn${ui.mode === "history" ? " active" : ""}" data-ni-mode="history" aria-pressed="${ui.mode === "history"}">Importer l'historique</button>
      </div>`;
    }
    if (ui.error) html += `<div class="auth-error mt-12" role="alert">${esc(ui.error)}</div>`;
    html += ui.mode === "history" ? historyReviewHtml() : programReviewHtml();
  } else {
    html += `<div class="tab-row" role="tablist">
      <button class="tab-btn${ui.tab === "notion" ? " active" : ""}" data-ni-tab="notion" role="tab" aria-selected="${ui.tab === "notion"}">Mon Notion</button>
      <button class="tab-btn${ui.tab === "csv" ? " active" : ""}" data-ni-tab="csv" role="tab" aria-selected="${ui.tab === "csv"}">Fichier CSV</button>
    </div>`;
    if (ui.error) html += `<div class="auth-error" role="alert">${esc(ui.error)}</div>`;
    html += ui.tab === "notion" ? connectHtml() : csvHtml();
  }
  body.innerHTML = html;
  body.scrollTop = scroll;
}

async function loadDatabases() {
  ui.loading = "Recherche de tes bases Notion…";
  ui.error = "";
  render();
  try {
    const data = await callProxy("/databases");
    ui.databases = (data.databases || []).sort((a, b) => (a.parentTitle || "~").localeCompare(b.parentTitle || "~") || a.title.localeCompare(b.title));
    const remembered = new Set(loadSettings().selectedDatabases || []);
    ui.selected = new Set(ui.databases.filter(d => remembered.has(d.id)).map(d => d.id));
  } catch (err) {
    if (err.expired) { ui.conn = null; ui.ctx.saveConnection(null); }
    ui.error = err.message;
  }
  ui.loading = "";
  render();
}

async function readSelected() {
  const chosen = ui.databases.filter(d => ui.selected.has(d.id));
  saveSettings({ selectedDatabases: chosen.map(d => d.id) });
  ui.error = "";
  const tables = [];
  try {
    for (const [i, db] of chosen.entries()) {
      ui.loading = `Lecture de « ${db.title} » (${i + 1}/${chosen.length})…`;
      render();
      const data = await callProxy("/query", { databaseId: db.id });
      tables.push({ id: db.id, title: db.title, parentTitle: db.parentTitle, columns: data.columns || [], rows: data.rows || [] });
    }
  } catch (err) {
    if (err.expired) { ui.conn = null; ui.ctx.saveConnection(null); }
    ui.loading = "";
    ui.error = `Lecture impossible : ${err.message}`;
    render();
    return;
  }
  ui.loading = "";
  if (!tables.some(t => t.rows.length)) {
    ui.error = "Ces bases sont vides.";
    render();
    return;
  }
  prepareReview(tables);
  render();
}

function close() {
  if (!ui) return;
  ui.el.remove();
  document.removeEventListener("keydown", ui.onKey);
  ui = null;
}

/**
 * opts: {
 *   exercises, nameOf, existingIds:Set,
 *   connection, saveConnection(conn|null),
 *   onImport(logs), onCreateProgram({ program, customs })
 * }
 */
export function openNotionImport(opts) {
  if (ui) return;
  const el = document.createElement("div");
  el.className = "modal";
  el.innerHTML = `<div class="modal-card large-modal ni-card" role="dialog" aria-modal="true" aria-labelledby="ni-title">
    <div class="modal-head"><h3 id="ni-title">Importer depuis Notion</h3><button class="icon-btn" data-ni="close" aria-label="Fermer">✕</button></div>
    <div class="ni-body"></div></div>`;
  document.body.appendChild(el);
  ui = {
    el, ctx: opts, conn: opts.connection || null,
    tab: notionConnectAvailable() ? "notion" : "csv",
    step: "source", databases: null, selected: new Set(),
    loading: "", error: opts.error || "", tables: [], result: []
  };
  ui.onKey = event => { if (event.key === "Escape") close(); };
  document.addEventListener("keydown", ui.onKey);

  el.addEventListener("click", async event => {
    if (event.target === el) { close(); return; }
    const tab = event.target.closest("[data-ni-tab]");
    if (tab) { ui.tab = tab.dataset.niTab; ui.error = ""; render(); if (ui.tab === "notion" && ui.conn && !ui.databases) loadDatabases(); return; }
    const mode = event.target.closest("[data-ni-mode]");
    if (mode) { ui.mode = mode.dataset.niMode; ui.error = ""; render(); return; }
    const action = event.target.closest("[data-ni]")?.dataset.ni;
    if (action === "close") close();
    if (action === "connect") startNotionAuth();
    if (action === "disconnect") {
      ui.conn = null; ui.databases = null; ui.selected = new Set();
      opts.saveConnection(null);
      render();
    }
    if (action === "read") readSelected();
    if (action === "back") { ui.step = "source"; ui.error = ""; render(); }
    if (action === "create") {
      const built = buildProgram();
      if (!built.program.sessions.length) return;
      saveSettings({ programMapping: ui.pmap });
      close();
      opts.onCreateProgram(built);
    }
    if (action === "import" && ui.result.length) {
      saveSettings({ mapping: ui.hmap });
      const logs = ui.result;
      close();
      opts.onImport(logs);
    }
  });

  el.addEventListener("change", event => {
    const target = event.target;
    if (target.dataset.ni === "file") {
      const files = [...target.files];
      if (!files.length) return;
      Promise.all(files.map(file => file.text().then(text => ({ file, data: parseCsv(text) })))).then(results => {
        const tables = results.filter(r => r.data.rows.length).map((r, i) => ({
          id: `csv${i}`,
          // « Push 1a2b3c….csv » (export Notion) → « Push »
          title: r.file.name.replace(/\.csv$/i, "").replace(/\s+[0-9a-f]{32}$/i, "").replace(/_all$/i, "").trim() || `Séance ${i + 1}`,
          parentTitle: "",
          columns: r.data.columns,
          rows: r.data.rows
        }));
        if (!tables.length) { ui.error = "Fichier vide ou illisible."; render(); return; }
        ui.error = "";
        prepareReview(tables);
        render();
      });
      return;
    }
    if (target.dataset.niDb) {
      if (target.checked) ui.selected.add(target.dataset.niDb); else ui.selected.delete(target.dataset.niDb);
      render();
      return;
    }
    if (target.dataset.niChoice) { ui.choices[target.dataset.niChoice] = target.value; computeProgram(); render(); return; }
    if (target.dataset.niInclude !== undefined) { ui.sessions[+target.dataset.niInclude].include = target.checked; render(); return; }
    if (target.dataset.niStype !== undefined) { const s = ui.sessions[+target.dataset.niStype]; s.type = target.value; s.typeTouched = true; render(); return; }
    if (target.dataset.ni === "paused") { ui.includePaused = target.checked; computeProgram(); render(); return; }
    if (target.dataset.niPmap) { ui.pmap[target.dataset.niPmap] = target.value; computeProgram(); render(); return; }
    if (target.dataset.niHmap) { ui.hmap[target.dataset.niHmap] = target.value; render(); return; }
  });

  // les champs texte ne re-rendent pas (pour garder le focus)
  el.addEventListener("input", event => {
    const target = event.target;
    if (target.dataset.ni === "pname") ui.programName = target.value;
    if (target.dataset.niSname !== undefined) ui.sessions[+target.dataset.niSname].name = target.value;
  });

  render();
  if (ui.tab === "notion" && ui.conn) loadDatabases();
}
