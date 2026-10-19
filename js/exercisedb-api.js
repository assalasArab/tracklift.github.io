/**
 * ExerciseDB OSS API integration module.
 * Uses the free open-source ExerciseDB API (no API key needed).
 * Fetches exercises with animated GIFs and caches in localStorage.
 * API: https://oss.exercisedb.dev/api/v1/
 * GIFs: https://static.exercisedb.dev/media/{exerciseId}.gif
 */

const CACHE_KEY = "tracklift_exercisedb_cache";
const CACHE_VERSION = 2;
const API_BASE = "https://oss.exercisedb.dev/api/v1";

// ─── Cache helpers ──────────────────────────────────────────────

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data?.version !== CACHE_VERSION) return null;
    return data;
  } catch { return null; }
}

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, version: CACHE_VERSION }));
  } catch (e) {
    console.warn("[ExerciseDB] cache save failed:", e);
  }
}

// ─── Name normalization for matching ────────────────────────────

function normalizeName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nameTokens(name) {
  return normalizeName(name).split(/\s+/).filter(Boolean);
}

function nameMatchScore(localName, apiName) {
  const a = normalizeName(localName);
  const b = normalizeName(apiName);
  if (a === b) return 1;

  const tokensA = nameTokens(localName);
  const tokensB = nameTokens(apiName);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  let matchCount = 0;
  for (const token of tokensA) {
    if (tokensB.some(t => t === token || t.includes(token) || token.includes(t))) {
      matchCount++;
    }
  }

  const coverage = matchCount / Math.max(tokensA.length, tokensB.length);
  if (b.includes(a) || a.includes(b)) return Math.max(coverage, 0.85);
  return coverage;
}

// ─── API fetch (no key needed) ──────────────────────────────────

async function fetchFromApi(endpoint, params = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`ExerciseDB API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch all exercises with pagination (the OSS API uses cursor-based pagination).
 */
async function fetchAllExercises(onProgress) {
  const allExercises = [];
  let cursor = null;
  let page = 0;

  while (true) {
    page++;
    const params = { limit: "200" };
    if (cursor) params.cursor = cursor;

    onProgress?.(`Fetching page ${page}...`);
    const result = await fetchFromApi("/exercises", params);

    if (!result?.data || !Array.isArray(result.data)) {
      throw new Error("Invalid API response format");
    }

    allExercises.push(...result.data);
    console.log(`[ExerciseDB] Page ${page}: ${result.data.length} exercises (total: ${allExercises.length})`);

    if (!result.meta?.hasNextPage || !result.meta?.nextCursor) break;
    cursor = result.meta.nextCursor;
  }

  return allExercises;
}

// ─── Main public API ────────────────────────────────────────────

export const ExerciseDBAPI = {

  /** No API key needed for OSS API */
  hasApiKey() { return true; },
  getApiKey() { return ""; },
  setApiKey() {},

  hasCachedData() {
    return !!loadCache()?.gifMap;
  },

  getGifUrl(exerciseId) {
    const cache = loadCache();
    return cache?.gifMap?.[exerciseId] || null;
  },

  getAllGifUrls() {
    return loadCache()?.gifMap || {};
  },

  getSyncInfo() {
    const cache = loadCache();
    if (!cache) return { synced: false, matchCount: 0, totalApi: 0, lastSync: null };
    return {
      synced: true,
      matchCount: Object.keys(cache.gifMap || {}).length,
      totalApi: cache.totalApi || 0,
      lastSync: cache.lastSync || null
    };
  },

  /**
   * Fetch all exercises from ExerciseDB OSS API and build a mapping
   * from local exercise IDs to gifUrls.
   */
  async syncExercises(apiKey, localExercises, onProgress) {
    onProgress?.("Fetching exercises from ExerciseDB...");

    const apiExercises = await fetchAllExercises(onProgress);

    if (apiExercises.length === 0) {
      throw new Error("No exercises returned from API");
    }

    onProgress?.(`${apiExercises.length} exercises fetched. Matching...`);
    console.log("[ExerciseDB] Sample API exercise:", JSON.stringify(apiExercises[0]));

    // Build lookups for matching
    const apiByName = new Map();
    const apiEntries = [];
    for (const ex of apiExercises) {
      const key = normalizeName(ex.name);
      if (!apiByName.has(key)) apiByName.set(key, ex);
      apiEntries.push({ norm: key, ex });
    }

    const gifMap = {};
    const MATCH_THRESHOLD = 0.45;

    for (const local of localExercises) {
      const localNorm = normalizeName(local.name);
      const idAsName = normalizeName(local.id.replace(/_/g, " "));

      // 1. Exact name match
      if (apiByName.has(localNorm)) {
        gifMap[local.id] = apiByName.get(localNorm).gifUrl;
        continue;
      }

      // 2. ID-based exact match
      if (apiByName.has(idAsName)) {
        gifMap[local.id] = apiByName.get(idAsName).gifUrl;
        continue;
      }

      // 3. Substring containment
      let found = false;
      for (const entry of apiEntries) {
        if (!entry.ex.gifUrl) continue;
        if ((entry.norm.includes(localNorm) && localNorm.length > 3) ||
            (localNorm.includes(entry.norm) && entry.norm.length > 3)) {
          gifMap[local.id] = entry.ex.gifUrl;
          found = true;
          break;
        }
        if (idAsName.length > 4 &&
            ((entry.norm.includes(idAsName)) || (idAsName.includes(entry.norm) && entry.norm.length > 4))) {
          gifMap[local.id] = entry.ex.gifUrl;
          found = true;
          break;
        }
      }
      if (found) continue;

      // 4. Fuzzy match
      let bestScore = 0;
      let bestMatch = null;

      for (const entry of apiEntries) {
        if (!entry.ex.gifUrl) continue;
        const score = Math.max(
          nameMatchScore(local.name, entry.ex.name),
          nameMatchScore(idAsName, entry.ex.name)
        );
        if (score > bestScore) {
          bestScore = score;
          bestMatch = entry.ex;
        }
      }

      if (bestScore >= MATCH_THRESHOLD && bestMatch?.gifUrl) {
        gifMap[local.id] = bestMatch.gifUrl;
      }
    }

    const matchCount = Object.keys(gifMap).length;
    console.log(`[ExerciseDB] Matched ${matchCount}/${localExercises.length} exercises with GIFs`);
    onProgress?.(`${matchCount}/${localExercises.length} exercises matched.`);

    saveCache({
      gifMap,
      totalApi: apiExercises.length,
      matchCount,
      lastSync: Date.now()
    });

    return { matchCount, totalApi: apiExercises.length, gifMap };
  },

  applyGifUrls(exercises) {
    const gifMap = this.getAllGifUrls();
    let applied = 0;
    for (const ex of exercises) {
      if (gifMap[ex.id]) {
        ex.gifUrl = gifMap[ex.id];
        applied++;
      }
    }
    return applied;
  },

  clearCache() {
    localStorage.removeItem(CACHE_KEY);
  }
};
