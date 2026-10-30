// Supabase Edge Function: ai-speak
//
// Natural-sounding voice for the Spanish speaking-practice chat. The browser's built-in voices are
// the weak link (they depend on what each student's computer happens to have installed), so replies
// can be read by a neural text-to-speech service instead. This function is the server-side proxy for
// that service (ElevenLabs), for the same reason ai-companion proxies Anthropic: the API key must
// never reach the browser.
//
// The portal falls back to the browser voice on any failure here, so this function is optional:
// until ELEVENLABS_API_KEY is set it answers 503 and nothing changes for students.
//
// Deploy with the default JWT verification ENABLED. Like ai-companion it additionally resolves the
// token via /auth/v1/user so only a real logged-in student can spend the voice budget.
//
// Secrets: ELEVENLABS_API_KEY (required), ELEVENLABS_VOICE_ID (optional: the default voice, "carolina" below), ELEVENLABS_MODEL (optional, default eleven_flash_v2_5; use
// eleven_multilingual_v2 for higher quality at twice the cost and a little more delay).

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
const VOICE_ID = Deno.env.get("ELEVENLABS_VOICE_ID") || "21m00Tcm4TlvDq8ikWAM";
const MODEL_ID = Deno.env.get("ELEVENLABS_MODEL") || "eleven_flash_v2_5";

// Voices a student may choose between (all added to Aaron's ElevenLabs "My Voices"). The request carries only a short key,
// never a voice id, so nobody can spend the budget on an arbitrary voice. Unknown/missing key = the default voice above.
const VOICES: Record<string, string> = {
  carolina: VOICE_ID,
  sofia: "b2htR0pMe28pYwCY9gnP",   // Sofía: Colombian (Medellín), female
  diego: "hLWSpwRIXvafYWP2GPET",   // Diego: neutral Latin American, male
  salva: "hyKxCTlAqtnW188CgltM",   // Salva: Peninsular, male
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_ORIGINS = new Set([
  "https://aaron-learning.com",
  "https://www.aaron-learning.com",
  "http://localhost:8765",
]);

const MAX_CHARS = 700;
// ElevenLabs "speed" runs 0.7 to 1.2. Normal is a touch under natural pace so a learner can follow.
const SPEEDS: Record<string, number> = { normal: 0.95, slow: 0.75 };

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

// Best-effort per-student cost guard (in-memory, per server instance, same approach as ai-companion).
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

const SPEAK_RULES: RateRule[] = [
  { name: "speak-min", limit: 20, windowMs: 60_000 },
  { name: "speak-day", limit: 150, windowMs: 24 * 3600_000 },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  if (!ELEVENLABS_API_KEY) return json(req, { error: "voice_not_configured" }, 503);

  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(req, { error: "Missing Authorization header" }, 401);

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!userRes.ok) return json(req, { error: "Not authenticated" }, 401);
  const user = await userRes.json();
  if (!user?.id) return json(req, { error: "Not authenticated" }, 401);

  let body: { text?: unknown; lang?: unknown; pace?: unknown; voice?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid JSON body" }, 400);
  }
  const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS) : "";
  if (!text) return json(req, { error: "text is required" }, 400);
  const lang = body.lang === "en" ? "en" : "es";
  const speed = SPEEDS[body.pace === "slow" ? "slow" : "normal"];
  const voiceId = (typeof body.voice === "string" && VOICES[body.voice]) || VOICE_ID;

  if (!tryConsume(user.id, SPEAK_RULES)) {
    return json(req, { error: "Vas muy rápido. Espera un momento e inténtalo otra vez." }, 429);
  }

  try {
    const payload: Record<string, unknown> = {
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed },
    };
    // language_code is only accepted by the flash/turbo models, not by multilingual_v2.
    if (/flash|turbo/i.test(MODEL_ID)) payload.language_code = lang;

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_64`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": ELEVENLABS_API_KEY, Accept: "audio/mpeg" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("ElevenLabs error for user", user.id, res.status, detail.slice(0, 500));
      return json(req, { error: "voice_unavailable", status: res.status }, 502);
    }
    return new Response(res.body, {
      status: 200,
      headers: { ...corsHeaders(req), "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch (err) {
    console.error("ai-speak function error:", err);
    return json(req, { error: "voice_unavailable" }, 502);
  }
});
