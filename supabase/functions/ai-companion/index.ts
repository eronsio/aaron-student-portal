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
// The stronger model answers chat turns and writes the end-of-session report; accuracy of the
// corrections is the point of the product (a live test caught the faster model mis-correcting
// "gusta" + infinitive). Haiku is the fallback if the strong model errors or returns nothing.
const FAST_MODEL = "claude-haiku-4-5-20251001";
const STRONG_MODEL = "claude-sonnet-5";
const MODELS = [STRONG_MODEL, FAST_MODEL];

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
    ? { perMessage: 16000, system: 12000, maxTokens: 3500, models: MODELS }
    : { perMessage: 4000, system: 8000, maxTokens: 300, models: MODELS };

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
    const callAnthropic = (payload: Record<string, unknown>) =>
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      });

    for (const model of limits.models) {
      const payload: Record<string, unknown> = {
        model,
        max_tokens: limits.maxTokens,
        system: systemPrompt.slice(0, limits.system),
        messages: safeMessages,
      };
      // Reasoning is switched off for everything: chat replies are three short sentences and the
      // report is structured extraction. Left on, the stronger model spends a large share of
      // max_tokens on hidden reasoning (measured on the report: ~19 s, JSON cut off mid-answer).
      payload.thinking = { type: "disabled" };

      let anthropicRes = await callAnthropic(payload);
      let data = await anthropicRes.json();
      // If a model rejects the thinking setting, retry that model once without it.
      if (!anthropicRes.ok && /thinking/i.test(data?.error?.message || "")) {
        delete payload.thinking;
        anthropicRes = await callAnthropic(payload);
        data = await anthropicRes.json();
      }
      if (anthropicRes.ok) {
        // Newer models can put non-text blocks (e.g. "thinking") before the answer, so
        // gather every text block instead of assuming the first block is the text.
        const text = (Array.isArray(data.content) ? data.content : [])
          .filter((b: any) => b && b.type === "text" && typeof b.text === "string")
          .map((b: any) => b.text)
          .join("");
        // An empty answer is a failure: fall through to the next model.
        if (text) return json(req, { text, model, stop: data.stop_reason });
        console.error("Empty text for user", user.id, "model", model, "stop", data.stop_reason,
          "blocks", (Array.isArray(data.content) ? data.content : []).map((b: any) => b?.type));
        lastError = "The model returned no text";
        continue;
      }
      console.error("Anthropic error for user", user.id, "model", model, data);
      lastError = data?.error?.message || lastError;
    }
    return json(req, { error: lastError }, 502);
  } catch (err) {
    console.error("ai-companion function error:", err);
    return json(req, { error: "Upstream request failed" }, 502);
  }
});
