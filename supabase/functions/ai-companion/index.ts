// Supabase Edge Function: ai-companion
//
// Server-side proxy for the student-facing "AI Companion" Spanish speaking-
// practice chat. Exists so the Anthropic API key never reaches the browser
// (unlike the old direct-from-browser call that read the key out of
// localStorage — that only ever worked in Aaron's own browser and would have
// exposed a live, billable key to anyone if baked into the public script.js).
//
// Deploy with the default JWT verification ENABLED (do not deploy with
// --no-verify-jwt). That check alone only proves "a validly-signed JWT for
// this project" — the public anon key is itself such a JWT — so this
// function additionally resolves the token via /auth/v1/user to confirm the
// caller is a real logged-in student, not just anyone holding the anon key.
//
// Required secret: ANTHROPIC_API_KEY (set via the Supabase dashboard or CLI,
// see deploy notes handed to Aaron separately). SUPABASE_URL and the anon
// key are auto-injected into every Edge Function's environment.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

const ALLOWED_ORIGINS = new Set([
  "https://aaron-learning.com",
  "https://www.aaron-learning.com",
  "http://localhost:8765",
]);

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  if (!ANTHROPIC_API_KEY) return json(req, { error: "Server misconfigured: missing ANTHROPIC_API_KEY" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json(req, { error: "Missing Authorization header" }, 401);

  // Confirm this is a real logged-in student, not just someone with the
  // public anon key (which also passes gateway-level JWT verification).
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY },
  });
  if (!userRes.ok) return json(req, { error: "Not authenticated" }, 401);
  const user = await userRes.json();
  if (!user?.id) return json(req, { error: "Not authenticated" }, 401);

  let body: { messages?: unknown; systemPrompt?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid JSON body" }, 400);
  }
  const { messages, systemPrompt } = body;
  if (!Array.isArray(messages) || messages.length === 0 || typeof systemPrompt !== "string") {
    return json(req, { error: "messages[] and systemPrompt are required" }, 400);
  }

  const safeMessages = messages
    .slice(-20)
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (safeMessages.length === 0) return json(req, { error: "No valid messages" }, 400);

  try {
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 250,
        system: systemPrompt.slice(0, 6000),
        messages: safeMessages,
      }),
    });
    const data = await anthropicRes.json();
    if (!anthropicRes.ok) {
      console.error("Anthropic error for user", user.id, data);
      return json(req, { error: data?.error?.message || "Anthropic API error" }, 502);
    }
    return json(req, { text: data.content?.[0]?.text || "" });
  } catch (err) {
    console.error("ai-companion function error:", err);
    return json(req, { error: "Upstream request failed" }, 502);
  }
});
