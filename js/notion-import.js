/* ═══════════════════════════════════════════════════════════
   Import des entraînements depuis Notion.
   Deux voies :
   1. Fichier CSV exporté depuis Notion (⋯ → Exporter → Markdown & CSV).
   2. API Notion via un relais Cloudflare Worker (notion-proxy/worker.js) :
      l'API Notion refuse les appels directs depuis un navigateur et
      exige un jeton secret, qui doit rester côté serveur.
   Les lignes sont regroupées par (date, séance) en séances TrackLift.
   ═══════════════════════════════════════════════════════════ */

const SETTINGS_KEY = "tracklift_notion";

const FIELDS = [
  ["date", "Date", /^(date|jour|day|quand|when)/i],
  ["session", "Séance", /(s[eé]ance|session|workout|entra[iî]nement|training|name|nom|titre|title)/i],
  ["exercise", "Exercice", /(exercice|exercise|mouvement|movement|exo)/i],
  ["sets", "Séries", /^(s[eé]ries?|sets?|nb ?s[eé]ries)$/i],
  ["reps", "Répétitions", /^(r[eé]p[eé]titions?|r[eé]ps?|nb ?reps?)\b/i],
  ["weight", "Charge (kg)", /(poids|charge|kg|weight|load|lourd)/i]
];

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
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
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
  return { columns, rows: body.map(r => Object.fromEntries(columns.map((c, i) => [c, (r[i] ?? "").trim()]))) };
}

/* ---------- détection des colonnes ---------- */
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
 * Convertit des lignes (objets colonne → valeur) en séances TrackLift.
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

    const exName = mapping.exercise ? String(row[mapping.exercise] || "").trim() : "";
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

/* ---------- API Notion via le relais ---------- */
export function extractDatabaseId(input) {
  const hex = String(input || "").replace(/-/g, "").match(/[0-9a-f]{32}/i);
  return hex ? hex[0].toLowerCase() : "";
}

async function fetchFromProxy(workerUrl, databaseId) {
  const response = await fetch(workerUrl.replace(/\/+$/, "") + "/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ databaseId })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return { columns: data.columns || [], rows: data.rows || [] };
}

/* ═══════════════════ Interface (feuille modale) ═══════════════════ */
function render() {
  const s = loadSettings();
  const body = ui.el.querySelector(".ni-body");
  const tabs = `<div class="tab-row">
      <button class="tab-btn${ui.tab === "csv" ? " active" : ""}" data-ni-tab="csv">Fichier CSV</button>
      <button class="tab-btn${ui.tab === "api" ? " active" : ""}" data-ni-tab="api">API Notion</button>
    </div>`;

  let source = "";
  if (ui.tab === "csv") {
    source = `
      <p class="ni-help">Dans Notion, ouvre ta base d'entraînements → <b>⋯</b> → <b>Exporter</b> → format <b>Markdown &amp; CSV</b>. Décompresse le fichier puis choisis le <b>.csv</b> ici.</p>
      <label class="btn btn-ghost btn-block ni-file">Choisir le fichier CSV<input type="file" accept=".csv,text/csv" data-ni="file" hidden></label>`;
  } else {
    source = `
      <p class="ni-help">Nécessite un petit relais gratuit (Cloudflare Worker) qui garde ta clé Notion secrète. Suis le <a href="https://github.com/assalasArab/tracklift.github.io/blob/main/notion-proxy/README.md" target="_blank" rel="noopener">guide pas à pas (5 min)</a>.</p>
      <label class="label">Adresse du relais</label>
      <input class="input" data-ni="worker" placeholder="https://tracklift-notion.xxx.workers.dev" value="${esc(s.workerUrl)}">
      <label class="label mt-12">Lien ou ID de la base Notion</label>
      <input class="input" data-ni="db" placeholder="https://www.notion.so/…?v=…" value="${esc(s.databaseId)}">
      <button class="btn btn-primary btn-block mt-12" data-ni="fetch">Récupérer mes entraînements</button>`;
  }

  let preview = "";
  if (ui.error) preview = `<div class="auth-error mt-12">${esc(ui.error)}</div>`;
  if (ui.loading) preview = `<div class="ni-status">Chargement…</div>`;
  if (ui.data && !ui.loading) {
    const { columns, rows } = ui.data;
    const opts = col => `<option value="">— aucune —</option>` + columns.map(c => `<option value="${esc(c)}" ${ui.mapping[col] === c ? "selected" : ""}>${esc(c)}</option>`).join("");
    const result = ui.mapping.date ? rowsToSessionLogs(rows, ui.mapping, ui.ctx) : { logs: [], skipped: rows.length };
    const fresh = result.logs.filter(log => !ui.ctx.existingIds.has(log.id));
    ui.result = fresh;
    const unmatched = new Set();
    fresh.forEach(log => log.exercises.forEach(ex => { if (ex.exerciseId.startsWith("notion_")) unmatched.add(ex.exerciseName); }));
    preview = `
      <div class="ni-section">${rows.length} ligne(s) lue(s). Associe les colonnes :</div>
      <div class="ni-map">${FIELDS.map(([key, label]) => `
        <label class="ni-map-row"><span>${label}${key === "date" ? " *" : ""}</span><select class="input" data-ni-map="${key}">${opts(key)}</select></label>`).join("")}
      </div>
      <div class="ni-summary">
        ${ui.mapping.date ? `<b>${fresh.length}</b> nouvelle(s) séance(s) à importer${result.logs.length - fresh.length ? ` · ${result.logs.length - fresh.length} déjà importée(s)` : ""}${result.skipped ? ` · ${result.skipped} ligne(s) sans date ignorée(s)` : ""}` : "Choisis au moins la colonne <b>Date</b>."}
        ${unmatched.size ? `<div class="ni-unmatched">Exercices non reconnus (gardés tels quels) : ${[...unmatched].slice(0, 8).map(esc).join(", ")}${unmatched.size > 8 ? "…" : ""}</div>` : ""}
      </div>
      <button class="btn btn-primary btn-block" data-ni="import" ${fresh.length ? "" : "disabled"}>Importer ${fresh.length} séance(s)</button>`;
  }
  body.innerHTML = tabs + source + preview;
}

function setData(data) {
  ui.data = data;
  ui.error = "";
  const saved = loadSettings().mapping || {};
  const guess = guessMapping(data.columns);
  ui.mapping = {};
  FIELDS.forEach(([key]) => {
    ui.mapping[key] = data.columns.includes(saved[key]) ? saved[key] : guess[key] || "";
  });
  render();
}

function close() {
  if (!ui) return;
  ui.el.remove();
  ui = null;
}

/**
 * opts: { exercises, nameOf, existingIds:Set, onImport(logs) }
 */
export function openNotionImport(opts) {
  if (ui) return;
  const el = document.createElement("div");
  el.className = "modal";
  el.innerHTML = `<div class="modal-card large-modal" role="dialog" aria-modal="true" aria-label="Importer depuis Notion">
    <div class="modal-head"><h3>Importer depuis Notion</h3><button class="icon-btn" data-ni="close" aria-label="fermer">✕</button></div>
    <div class="ni-body"></div></div>`;
  document.body.appendChild(el);
  ui = { el, tab: loadSettings().workerUrl ? "api" : "csv", data: null, mapping: {}, error: "", loading: false, result: [], ctx: opts };

  el.addEventListener("click", async event => {
    if (event.target === el) { close(); return; }
    const tab = event.target.closest("[data-ni-tab]");
    if (tab) { ui.tab = tab.dataset.niTab; ui.data = null; ui.error = ""; render(); return; }
    const action = event.target.closest("[data-ni]")?.dataset.ni;
    if (action === "close") close();
    if (action === "fetch") {
      const workerUrl = el.querySelector('[data-ni="worker"]').value.trim();
      const databaseId = extractDatabaseId(el.querySelector('[data-ni="db"]').value);
      if (!/^https:\/\//.test(workerUrl)) { ui.error = "L'adresse du relais doit commencer par https://"; render(); return; }
      if (!databaseId) { ui.error = "ID de base introuvable : colle le lien complet de la base Notion."; render(); return; }
      saveSettings({ workerUrl, databaseId });
      ui.loading = true; ui.error = ""; render();
      try {
        const data = await fetchFromProxy(workerUrl, databaseId);
        ui.loading = false;
        if (!data.rows.length) { ui.error = "La base est vide, ou l'intégration n'y a pas accès (Notion → ⋯ → Connexions)."; render(); return; }
        setData(data);
      } catch (err) {
        ui.loading = false;
        ui.error = `Échec de la récupération : ${err.message}`;
        render();
      }
    }
    if (action === "import" && ui.result.length) {
      saveSettings({ mapping: ui.mapping });
      const logs = ui.result;
      close();
      opts.onImport(logs);
    }
  });

  el.addEventListener("change", event => {
    if (event.target.dataset.ni === "file") {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const data = parseCsv(String(reader.result || ""));
        if (!data.rows.length) { ui.error = "Fichier vide ou illisible."; render(); return; }
        setData(data);
      };
      reader.readAsText(file);
    }
    const mapKey = event.target.dataset.niMap;
    if (mapKey) { ui.mapping[mapKey] = event.target.value; render(); }
  });

  render();
}
