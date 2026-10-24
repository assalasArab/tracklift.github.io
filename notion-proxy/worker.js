/**
 * Relais TrackLift ↔ API Notion (Cloudflare Worker).
 *
 * Chaque utilisateur connecte son propre Notion (OAuth, comme « Se connecter avec Google »).
 * L'API Notion refuse les appels venant d'un navigateur et l'échange OAuth exige un secret :
 * ce Worker garde le secret, fait l'échange, puis relaie les lectures avec le jeton de l'utilisateur.
 *
 * Routes :
 *   GET  /oauth/start?return=<url de l'appli>&nonce=<aléa>  → redirige vers la page d'autorisation Notion
 *   GET  /oauth/callback                                    → échange le code, renvoie vers l'appli (#notion_auth=…)
 *   POST /oauth/refresh   { refreshToken }                  → nouveau jeton (si Notion en fournit)
 *   POST /databases       (Authorization: Bearer <jeton>)   → bases partagées par l'utilisateur
 *   POST /query           { databaseId } (+ Bearer)         → lignes simplifiées { colonne: valeur }
 *
 * Variables du Worker :
 *   NOTION_CLIENT_ID      (texte)   « OAuth client ID » de l'intégration publique
 *   NOTION_CLIENT_SECRET  (secret)  « OAuth client secret »
 *   ALLOWED_ORIGINS       (texte)   origines autorisées, séparées par des virgules
 *                                   par défaut : https://assalasarab.github.io
 *   NOTION_TOKEN          (secret, facultatif) ancien mode : jeton d'intégration interne
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const MAX_PAGES = 20; // 20 × 100 lignes par base

function plain(prop) {
  if (!prop) return "";
  switch (prop.type) {
    case "title":
    case "rich_text":
      return (prop[prop.type] || []).map(t => t.plain_text).join("").trim();
    case "number":
      return prop.number ?? "";
    case "select":
    case "status":
      return prop[prop.type]?.name || "";
    case "multi_select":
      return (prop.multi_select || []).map(o => o.name).join(", ");
    case "date":
      return prop.date?.start || "";
    case "checkbox":
      return prop.checkbox ? "true" : "false";
    case "url":
    case "email":
    case "phone_number":
      return prop[prop.type] || "";
    case "created_time":
    case "last_edited_time":
      return prop[prop.type] || "";
    case "formula": {
      const f = prop.formula || {};
      if (f.type === "date") return f.date?.start || "";
      return f[f.type] ?? "";
    }
    case "rollup": {
      const r = prop.rollup || {};
      if (r.type === "number") return r.number ?? "";
      if (r.type === "date") return r.date?.start || "";
      if (r.type === "array") return (r.array || []).map(plain).filter(v => v !== "").join(", ");
      return "";
    }
    default:
      return "";
  }
}

const richText = list => (list || []).map(t => t.plain_text).join("").trim();

function b64urlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(text) {
  const bin = atob(String(text).replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

async function notion(path, token, init = {}) {
  const res = await fetch(NOTION_API + path, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function tokenRequest(env, body) {
  const res = await fetch(`${NOTION_API}/oauth/token`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + btoa(`${env.NOTION_CLIENT_ID}:${env.NOTION_CLIENT_SECRET}`),
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

function connectionFrom(data) {
  return {
    token: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
    workspaceName: data.workspace_name || "Notion",
    workspaceIcon: data.workspace_icon || null,
    workspaceId: data.workspace_id || null,
    botId: data.bot_id || null
  };
}

/** Retour vers l'appli avec le résultat dans le fragment (#), jamais envoyé aux serveurs */
function backToApp(returnUrl, payload) {
  const url = new URL(returnUrl);
  url.hash = "notion_auth=" + b64urlEncode(JSON.stringify(payload));
  return new Response(null, { status: 302, headers: { "Location": url.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

function page(message, status = 400) {
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TrackLift · Notion</title><p style="font:16px/1.5 system-ui;max-width:65ch;margin:48px 16px">${message}</p>`, {
    status, headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

/** Titres des pages parentes, pour regrouper les bases (« salas workout » → Push, Pull…) */
async function parentTitles(token, ids) {
  const titles = {};
  for (const id of ids.slice(0, 30)) {
    const { ok, data } = await notion(`/pages/${id}`, token, { method: "GET" });
    if (!ok) continue;
    const titleProp = Object.values(data.properties || {}).find(p => p.type === "title");
    titles[id] = titleProp ? richText(titleProp.title) : "";
  }
  return titles;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const allowed = (env.ALLOWED_ORIGINS || "https://assalasarab.github.io").split(",").map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
    const path = url.pathname.replace(/\/+$/, "");

    /* ---------- OAuth : navigation pleine page, pas de CORS ---------- */
    if (request.method === "GET" && path === "/oauth/start") {
      if (!env.NOTION_CLIENT_ID || !env.NOTION_CLIENT_SECRET) return page("Connexion Notion pas encore configurée : NOTION_CLIENT_ID ou NOTION_CLIENT_SECRET manquant dans le Worker.", 500);
      let returnUrl;
      try { returnUrl = new URL(url.searchParams.get("return") || ""); } catch { return page("Adresse de retour invalide."); }
      if (!allowed.includes(returnUrl.origin)) return page("Cette adresse n'est pas autorisée à se connecter à Notion.", 403);
      const nonce = String(url.searchParams.get("nonce") || "").slice(0, 64);
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(nonce)) return page("Paramètre de sécurité manquant. Relance la connexion depuis l'appli.");
      const state = b64urlEncode(JSON.stringify({ r: returnUrl.origin + returnUrl.pathname, n: nonce }));
      const authorize = new URL(`${NOTION_API}/oauth/authorize`);
      authorize.searchParams.set("client_id", env.NOTION_CLIENT_ID);
      authorize.searchParams.set("response_type", "code");
      authorize.searchParams.set("owner", "user");
      authorize.searchParams.set("redirect_uri", `${url.origin}/oauth/callback`);
      authorize.searchParams.set("state", state);
      return Response.redirect(authorize.toString(), 302);
    }

    if (request.method === "GET" && path === "/oauth/callback") {
      let state;
      try { state = JSON.parse(b64urlDecode(url.searchParams.get("state") || "")); } catch { return page("Réponse de Notion illisible. Relance la connexion depuis l'appli."); }
      let returnUrl;
      try { returnUrl = new URL(state.r); } catch { return page("Adresse de retour invalide."); }
      if (!allowed.includes(returnUrl.origin)) return page("Cette adresse n'est pas autorisée.", 403);
      const nonce = String(state.n || "");
      if (url.searchParams.get("error")) return backToApp(returnUrl, { nonce, ok: false, error: url.searchParams.get("error") === "access_denied" ? "Connexion annulée." : url.searchParams.get("error") });
      const code = url.searchParams.get("code");
      if (!code) return backToApp(returnUrl, { nonce, ok: false, error: "Code d'autorisation manquant." });
      const { ok, data } = await tokenRequest(env, { grant_type: "authorization_code", code, redirect_uri: `${url.origin}/oauth/callback` });
      if (!ok || !data.access_token) return backToApp(returnUrl, { nonce, ok: false, error: data.error_description || data.message || data.error || "Échec de l'échange avec Notion." });
      return backToApp(returnUrl, { nonce, ok: true, connection: connectionFrom(data) });
    }

    /* ---------- API : appels depuis l'appli ---------- */
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (!allowed.includes(origin)) return json({ error: "Origine non autorisée" }, 403);
    if (request.method !== "POST") return json({ error: "Méthode non prise en charge" }, 405);

    const body = await request.json().catch(() => ({}));

    if (path === "/oauth/refresh") {
      if (!body.refreshToken) return json({ error: "refreshToken manquant" }, 400);
      const { ok, data } = await tokenRequest(env, { grant_type: "refresh_token", refresh_token: body.refreshToken });
      if (!ok || !data.access_token) return json({ error: data.error_description || data.message || "Reconnexion à Notion nécessaire" }, 401);
      return json(connectionFrom(data));
    }

    const bearer = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    const token = bearer || env.NOTION_TOKEN;
    if (!token) return json({ error: "Notion non connecté" }, 401);

    if (path === "/databases") {
      const databases = [];
      let cursor;
      for (let i = 0; i < 5; i++) {
        const { ok, status, data } = await notion("/search", token, {
          method: "POST",
          body: JSON.stringify({ filter: { property: "object", value: "database" }, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) })
        });
        if (!ok) return json({ error: data.message || `Notion ${status}` }, status === 401 ? 401 : 502);
        for (const db of data.results || []) {
          if (db.archived || db.in_trash) continue;
          databases.push({
            id: db.id.replace(/-/g, ""),
            title: richText(db.title) || "Sans titre",
            icon: db.icon?.type === "emoji" ? db.icon.emoji : null,
            parentId: db.parent?.type === "page_id" ? db.parent.page_id : null,
            columns: Object.keys(db.properties || {}),
            editedAt: db.last_edited_time
          });
        }
        if (!data.has_more) break;
        cursor = data.next_cursor;
      }
      const titles = await parentTitles(token, [...new Set(databases.map(d => d.parentId).filter(Boolean))]);
      databases.forEach(d => { d.parentTitle = d.parentId ? titles[d.parentId] || "" : ""; });
      return json({ databases });
    }

    if (path === "/query") {
      const databaseId = String(body.databaseId || "").replace(/-/g, "").toLowerCase();
      if (!/^[0-9a-f]{32}$/.test(databaseId)) return json({ error: "databaseId invalide" }, 400);
      const rows = [];
      const columns = new Set();
      let cursor;
      for (let p = 0; p < MAX_PAGES; p++) {
        const { ok, status, data } = await notion(`/databases/${databaseId}/query`, token, {
          method: "POST",
          body: JSON.stringify({ page_size: 100, sorts: [{ timestamp: "created_time", direction: "ascending" }], ...(cursor ? { start_cursor: cursor } : {}) })
        });
        if (!ok) return json({ error: data.message || `Notion ${status}` }, status === 401 ? 401 : status === 404 ? 404 : 502);
        for (const result of data.results || []) {
          const row = { __created: result.created_time };
          for (const [name, prop] of Object.entries(result.properties || {})) {
            columns.add(name);
            row[name] = plain(prop);
          }
          rows.push(row);
        }
        if (!data.has_more) break;
        cursor = data.next_cursor;
      }
      return json({ columns: [...columns], rows });
    }

    return json({ error: "Route inconnue" }, 404);
  }
};
