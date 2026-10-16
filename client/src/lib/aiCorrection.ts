import { getSupabase } from "@/lib/supabase";

export type WritingFeedback = { score: number; correctedText: string; explanationArabic: string; strengths: string[]; priorities: string[] };

// Calls the `correct-writing` Edge Function. Returns null when the function is not
// deployed, the provider is not configured, or the request fails, so callers fall
// back to guided self-review.
export async function requestWritingCorrection(text: string, context: string): Promise<WritingFeedback | null> {
  try {
    const supabase: any = getSupabase();
    const { data, error } = await supabase.functions.invoke("correct-writing", { body: { text, context } });
    if (error) { console.warn("[correct-writing]", error); return null; }
    if (!data?.available || !data.feedback) return null;
    return data.feedback as WritingFeedback;
  } catch {
    return null;
  }
}
