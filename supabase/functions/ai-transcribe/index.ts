// Supabase Edge Function: ai-transcribe
//
// Speech-to-text for the hands-free voice conversation in the Spanish practice chat. The browser sends one finished
// utterance (a short 16 kHz mono WAV) and gets the text back. It exists because the browser's own speech recognizer is
// unreliable for a conversation (it fails to reopen the microphone after the first turn, and Firefox has none at all).
// Same shape as ai-speak: the ElevenLabs key stays on the server, only a real logged-in student can call it, and each
// student is rate limited.
//
// Deploy with the default JWT verification ENABLED. Secrets: ELEVENLABS_API_KEY (shared with ai-speak; the key must
// have "Speech to Text" access), optional ELEVENLABS_STT_MODEL (default scribe_v2).
//
// The portal falls back to the browser recognizer on any failure here, so this function is optional.

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
const MODEL_ID = Deno.env.get("ELEVENLABS_STT_MODEL") || "scribe_v2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_ORIGINS = new Set([
  "https://aaron-learning.com",
  "https://www.aaron-learning.com",
  "http://localhost:8765",
]);

const MAX_BYTES = 3 * 1024 * 1024;   // ~90 s of 16 kHz mono 16-bit audio: far longer than one spoken turn
const MIN_BYTES = 1500;              // under ~45 ms of audio: nothing to transcribe
const LANGS = new Set(["es", "en"]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://aaron-learning.com",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// Best-effort per-student cost guard (in-memory, per server instance, same approach as ai-companion / ai-speak).
const recentRequests = new Map<string, number[]>();
type RateRule = { name: string; limit: number; windowMs: number };

function tryConsume(userId: string, rules: RateRule[], now = Date.now()): boolean {
  const used = rules.map((r) => {
    const key = `${r.name}:${userId}`;
    const fresh = (recentRequests.get(key) || []).filter((t) => now - t < r.windowMs);
    recentRequests.set(key, fresh);
    return { fresh, rule: r };
  });
  if (used.some((u) => u.fresh.length >= u.rule.limit)) return false;
  used.forEach((u) => u.fresh.push(now));
  if (recentRequests.size > 5000) {
    for (const [k, v] of recentRequests) if (!v.length || now - v[v.length - 1] > 24 * 3600_000) recentRequests.delete(k);
  }
  return true;
}

const LISTEN_RULES: RateRule[] = [
  { name: "stt-min", limit: 30, windowMs: 60_000 },
  { name: "stt-day", limit: 800, windowMs: 24 * 3600_000 },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  if (!ELEVENLABS_API_KEY) return json(req, { error: "stt_not_configured" }, 503);

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(req, { error: "Missing Authorization header" }, 401);

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!userRes.ok) return json(req, { error: "Not authenticated" }, 401);
  const user = await userRes.json();
  if (!user?.id) return json(req, { error: "Not authenticated" }, 401);

  const declared = Number(req.headers.get("Content-Length") || 0);
  if (declared > MAX_BYTES) return json(req, { error: "Audio too long" }, 413);
  const audio = new Uint8Array(await req.arrayBuffer());
  if (audio.byteLength > MAX_BYTES) return json(req, { error: "Audio too long" }, 413);
  if (audio.byteLength < MIN_BYTES) return json(req, { text: "" });   // a blip of noise, not speech

  const langParam = new URL(req.url).searchParams.get("lang") || "es";
  const lang = LANGS.has(langParam) ? langParam : "es";

  if (!tryConsume(user.id, LISTEN_RULES)) {
    return json(req, { error: "Vas muy rápido. Espera un momento e inténtalo otra vez." }, 429);
  }

  try {
    const form = new FormData();
    form.append("model_id", MODEL_ID);
    form.append("file", new Blob([audio], { type: "audio/wav" }), "speech.wav");
    form.append("language_code", lang);
    form.append("tag_audio_events", "false");

    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: form,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("ElevenLabs STT error for user", user.id, res.status, detail.slice(0, 500));
      // 401/403 here almost always means the API key lacks "Speech to Text" access: the portal then uses the browser recognizer.
      return json(req, { error: res.status === 401 || res.status === 403 ? "stt_permission" : "stt_unavailable", status: res.status }, 502);
    }
    const data = await res.json();
    return json(req, { text: typeof data?.text === "string" ? data.text.trim() : "", language: data?.language_code || null });
  } catch (err) {
    console.error("ai-transcribe function error:", err);
    return json(req, { error: "stt_unavailable" }, 502);
  }
});
