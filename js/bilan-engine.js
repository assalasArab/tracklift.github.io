/* ═══════════════════════════════════════════════════════════
   Bilan de la semaine : calculs, conseils, textes et e-mail.
   Aucun import : le même fichier sert à l'appli et à l'envoi
   des e-mails (tools/bilan/send.mjs, sous Node).

   Règles (d'après newsletter/BRIEF_newsletter_muscu.md) :
   - le bilan d'un dimanche couvre les 7 jours d'avant (dimanche → samedi) ;
   - une séance se compare seulement à la même séance (même programme, même nom) :
     « Pull » et « Pull inversé » ne sont jamais mélangés ;
   - séries comptées : faites, hors échauffement, avec des répétitions ;
   - top set = la charge la plus lourde (à égalité, le plus de répétitions) ;
   - volume = somme charge × répétitions (poids du corps : somme des répétitions) ;
   - aucun chiffre inventé : tout vient des séances enregistrées.
   ═══════════════════════════════════════════════════════════ */

const PARIS = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", year: "numeric", month: "numeric", day: "numeric", weekday: "short", hour: "numeric", hourCycle: "h23" });
const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const LOOKBACK_DAYS = 56; // on cherche la séance précédente jusqu'à 8 semaines en arrière
const TOP_RANGE = 12;     // haut de fourchette quand la séance n'a pas d'objectif de répétitions

export function parisTime(ts) {
  const p = Object.fromEntries(PARIS.formatToParts(new Date(ts)).map(x => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), wd: WEEKDAY[p.weekday] ?? 0, h: Number(p.hour) };
}
const iso = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
export function dayOf(ts) { const p = parisTime(ts); return iso(p.y, p.m, p.d); }
export function shiftDay(day, n) { const [y, m, d] = day.split("-").map(Number); return iso(y, m, d + n); }

/** Le bilan le plus récent : celui du dernier dimanche (aujourd'hui si on est dimanche) */
export function bilanWeek(now = Date.now()) {
  const p = parisTime(now);
  const sunday = iso(p.y, p.m, p.d - p.wd);
  return { sunday, from: shiftDay(sunday, -7), to: shiftDay(sunday, -1) };
}
/** dimanche du bilan qui contient ce jour */
const weekOfDay = day => { const [y, m, d] = day.split("-").map(Number); const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return shiftDay(day, 7 - wd); };

export function normName(text) {
  return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, "").replace(/\s+/g, " ").trim();
}
const sessionKey = log => `${log.programId || "-"}|${normName(log.sessionName)}`;
const exerciseKey = ex => ex.exerciseId || `n:${normName(ex.exerciseName)}`;

function workSets(entry) {
  return (entry?.sets || [])
    .filter(s => s && s.status === "done" && s.kind !== "warmup" && Number(s.reps) > 0)
    .map(s => ({ kg: Math.max(0, Number(s.weight) || 0), reps: Math.round(Number(s.reps)), target: Number(s.targetReps) || 0 }));
}

/** Exercices d'une séance, regroupés (un même exercice noté deux fois = une seule ligne) */
function entriesOf(log) {
  const map = new Map();
  for (const ex of log?.exercises || []) {
    const key = exerciseKey(ex);
    const sets = workSets(ex);
    const item = map.get(key) || { key, name: String(ex.exerciseName || "").trim() || "?", sets: [] };
    item.sets.push(...sets);
    map.set(key, item);
  }
  return map;
}

function statOf(sets) {
  if (!sets?.length) return null;
  const bodyweight = sets.every(s => s.kg === 0);
  let top = sets[0];
  for (const s of sets) if (s.kg > top.kg || (s.kg === top.kg && s.reps > top.reps)) top = s;
  const volume = bodyweight ? sets.reduce((sum, s) => sum + s.reps, 0) : sets.reduce((sum, s) => sum + s.kg * s.reps, 0);
  return { top: { kg: top.kg, reps: top.reps }, volume: Math.round(volume * 10) / 10, bodyweight, sets: sets.map(s => ({ kg: s.kg, reps: s.reps, target: s.target })) };
}
const sameStat = (a, b) => a.top.kg === b.top.kg && a.top.reps === b.top.reps && Math.abs(a.volume - b.volume) < 0.05 && a.bodyweight === b.bodyweight;
const hasWork = log => (log?.exercises || []).some(ex => workSets(ex).length > 0);

function compare(cur, prev) {
  if (!prev || prev.bodyweight !== cur.bodyweight) return { trend: "ref" };
  const topUp = cur.top.kg > prev.top.kg || (cur.top.kg === prev.top.kg && cur.top.reps > prev.top.reps);
  const topDown = cur.top.kg < prev.top.kg || (cur.top.kg === prev.top.kg && cur.top.reps < prev.top.reps);
  const volUp = cur.volume > prev.volume + 0.05;
  const volDown = cur.volume < prev.volume - 0.05;
  if (topUp || volUp) return { trend: "up", topDown, volDown };
  if (topDown || volDown) return { trend: "watch", topDown, volDown };
  return { trend: "plateau" };
}

/**
 * Calcule le bilan de la semaine.
 * logs : séances enregistrées ({ date, sessionName, programId, exercises: [{ exerciseId, exerciseName, sets }] })
 */
export function buildBilan(logs, now = Date.now()) {
  const week = bilanWeek(now);
  const oldest = shiftDay(week.from, -LOOKBACK_DAYS);
  const all = (logs || [])
    .filter(log => log && Number.isFinite(Number(log.date)) && hasWork(log))
    .map(log => ({ log, day: dayOf(Number(log.date)), key: sessionKey(log) }))
    .filter(x => x.day >= oldest && x.day <= week.to)
    .sort((a, b) => Number(a.log.date) - Number(b.log.date));
  const inWeek = all.filter(x => x.day >= week.from);

  const order = [];
  for (const x of inWeek) if (!order.includes(x.key)) order.push(x.key);

  const sessions = order.map(key => {
    const occurrences = inWeek.filter(x => x.key === key);
    const last = occurrences[occurrences.length - 1];
    const earlier = all.filter(x => x.key === key && x.day < week.from).reverse(); // la plus récente d'abord
    const exercises = [];
    for (const entry of entriesOf(last.log).values()) {
      const cur = statOf(entry.sets);
      if (!cur) continue;
      const history = [];
      for (const x of earlier) {
        const stat = statOf(entriesOf(x.log).get(entry.key)?.sets);
        if (stat) history.push({ day: x.day, stat });
      }
      const prev = history[0] || null;
      const cmp = compare(cur, prev?.stat);
      let weeks = 0;
      if (cmp.trend === "plateau") {
        const seen = new Set([weekOfDay(last.day)]);
        for (const h of history) { if (!sameStat(h.stat, cur)) break; seen.add(weekOfDay(h.day)); }
        weeks = seen.size;
      }
      exercises.push({
        key: entry.key, name: entry.name, ...cur,
        prev: prev ? { day: prev.day, top: prev.stat.top, volume: prev.stat.volume } : null,
        delta: prev && cmp.trend !== "ref" ? Math.round((cur.volume - prev.stat.volume) * 10) / 10 : null,
        trend: cmp.trend, topDown: Boolean(cmp.topDown), volDown: Boolean(cmp.volDown), weeks
      });
    }
    return { key, name: String(last.log.sessionName || "").trim() || "Séance", times: occurrences.length, day: last.day, exercises };
  }).filter(s => s.exercises.length);

  const lastWeekKeys = new Set(all.filter(x => x.day >= shiftDay(week.from, -7) && x.day < week.from).map(x => x.key));
  const missed = [];
  for (const key of lastWeekKeys) if (!order.includes(key)) {
    const x = all.filter(y => y.key === key).pop();
    missed.push(String(x.log.sessionName || "").trim() || "Séance");
  }

  const flat = sessions.flatMap(s => s.exercises);
  const counts = {
    sessions: inWeek.length,
    up: flat.filter(e => e.trend === "up").length,
    plateau: flat.filter(e => e.trend === "plateau").length,
    watch: flat.filter(e => e.trend === "watch").length,
    ref: flat.filter(e => e.trend === "ref").length
  };
  return { week, sessions, missed, counts, empty: sessions.length === 0, advice: pickAdvice(flat, missed) };
}

const isSmallLoad = name => /halt[eè]re|dumbbell|[ée]l[ée]vation|lat[ée]ral|lateral raise|curl/i.test(name);

/** 2 à 4 conseils tirés des vrais chiffres, un seul par exercice, dans l'ordre de priorité du brief */
function pickAdvice(flat, missed) {
  const out = [];
  const used = new Set();
  const add = (item, exercise) => {
    if (out.length >= 4 || (exercise && used.has(exercise.key))) return;
    if (out.filter(a => a.code === item.code).length >= 2) return; // pas plus de 2 conseils du même genre
    if (exercise) used.add(exercise.key);
    out.push(item);
  };
  const step = e => (e.bodyweight ? "rep" : isSmallLoad(e.name) ? "small" : "big");

  flat.filter(e => e.trend === "plateau" && e.weeks >= 3).sort((a, b) => b.weeks - a.weeks)
    .forEach(e => add({ code: "plateau", name: e.name, weeks: e.weeks, step: step(e) }, e));
  flat.filter(e => e.topDown && e.prev)
    .forEach(e => add({ code: "recover", name: e.name, top: e.prev.top, bodyweight: e.bodyweight }, e));
  flat.filter(e => !e.bodyweight && e.trend !== "watch" && e.sets.every(s => s.reps >= (s.target > 0 ? s.target : TOP_RANGE)))
    .forEach(e => add({ code: "loadUp", name: e.name, step: step(e) }, e));
  if (missed.length) add({ code: "missed", names: missed });

  if (out.length < 2) {
    const firsts = flat.filter(e => e.trend === "ref");
    const ups = flat.filter(e => e.trend === "up" && !e.topDown);
    for (const e of ups) add({ code: "keepGoing", name: e.name, top: e.top, bodyweight: e.bodyweight }, e);
    if (out.length < 2 && firsts.length) add({ code: "baseline", name: firsts[0].name, step: step(firsts[0]) }, firsts[0]);
    if (out.length < 2 && flat.some(e => e.trend === "plateau")) {
      const e = flat.find(x => x.trend === "plateau" && !used.has(x.key));
      if (e) add({ code: "nudge", name: e.name, step: step(e) }, e);
    }
    if (out.length < 2 && flat.length) add({ code: "logAll" });
  }
  return out;
}

/* ─── Textes (FR / EN) ───────────────────────────────────── */
const TEXT = {
  fr: {
    locale: "fr-FR",
    brand: "TrackLift",
    title: "Ta progression de la semaine",
    subject: "Ta progression de la semaine — {date}",
    intro: "Voici ton bilan du {from} au {to}.",
    introEmpty: "Aucune séance notée du {from} au {to}.",
    emptyHelp: "Pour avoir ton bilan dimanche prochain : lance une séance dans TrackLift et valide chaque série avec son poids et ses répétitions. Les séries d'échauffement ne comptent pas.",
    times: "faite {n} fois cette semaine, la dernière compte",
    cols: { exercise: "Exercice", top: "Top set", volume: "Volume", trend: "Tendance" },
    trend: { up: "Hausse", plateau: "Plateau", watch: "À surveiller", ref: "Référence" },
    plateauWeeks: "Plateau, {n}e semaine",
    noteTopDown: "top set à récupérer ({top})",
    noteVolDown: "volume en baisse",
    noteFirst: "première fois",
    vsPrev: "{delta} par rapport au {day}",
    focus: "Surcharge progressive",
    focusUp: "Ça progresse : {list}.",
    focusPlateau: "Ça stagne : {list}.",
    focusWatch: "À surveiller : {list}.",
    focusRef: "Première mesure (on comparera la semaine prochaine) : {list}.",
    priorities: "Priorités de la semaine",
    step: { big: "+2,5 kg", small: "+1 à 2 kg", rep: "+1 répétition" },
    advice: {
      plateau: "{name} : bloqué depuis {weeks} semaines. Pour casser le plateau, mets {step} (ou fais +1 répétition) sur la première série.",
      recover: "{name} : reprends d'abord ton top set de la dernière fois ({top}) avant de monter.",
      loadUp: "{name} : toutes tes séries sont en haut de la fourchette. Monte la charge ({step}).",
      missed: "Pas de séance « {names} » notée cette semaine. Si tu l'as faite, pense à la noter ; sinon, cale-la cette semaine.",
      keepGoing: "{name} : bien joué. Garde {top} et vise une répétition de plus.",
      baseline: "Cette semaine sert de point de départ. La semaine prochaine, vise {step} ou +1 répétition sur la première série de {name}.",
      nudge: "{name} : mêmes chiffres que la dernière fois. Tente {step} ou +1 répétition sur la première série.",
      logAll: "Note chaque série avec son poids et ses répétitions : c'est ce qui permet de suivre ta progression."
    },
    endUp: "Tu avances : garde ce rythme. Bonne semaine d'entraînement !",
    endFlat: "Chaque séance notée compte. Bonne semaine d'entraînement !",
    endEmpty: "Une séance cette semaine, et on repart. À dimanche prochain !",
    openApp: "Ouvrir TrackLift",
    why: "Tu reçois ce bilan parce que tu l'as demandé dans TrackLift. Pour l'arrêter : menu → Bilan de la semaine → décoche « Par e-mail ».",
    reps: "{n} rép.",
    and: " et ",
    bodyweight: "poids du corps"
  },
  en: {
    locale: "en-GB",
    brand: "TrackLift",
    title: "Your progress this week",
    subject: "Your progress this week — {date}",
    intro: "Here is your summary from {from} to {to}.",
    introEmpty: "No workout logged from {from} to {to}.",
    emptyHelp: "To get your summary next Sunday: start a workout in TrackLift and confirm each set with its weight and reps. Warm-up sets don't count.",
    times: "done {n} times this week, the last one counts",
    cols: { exercise: "Exercise", top: "Top set", volume: "Volume", trend: "Trend" },
    trend: { up: "Up", plateau: "Plateau", watch: "Watch", ref: "Baseline" },
    plateauWeeks: "Plateau, week {n}",
    noteTopDown: "top set to win back ({top})",
    noteVolDown: "volume down",
    noteFirst: "first time",
    vsPrev: "{delta} vs {day}",
    focus: "Progressive overload",
    focusUp: "Going up: {list}.",
    focusPlateau: "Stuck: {list}.",
    focusWatch: "To watch: {list}.",
    focusRef: "First measure (we'll compare next week): {list}.",
    priorities: "This week's priorities",
    step: { big: "+2.5 kg", small: "+1 to 2 kg", rep: "+1 rep" },
    advice: {
      plateau: "{name}: stuck for {weeks} weeks. To break the plateau, add {step} (or +1 rep) on the first set.",
      recover: "{name}: first win back last time's top set ({top}) before going heavier.",
      loadUp: "{name}: every set is at the top of the rep range. Go heavier ({step}).",
      missed: "No “{names}” workout logged this week. If you did it, log it; if not, fit it in this week.",
      keepGoing: "{name}: well done. Keep {top} and aim for one more rep.",
      baseline: "This week is your starting point. Next week, aim for {step} or +1 rep on the first set of {name}.",
      nudge: "{name}: same numbers as last time. Try {step} or +1 rep on the first set.",
      logAll: "Log every set with its weight and reps: that's how your progress can be tracked."
    },
    endUp: "You're moving forward: keep it up. Have a good training week!",
    endFlat: "Every logged workout counts. Have a good training week!",
    endEmpty: "One workout this week and you're back on track. See you next Sunday!",
    openApp: "Open TrackLift",
    why: "You get this summary because you asked for it in TrackLift. To stop it: menu → Weekly summary → untick “By email”.",
    reps: "{n} reps",
    and: " and ",
    bodyweight: "bodyweight"
  }
};

export function bilanText(lang) { return TEXT[lang === "en" ? "en" : "fr"]; }
const fill = (s, vars = {}) => String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));

export function formatters(lang) {
  const T = bilanText(lang);
  const nf = new Intl.NumberFormat(T.locale, { maximumFractionDigits: 1 });
  const num = n => nf.format(n).replace(/ /g, " ");
  const dateLong = day => new Intl.DateTimeFormat(T.locale, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${day}T12:00:00Z`));
  const dateShort = day => new Intl.DateTimeFormat(T.locale, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${day}T12:00:00Z`));
  const dateTiny = day => new Intl.DateTimeFormat(T.locale, { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${day}T12:00:00Z`));
  const top = (t, bodyweight) => (bodyweight ? fill(T.reps, { n: t.reps }) : `${num(t.kg)} kg × ${t.reps}`);
  const volume = e => (e.bodyweight ? fill(T.reps, { n: num(e.volume) }) : `${num(e.volume)} kg`);
  const signed = (n, bodyweight) => {
    const s = n > 0 ? "+" : n < 0 ? "−" : "±";
    return bodyweight ? `${s}${fill(T.reps, { n: num(Math.abs(n)) })}` : `${s}${num(Math.abs(n))} kg`;
  };
  return { T, num, dateLong, dateShort, dateTiny, top, volume, signed };
}

const list = (names, T) => (names.length > 1 ? `${names.slice(0, -1).join(", ")}${T.and}${names[names.length - 1]}` : names[0] || "");

/** Tout le contenu du bilan en texte prêt à afficher (sans HTML) : partagé par l'appli et l'e-mail */
export function bilanContent(bilan, lang = "fr") {
  const F = formatters(lang);
  const { T } = F;
  const range = { from: F.dateShort(bilan.week.from), to: F.dateShort(bilan.week.to) };
  const trendLabel = e => (e.trend === "plateau" && e.weeks >= 2 ? fill(T.plateauWeeks, { n: e.weeks }) : T.trend[e.trend]);
  const note = e => {
    const parts = [];
    if (e.trend === "up" && e.topDown && e.prev) parts.push(fill(T.noteTopDown, { top: F.top(e.prev.top, e.bodyweight) }));
    if (e.trend === "up" && e.volDown) parts.push(T.noteVolDown);
    if (e.trend === "ref") parts.push(T.noteFirst);
    return parts.join(" · ");
  };
  const sessions = bilan.sessions.map(s => ({
    name: s.name,
    times: s.times > 1 ? fill(T.times, { n: s.times }) : "",
    rows: s.exercises.map(e => ({
      name: e.name,
      top: F.top(e.top, e.bodyweight),
      volume: F.volume(e),
      delta: e.delta ? fill(T.vsPrev, { delta: F.signed(e.delta, e.bodyweight), day: F.dateTiny(e.prev.day) }) : "",
      trend: e.trend,
      trendLabel: trendLabel(e),
      note: note(e)
    }))
  }));
  const flat = bilan.sessions.flatMap(s => s.exercises.map(e => ({ ...e, session: s.name })));
  const twice = new Set(flat.map(e => normName(e.name)).filter((k, i, arr) => arr.indexOf(k) !== i));
  const labelOf = e => (twice.has(normName(e.name)) ? `${e.name} (${e.session})` : e.name);
  const names = trend => [...new Set(flat.filter(e => e.trend === trend).map(labelOf))];
  const focus = [];
  if (names("up").length) focus.push(fill(T.focusUp, { list: list(names("up"), T) }));
  if (names("plateau").length) focus.push(fill(T.focusPlateau, { list: list(names("plateau"), T) }));
  if (names("watch").length) focus.push(fill(T.focusWatch, { list: list(names("watch"), T) }));
  if (names("ref").length) focus.push(fill(T.focusRef, { list: list(names("ref"), T) }));
  const advice = bilan.advice.map(a => fill(T.advice[a.code], {
    name: a.name, weeks: a.weeks, step: a.step ? T.step[a.step] : "",
    top: a.top ? F.top(a.top, a.bodyweight) : "", names: (a.names || []).join(lang === "en" ? "”, “" : " », « ")
  }));
  return {
    title: T.title,
    subject: fill(T.subject, { date: F.dateLong(bilan.week.sunday) }),
    date: F.dateLong(bilan.week.sunday),
    intro: fill(bilan.empty ? T.introEmpty : T.intro, range),
    emptyHelp: bilan.empty ? T.emptyHelp : "",
    cols: T.cols,
    sessions, focusTitle: T.focus, focus,
    prioritiesTitle: T.priorities, advice,
    end: bilan.empty ? T.endEmpty : bilan.counts.up ? T.endUp : T.endFlat
  };
}

/* ─── E-mail : gabarit fixe, seuls les chiffres changent ──── */
const escHtml = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function bilanEmail(bilan, { lang = "fr", appUrl = "", signature = "" } = {}) {
  const c = bilanContent(bilan, lang);
  const T = bilanText(lang);
  const serif = "Georgia, 'Times New Roman', Times, serif";
  const label = "font-family:Arial, Helvetica, sans-serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#77736b;";
  const cell = "padding:9px 8px;border-bottom:1px solid #e6e2d9;vertical-align:top;";
  const sessionsHtml = c.sessions.map(s => `
          <tr><td style="padding:26px 0 6px;">
            <div style="${label}">${escHtml(s.name)}</div>
            ${s.times ? `<div style="font-family:${serif};font-size:13px;color:#77736b;padding-top:3px;">${escHtml(s.times)}</div>` : ""}
          </td></tr>
          <tr><td>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:${serif};font-size:15px;color:#22201c;">
              <tr>
                <td style="${cell}${label}">${escHtml(c.cols.exercise)}</td>
                <td style="${cell}${label}">${escHtml(c.cols.top)}</td>
                <td style="${cell}${label}">${escHtml(c.cols.volume)}</td>
                <td style="${cell}${label}">${escHtml(c.cols.trend)}</td>
              </tr>
              ${s.rows.map(r => `<tr>
                <td style="${cell}">${escHtml(r.name)}</td>
                <td style="${cell}white-space:nowrap;">${escHtml(r.top)}</td>
                <td style="${cell}white-space:nowrap;">${escHtml(r.volume)}${r.delta ? `<div style="font-size:12px;color:#77736b;padding-top:2px;">${escHtml(r.delta)}</div>` : ""}</td>
                <td style="${cell}">${escHtml(r.trendLabel)}${r.note ? `<div style="font-size:12px;color:#77736b;padding-top:2px;">${escHtml(r.note)}</div>` : ""}</td>
              </tr>`).join("")}
            </table>
          </td></tr>`).join("");
  const focusHtml = c.focus.length ? `
          <tr><td style="padding:28px 0 6px;${label}">${escHtml(c.focusTitle)}</td></tr>
          <tr><td style="font-family:${serif};font-size:15px;line-height:1.6;color:#22201c;">${c.focus.map(f => `<p style="margin:0 0 8px;">${escHtml(f)}</p>`).join("")}</td></tr>` : "";
  const adviceHtml = c.advice.length ? `
          <tr><td style="padding:24px 0 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f4f1ea;border:1px solid #e6e2d9;">
              <tr><td style="padding:16px 18px 4px;${label}">${escHtml(c.prioritiesTitle)}</td></tr>
              <tr><td style="padding:4px 18px 14px;font-family:${serif};font-size:15px;line-height:1.6;color:#22201c;">
                ${c.advice.map((a, i) => `<p style="margin:0 0 8px;">${i + 1}. ${escHtml(a)}</p>`).join("")}
              </td></tr>
            </table>
          </td></tr>` : "";
  const html = `<!doctype html>
<html lang="${lang === "en" ? "en" : "fr"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escHtml(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#ebe7de;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ebe7de;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fffdf8;border:1px solid #e0dbcf;">
        <tr><td style="padding:28px 26px 30px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="${label}">${escHtml(T.brand)}</td></tr>
          <tr><td style="padding-top:10px;font-family:${serif};font-size:26px;line-height:1.25;color:#22201c;">${escHtml(c.title)}</td></tr>
          <tr><td style="padding-top:4px;font-family:${serif};font-size:15px;color:#77736b;">${escHtml(c.date)}</td></tr>
          <tr><td style="padding-top:18px;font-family:${serif};font-size:16px;line-height:1.6;color:#22201c;">${escHtml(c.intro)}${c.emptyHelp ? `<p style="margin:12px 0 0;">${escHtml(c.emptyHelp)}</p>` : ""}</td></tr>
          ${sessionsHtml}
          ${focusHtml}
          ${adviceHtml}
          <tr><td style="padding-top:24px;font-family:${serif};font-size:16px;line-height:1.6;color:#22201c;">${escHtml(c.end)}${signature ? `<br><span style="color:#77736b;">${escHtml(signature)}</span>` : ""}</td></tr>
          ${appUrl ? `<tr><td style="padding-top:22px;"><a href="${escHtml(appUrl)}" style="font-family:Arial, Helvetica, sans-serif;font-size:14px;color:#22201c;">${escHtml(T.openApp)}</a></td></tr>` : ""}
          </table>
        </td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
        <tr><td style="padding:14px 26px;font-family:Arial, Helvetica, sans-serif;font-size:12px;line-height:1.5;color:#8a857b;">${escHtml(T.why)}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const lines = [c.title, c.date, "", c.intro];
  if (c.emptyHelp) lines.push("", c.emptyHelp);
  for (const s of c.sessions) {
    lines.push("", s.name.toUpperCase() + (s.times ? ` (${s.times})` : ""));
    for (const r of s.rows) lines.push(`- ${r.name} : ${r.top} · ${r.volume}${r.delta ? ` (${r.delta})` : ""} · ${r.trendLabel}${r.note ? `, ${r.note}` : ""}`);
  }
  if (c.focus.length) lines.push("", c.focusTitle.toUpperCase(), ...c.focus);
  if (c.advice.length) lines.push("", c.prioritiesTitle.toUpperCase(), ...c.advice.map((a, i) => `${i + 1}. ${a}`));
  lines.push("", c.end);
  if (signature) lines.push(signature);
  if (appUrl) lines.push("", `${T.openApp} : ${appUrl}`);
  lines.push("", T.why);
  return { subject: c.subject, html, text: lines.join("\n").replace(/ /g, " ") };
}
