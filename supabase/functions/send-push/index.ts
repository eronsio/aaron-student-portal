// Supabase Edge Function: send-push
//
// Practice reminders for the student portal (Web Push). It does three things:
//   GET  ?vapid=1                      -> { key } the public VAPID key the browser needs to subscribe (404-style error until set up)
//   POST { action: "test" }            -> with a student's own login: sends that student a test notification
//   POST (header x-cron-secret) {}     -> the hourly run: decides, per student in THEIR OWN time zone, whether a reminder is worth sending, and sends it.
//                                         { dry: true, now: "<ISO>" } returns the plan without sending (for checking the rules)
//
// No secrets to set: the VAPID key pair is generated here on first use and kept in the table public.push_config (service role only), and the
// schedule's shared secret is created by supabase/push.sql in the same table. Deploy with the default JWT verification ENABLED (the hourly call
// sends the project's public anon key as its Bearer token, the portal sends the student's own token).
//
// The rules live between the RULES markers as plain JavaScript so they can be unit-tested without Deno (see CONTEXT.md, "Push notifications").
// They mirror the streak maths in practice.js (practiceStreakInfo).

import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "https://aaron-learning.com";

const ALLOWED_ORIGINS = new Set([
  "https://aaron-learning.com",
  "https://www.aaron-learning.com",
  "http://localhost:8765",
  "http://10.0.2.2:8765",
]);

// ==RULES START==
const DAY_GOAL = 5;                 // messages that make a day count (same as the portal)
const QUIET_FROM = 22;              // no notifications from 22:00 ...
const QUIET_UNTIL = 8;              // ... until 08:00, student's local time
const QUIET_NUDGE_AFTER_DAYS = 3;   // "gone quiet" starts after this many days without practice
const QUIET_NUDGE_EVERY_DAYS = 3;   // and repeats at most this often
const QUIET_NUDGE_MAX_UNANSWERED = 3; // then stops until the student practises again
const TTL_SECONDS = 6 * 3600;       // a reminder that could not be delivered within 6 hours is dropped

function localParts(date, tz) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(date);
  } catch (e) {
    parts = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(date);
  }
  const g = (t) => (parts.find((p) => p.type === t) || {}).value;
  return { key: `${g("year")}-${g("month")}-${g("day")}`, hour: parseInt(g("hour"), 10) % 24, dow: g("weekday") };
}
function dayNumber(key) { const [y, m, d] = key.split("-").map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); }
function dayShift(key, delta) {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}
function weekStart(key) {
  const [y, m, d] = key.split("-").map(Number);
  return dayShift(key, -((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7));
}
// Mirror of practiceStreakInfo (one missed day is forgiven once a week). days = { "YYYY-MM-DD": { m: messages } }
function streakInfo(days, todayKey) {
  days = days || {};
  const ok = (k) => days[k] && days[k].m >= DAY_GOAL;
  const doneToday = !!ok(todayKey);
  const goalDays = Object.keys(days).filter(ok).sort();
  let run = 0, lastFreeze = "";
  if (goalDays.length) {
    const yesterday = dayShift(todayKey, -1);
    for (let d = goalDays[0]; d <= yesterday; d = dayShift(d, 1)) {
      if (ok(d)) run++;
      else if (run > 0 && ok(dayShift(d, -1)) && (!lastFreeze || dayNumber(d) - dayNumber(lastFreeze) >= 7)) lastFreeze = d;
      else run = 0;
    }
    if (doneToday) run++;
  }
  return { current: run, doneToday };
}
function firstName(name) {
  const f = String(name || "").trim().split(/\s+/)[0] || "";
  return f ? f.charAt(0).toUpperCase() + f.slice(1) : "there";
}
function hashOf(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); }
function pick(list, seed) { return list[hashOf(seed) % list.length]; }

const TEXT = {
  streak: [
    (n, k) => `🔥 Your ${k}-day streak is waiting, ${n}. Five messages keeps it alive.`,
    (n, k) => `${n}, don't let ${k} days of Spanish go to waste! A quick chat saves your streak 🔥`,
    (n, k) => `Quick one: ${k} days in a row. Come say a few sentences today 🔥`,
  ],
  daily: [
    (n) => `Time for your Spanish practice, ${n}! Five minutes is all it takes.`,
    () => `Your tutor is ready when you are 🇪🇸 Five messages today?`,
    (n) => `${n}, today's mission is waiting. Ready for a quick chat?`,
  ],
  quiet: [
    (n) => `${n}, your Spanish practice partner misses you. Five minutes today?`,
    (n, k, d) => `It's been ${d} days. One short chat and you're back on track 💪`,
    (n) => `Small steps count, ${n}: say a few sentences today?`,
  ],
  recap: [
    (n, k, d, extra) => `📊 Your week is ready: ${extra.days} day${extra.days === 1 ? "" : "s"} of practice last week. Take a look!`,
  ],
};

// u = { id, name, tz, remindHour, days, sessions: [ISO...], log: [{ kind, sent_at }] }  ->  null, or { kind, title, body, url, tag }
function planPush(u, now) {
  const L = localParts(now, u.tz || "UTC");
  const today = L.key;
  if (L.hour >= QUIET_FROM || L.hour < QUIET_UNTIL) return null;                       // quiet hours
  const log = u.log || [];
  if (log.some((l) => localParts(new Date(l.sent_at), u.tz || "UTC").key === today)) return null;   // at most one a day (local day)

  const days = u.days || {};
  const sessionDays = new Set((u.sessions || []).map((s) => localParts(new Date(s), u.tz || "UTC").key));
  const practiceKeys = Object.keys(days).filter((k) => (days[k] && days[k].m > 0)).concat([...sessionDays]);
  if (!practiceKeys.length) return null;                                                // never practised: the teacher nudges them himself
  const last = practiceKeys.sort().pop();
  const since = dayNumber(today) - dayNumber(last);
  const info = streakInfo(days, today);
  if (info.doneToday) return null;                                                      // today's goal is already done

  const name = firstName(u.name);
  const hour = L.hour, remind = u.remindHour == null ? 18 : u.remindHour;
  const seed = `${u.id}|${today}`;
  const mk = (kind, k, d, extra) => ({ kind, title: "Aaron Learning", body: pick(TEXT[kind], seed)(name, k, d, extra), url: "/?open=practice", tag: "practice-" + kind });

  // 1. Monday-morning recap (once a week) for anyone who practised last week
  const ws = weekStart(today), lastWs = dayShift(ws, -7);
  if (L.dow === "Mon" && hour >= 9 && hour <= 13) {
    let n = 0; for (let i = 0; i < 7; i++) { const k = dayShift(lastWs, i); if ((days[k] && days[k].m > 0) || sessionDays.has(k)) n++; }
    const sentThisWeek = log.some((l) => l.kind === "recap" && localParts(new Date(l.sent_at), u.tz || "UTC").key >= ws);
    if (n > 0 && !sentThisWeek) return mk("recap", 0, 0, { days: n });
  }
  if (hour < remind) return null;                                                      // not their reminder time yet
  // 2. a streak worth saving
  if (info.current >= 2) return mk("streak", info.current, since);
  // 3. practised yesterday or the day before: a plain daily reminder
  if (since >= 1 && since <= 2) return mk("daily", 0, since);
  // 4. gone quiet: a gentle comeback message, spaced out, and it stops after a few unanswered ones
  if (since >= QUIET_NUDGE_AFTER_DAYS && since <= 21) {
    const quiet = log.filter((l) => l.kind === "quiet");
    const lastQuiet = quiet.map((l) => localParts(new Date(l.sent_at), u.tz || "UTC").key).sort().pop();
    const unanswered = quiet.filter((l) => localParts(new Date(l.sent_at), u.tz || "UTC").key > last).length;
    if (unanswered < QUIET_NUDGE_MAX_UNANSWERED && (!lastQuiet || dayNumber(today) - dayNumber(lastQuiet) >= QUIET_NUDGE_EVERY_DAYS)) return mk("quiet", 0, since);
  }
  return null;
}
// ==RULES END==

// ---------------------------------------------------------------------------------------------------------------------------------------------
function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://aaron-learning.com",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });
}

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`rest ${path.split("?")[0]} ${r.status} ${(await r.text()).slice(0, 200)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

// The VAPID keys are made once, here, and only ever stored in public.push_config.
async function loadConfig(): Promise<{ vapid_public: string; vapid_private: string; cron_secret: string }> {
  const rows = await rest("push_config?select=*&limit=1");
  let row = rows && rows[0];
  if (!row) throw new Error("push_config is missing: run supabase/push.sql first");
  if (!row.vapid_public || !row.vapid_private) {
    const keys = webpush.generateVAPIDKeys();
    await rest("push_config?id=eq.true", { method: "PATCH", body: JSON.stringify({ vapid_public: keys.publicKey, vapid_private: keys.privateKey }), headers: { Prefer: "return=minimal" } });
    row = { ...row, vapid_public: keys.publicKey, vapid_private: keys.privateKey };
  }
  return row;
}

async function sendTo(cfg: { vapid_public: string; vapid_private: string }, sub: any, payload: Record<string, unknown>) {
  webpush.setVapidDetails(VAPID_SUBJECT, cfg.vapid_public, cfg.vapid_private);
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: TTL_SECONDS, urgency: "normal" });
    return 201;
  } catch (e: any) {
    const status = e && e.statusCode ? e.statusCode : 0;
    if (status === 404 || status === 410) await rest(`push_subscriptions?id=eq.${sub.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});
    console.error("push failed", sub.id, status, String(e && e.body || e).slice(0, 200));
    return status || 500;
  }
}

async function tick(cfg: any, now: Date, dry: boolean) {
  const subs = await rest("push_subscriptions?enabled=eq.true&select=*&order=updated_at.desc");
  if (!subs || !subs.length) return { users: 0, sent: 0, plans: [] };
  const ids = [...new Set(subs.map((s: any) => s.user_id))].join(",");
  const since40 = new Date(now.getTime() - 40 * 86400000).toISOString();
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const [profiles, states, sessions, log] = await Promise.all([
    rest(`profiles?id=in.(${ids})&select=id,name`),
    rest(`student_app_state?user_id=in.(${ids})&select=user_id,progress`),
    rest(`practice_sessions?user_id=in.(${ids})&started_at=gte.${since40}&select=user_id,started_at,student_turns&limit=3000`),
    rest(`push_log?user_id=in.(${ids})&sent_at=gte.${since30}&select=user_id,kind,sent_at&order=sent_at.desc&limit=3000`),
  ]);
  const by = (rows: any[], f: (r: any) => string) => { const m: Record<string, any[]> = {}; (rows || []).forEach((r) => { (m[f(r)] = m[f(r)] || []).push(r); }); return m; };
  const subsBy = by(subs, (s) => s.user_id), sessBy = by(sessions, (s) => s.user_id), logBy = by(log, (l) => l.user_id);
  const nameBy: Record<string, string> = {}; (profiles || []).forEach((p: any) => { nameBy[p.id] = p.name; });
  const progBy: Record<string, any> = {}; (states || []).forEach((s: any) => { progBy[s.user_id] = s.progress || {}; });

  const plans: any[] = [];
  let sent = 0;
  for (const uid of Object.keys(subsBy)) {
    const mine = subsBy[uid], newest = mine[0];
    const plan = planPush({
      id: uid, name: nameBy[uid], tz: newest.tz, remindHour: newest.remind_hour,
      days: (progBy[uid] || {}).days || {},
      sessions: (sessBy[uid] || []).filter((s) => (s.student_turns || 0) >= 2).map((s) => s.started_at),
      log: logBy[uid] || [],
    }, now);
    if (!plan) continue;
    plans.push({ user_id: uid, kind: plan.kind, body: plan.body });
    if (dry) continue;
    let status = 0;
    for (const sub of mine) { const s = await sendTo(cfg, sub, { title: plan.title, body: plan.body, url: plan.url, tag: plan.tag }); if (s === 201 || !status) status = s; }
    await rest("push_log", { method: "POST", body: JSON.stringify({ user_id: uid, kind: plan.kind, status, body: plan.body }), headers: { Prefer: "return=minimal" } }).catch((e) => console.error(e));
    if (status === 201) sent++;
  }
  return { users: Object.keys(subsBy).length, sent, plans };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  try {
    const url = new URL(req.url);
    const cfg = await loadConfig();

    if (req.method === "GET") {
      if (url.searchParams.get("vapid")) return json(req, { key: cfg.vapid_public });
      return json(req, { error: "Not found" }, 404);
    }
    if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }

    // the hourly run
    const secret = req.headers.get("x-cron-secret");
    if (secret) {
      if (secret !== cfg.cron_secret) return json(req, { error: "Forbidden" }, 403);
      const now = body.dry && body.now ? new Date(body.now) : new Date();
      return json(req, await tick(cfg, now, !!body.dry));
    }

    // a student's own "send me a test"
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const ur = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${jwt}`, apikey: ANON_KEY } });
    const user = ur.ok ? await ur.json() : null;
    if (!user || !user.id) return json(req, { error: "Not authenticated" }, 401);
    if (body.action !== "test") return json(req, { error: "Unknown action" }, 400);
    const subs = await rest(`push_subscriptions?user_id=eq.${user.id}&enabled=eq.true&select=*`);
    if (!subs || !subs.length) return json(req, { error: "no_subscription" }, 404);
    let ok = 0;
    for (const sub of subs) { if (await sendTo(cfg, sub, { title: "Aaron Learning", body: "🎉 Reminders are on. We'll only nudge you when it helps your streak.", url: "/?open=practice", tag: "practice-test" }) === 201) ok++; }
    return json(req, { sent: ok });
  } catch (e) {
    console.error("send-push error", e);
    return json(req, { error: "server_error" }, 500);
  }
});
