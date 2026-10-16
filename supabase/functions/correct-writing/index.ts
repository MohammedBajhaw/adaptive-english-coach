// Supabase Edge Function: AI writing correction through any OpenAI-compatible provider.
// The provider key lives only in Supabase secrets (AI_CORRECTION_*), never in the browser.
// Deploy: supabase functions deploy correct-writing
// Secrets: AI_CORRECTION_BASE_URL, AI_CORRECTION_API_KEY, AI_CORRECTION_MODEL and optionally AI_CORRECTION_FALLBACK_MODEL
// (used once when the main model answers 429 or 5xx). Set them with `supabase secrets set` or in the dashboard.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const systemPrompt = "You are an English writing coach for an A2/B1 mechatronics engineering learner. Return JSON only with score (0-100), correctedText, explanationArabic, strengths (max 5 strings), priorities (max 5 strings). Explain in Arabic, preserve the learner's intended meaning, and focus on useful grammar and clarity corrections.";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "content-type": "application/json" } });
}

function extractJson(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced ?? content).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Provider did not return JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

function cleanList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 5).map(item => item.slice(0, 300)) : [];
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const baseUrl = Deno.env.get("AI_CORRECTION_BASE_URL");
  const apiKey = Deno.env.get("AI_CORRECTION_API_KEY");
  const model = Deno.env.get("AI_CORRECTION_MODEL");
  if (!baseUrl || !apiKey || !model) return json({ available: false, feedback: null });

  const { text, context } = await request.json().catch(() => ({})) as { text?: unknown; context?: unknown };
  if (typeof text !== "string" || text.trim().length === 0 || text.length > 5000) return json({ error: "text is required (max 5000 chars)" }, 400);

  const normalized = baseUrl.replace(/\/+$/, "");
  const endpoint = normalized.endsWith("/chat/completions") ? normalized : `${normalized}/chat/completions`;
  const fallbackModel = Deno.env.get("AI_CORRECTION_FALLBACK_MODEL");

  async function ask(modelName: string) {
    return await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelName,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Context: ${typeof context === "string" ? context.slice(0, 1000) : "Engineering English practice"}\n\nLearner text:\n${text}` },
        ],
      }),
    });
  }

  let response = await ask(model);
  if ((response.status === 429 || response.status >= 500) && fallbackModel && fallbackModel !== model) {
    console.warn(`Model ${model} answered ${response.status}; retrying with ${fallbackModel}`);
    response = await ask(fallbackModel);
  }
  if (!response.ok) {
    console.error(`Provider error ${response.status}: ${(await response.text().catch(() => "")).slice(0, 300)}`);
    return json({ error: `Provider error ${response.status}` }, 502);
  }

  try {
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
    const parsed = extractJson(payload.choices?.[0]?.message?.content ?? "");
    const score = Number(parsed.score);
    if (!Number.isFinite(score) || typeof parsed.correctedText !== "string" || typeof parsed.explanationArabic !== "string") throw new Error("Invalid feedback shape");
    return json({
      available: true,
      feedback: {
        score: Math.max(0, Math.min(100, Math.round(score))),
        correctedText: parsed.correctedText.slice(0, 5000),
        explanationArabic: parsed.explanationArabic.slice(0, 5000),
        strengths: cleanList(parsed.strengths),
        priorities: cleanList(parsed.priorities),
      },
    });
  } catch {
    return json({ error: "Provider returned unreadable feedback" }, 502);
  }
});
