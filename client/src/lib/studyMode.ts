import { getSupabase } from "@/lib/supabase";
import { useEffect, useState } from "react";

export type StudyMode = "steady" | "balanced" | "intensive";

// One source of truth for how each mode changes activity depth (mirrors the table in Settings).
export const studyModeSettings = {
  steady: { label: "ثبات يومي", newWords: 5, grammarQuestions: 5, grammarPrompts: 1, listeningMinutes: 1, listeningQuestions: 2, conversationMinutes: 5, writingSentences: 1 },
  balanced: { label: "تقدم متوازن", newWords: 7, grammarQuestions: 10, grammarPrompts: 1, listeningMinutes: 2, listeningQuestions: 4, conversationMinutes: 10, writingSentences: 3 },
  intensive: { label: "تحدٍّ مكثف", newWords: 10, grammarQuestions: 20, grammarPrompts: 2, listeningMinutes: 4, listeningQuestions: 6, conversationMinutes: 13, writingSentences: 5 },
} as const;

function isStudyMode(value: unknown): value is StudyMode {
  return value === "steady" || value === "balanced" || value === "intensive";
}

export async function loadStudyMode(userId: string): Promise<StudyMode> {
  try {
    const supabase: any = getSupabase();
    const { data } = await supabase.from("learner_profiles").select("study_mode").eq("user_id", userId).maybeSingle();
    return isStudyMode(data?.study_mode) ? data.study_mode : "balanced";
  } catch {
    return "balanced";
  }
}

export function useStudyMode(userId: string | undefined) {
  const [mode, setMode] = useState<StudyMode>("balanced");
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void loadStudyMode(userId).then(value => { if (active) setMode(value); });
    return () => { active = false; };
  }, [userId]);
  return { mode, settings: studyModeSettings[mode] };
}
