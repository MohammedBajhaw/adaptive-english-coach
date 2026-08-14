import { describe, expect, it, vi } from "vitest";
import { correctWritingWithProvider } from "./ai-correction";

describe("provider-neutral writing correction", () => {
  it("uses an OpenAI-compatible chat endpoint and validates the structured feedback", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ score: 82, correctedText: "We were calibrating the sensor when the alarm went off.", explanationArabic: "استخدمت الماضي المستمر للخلفية والماضي البسيط للحدث القصير.", strengths: ["صياغة واضحة"], priorities: ["أضف أداة التعريف عند الحاجة"] }) } }] }), { status: 200 }));
    const result = await correctWritingWithProvider({ text: "We calibrating sensor when alarm went off", context: "Past continuous" }, { baseUrl: "https://provider.example/v1", apiKey: "secret", model: "free-model" }, fetcher);
    expect(fetcher).toHaveBeenCalledWith("https://provider.example/v1/chat/completions", expect.objectContaining({ method: "POST" }));
    expect(result.feedback).toMatchObject({ score: 82, correctedText: "We were calibrating the sensor when the alarm went off." });
  });
});
