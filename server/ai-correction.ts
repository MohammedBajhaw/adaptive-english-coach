import { z } from "zod";
import { ENV } from "./_core/env";

const feedbackSchema = z.object({
  score: z.number().min(0).max(100),
  correctedText: z.string().min(1).max(5000),
  explanationArabic: z.string().min(1).max(5000),
  strengths: z.array(z.string().min(1).max(300)).max(5),
  priorities: z.array(z.string().min(1).max(300)).max(5),
});

export type WritingCorrection = z.infer<typeof feedbackSchema>;
export type CorrectionProviderConfig = { baseUrl: string; apiKey: string; model: string };

export function getCorrectionProviderStatus() {
  const missing = [
    !ENV.aiCorrectionBaseUrl ? "AI_CORRECTION_BASE_URL" : null,
    !ENV.aiCorrectionApiKey ? "AI_CORRECTION_API_KEY" : null,
    !ENV.aiCorrectionModel ? "AI_CORRECTION_MODEL" : null,
  ].filter((value): value is string => Boolean(value));
  return { configured: missing.length === 0, missing };
}

function completionUrl(baseUrl: string) {
  const normalized = baseUrl.replace(/\/+$/, "");
  return normalized.endsWith("/chat/completions") ? normalized : `${normalized}/chat/completions`;
}

function extractJson(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = (fenced ?? content).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("لم يرجع المزود صيغة JSON صالحة.");
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function correctWritingWithProvider(input: { text: string; context: string }, config: CorrectionProviderConfig, fetcher: typeof fetch = fetch) {
  const response = await fetcher(completionUrl(config.baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are an English writing coach for an A2/B1 engineering learner. Return JSON only with score (0-100), correctedText, explanationArabic, strengths (max 5), priorities (max 5). Explain in Arabic, preserve the learner's intended meaning, and focus on useful grammar and clarity corrections." },
        { role: "user", content: `Context: ${input.context}\n\nLearner text:\n${input.text}` },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`فشل مزود التصحيح (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("لم يرجع مزود التصحيح محتوى قابلًا للقراءة.");
  return { available: true as const, missing: [], feedback: feedbackSchema.parse(extractJson(content)) };
}

export async function correctWritingWithConfiguredProvider(input: { text: string; context: string }) {
  const status = getCorrectionProviderStatus();
  if (!status.configured) return { available: false as const, missing: status.missing, feedback: null };
  return correctWritingWithProvider(input, { baseUrl: ENV.aiCorrectionBaseUrl, apiKey: ENV.aiCorrectionApiKey, model: ENV.aiCorrectionModel });
}
