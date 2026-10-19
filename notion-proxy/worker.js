/**
 * Relais TrackLift ↔ API Notion (Cloudflare Worker).
 *
 * L'API Notion refuse les appels venant d'un navigateur et exige un jeton secret.
 * Ce Worker garde le jeton côté serveur (variable secrète NOTION_TOKEN), interroge
 * la base demandée et renvoie des lignes simplifiées { colonne: valeur }.
 *
 * Variables :
 *   NOTION_TOKEN     (secret)  jeton de l'intégration interne Notion
 *   ALLOWED_ORIGINS  (texte)   origines autorisées, séparées par des virgules
 *                              par défaut : https://assalasarab.github.io
 */

const NOTION_VERSION = "2022-06-28";
const MAX_PAGES = 20; // 20 × 100 lignes

function plain(prop) {
  if (!prop) return "";
  switch (prop.type) {
    case "title":
    case "rich_text":
      return (prop[prop.type] || []).map(t => t.plain_text).join("");
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

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || "https://assalasarab.github.io").split(",").map(s => s.trim());
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { ...cors, "Content-Type": "application/json" }
    });

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (!allowed.includes(origin)) return json({ error: "Origine non autorisée" }, 403);
    if (request.method !== "POST" || !new URL(request.url).pathname.endsWith("/query")) return json({ error: "POST /query attendu" }, 404);
    if (!env.NOTION_TOKEN) return json({ error: "NOTION_TOKEN manquant dans les variables du Worker" }, 500);

    let databaseId = "";
    try {
      databaseId = String((await request.json()).databaseId || "").replace(/-/g, "").toLowerCase();
    } catch { /* corps invalide */ }
    if (!/^[0-9a-f]{32}$/.test(databaseId)) return json({ error: "databaseId invalide" }, 400);

    const rows = [];
    const columns = new Set();
    let cursor;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.NOTION_TOKEN}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(cursor ? { page_size: 100, start_cursor: cursor } : { page_size: 100 })
      });
      const data = await res.json();
      if (!res.ok) return json({ error: data.message || `Notion ${res.status}` }, res.status === 404 ? 404 : 502);

      for (const result of data.results || []) {
        const row = {};
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
};
