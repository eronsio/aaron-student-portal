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
// Chat turns stay on the fast/cheap model. The end-of-session report for Aaron
// (task: "report") is one call per session and its accuracy matters, so it gets
// the stronger model, with Haiku as a fallback if that model call fails.
const CHAT_MODEL = "claude-haiku-4-5-20251001";
const REPORT_MODELS = ["claude-sonnet-5", CHAT_MODEL];

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

  let body: { messages?: unknown; systemPrompt?: unknown; task?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid JSON body" }, 400);
  }
  const { messages, systemPrompt } = body;
  if (!Array.isArray(messages) || messages.length === 0 || typeof systemPrompt !== "string") {
    return json(req, { error: "messages[] and systemPrompt are required" }, 400);
  }

  // Anything other than the exact string "report" is a normal chat turn, so
  // older cached copies of the portal keep working unchanged.
  const isReport = body.task === "report";
  const limits = isReport
    ? { perMessage: 16000, system: 12000, maxTokens: 1800, models: REPORT_MODELS }
    : { perMessage: 4000, system: 8000, maxTokens: 250, models: [CHAT_MODEL] };

  const safeMessages = messages
    .slice(-20)
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m: any) => ({ role: m.role, content: m.content.slice(0, limits.perMessage) }));
  // The Messages API wants the conversation to open with a user turn. Trimming to
  // the last 20 messages (or an AI-written opening line) can leave an assistant
  // turn first, so drop any leading ones.
  while (safeMessages.length > 0 && safeMessages[0].role !== "user") safeMessages.shift();
  if (safeMessages.length === 0) return json(req, { error: "No valid messages" }, 400);

  try {
    let lastError = "Anthropic API error";
    for (const model of limits.models) {
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: limits.maxTokens,
          system: systemPrompt.slice(0, limits.system),
          messages: safeMessages,
        }),
      });
      const data = await anthropicRes.json();
      if (anthropicRes.ok) return json(req, { text: data.content?.[0]?.text || "" });
      console.error("Anthropic error for user", user.id, "model", model, data);
      lastError = data?.error?.message || lastError;
    }
    return json(req, { error: lastError }, 502);
  } catch (err) {
    console.error("ai-companion function error:", err);
    return json(req, { error: "Upstream request failed" }, 502);
  }
});
