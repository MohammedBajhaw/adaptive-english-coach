import { describe, expect, it } from "vitest";
import { aggregateScore, buildCalibrationGaps, buildDailyTaskPlan, completeVocabularyReviewWorkflow, conversationScoreToEvidence, isVocabularyReviewComplete, persistConversationEvaluationWorkflow, practicalBand, reviewSchedule, selectDailyConversationPlan, selectDailyListeningPlan, selectListeningTrack, summarizeDailySkills } from "./learning-engine";

describe("محرك خطة التعلم", () => {
  it("يوزع الدقائق اليومية كاملة بين المهارات مع الحفاظ على حد أدنى", () => {
    const plan = buildDailyTaskPlan(50, { vocabulary: 25, grammar: 20, listening: 15, speaking: 25, writing: 15 });
    expect(plan).toHaveLength(5);
    expect(plan.reduce((sum, task) => sum + task.minutes, 0)).toBe(50);
    expect(plan.every(task => task.minutes >= 5)).toBe(true);
  });

  it("يعيد البطاقة الضعيفة في اليوم نفسه ويرفع البطاقات القوية بفاصل أطول", () => {
    const now = new Date("2026-08-14T08:00:00Z");
    const weak = reviewSchedule("again", 2, now);
    const strong = reviewSchedule("easy", 4, now);
    expect(weak.nextStrength).toBe(1);
    expect(weak.nextReviewAt.getTime() - now.getTime()).toBe(4 * 60 * 60 * 1000);
    expect(strong.nextReviewAt.getTime() - now.getTime()).toBe(168 * 60 * 60 * 1000);
  });

  it("لا يمنح مستوى ثابتًا قبل توفر قدر كاف من الأدلة", () => {
    expect(practicalBand(70, 2)).toContain("قيد المعايرة");
    expect(practicalBand(70, 8)).toContain("B1+");
    expect(aggregateScore({ vocabulary: 60, grammar: 60, listening: 60, speaking: 60, writing: 60 })).toBe(60);
  });

  it("يفصل إنجاز كل مهارة ويعرض فجوة ذات سبب ملموس", () => {
    const skillProgress = summarizeDailySkills([
      { skill: "vocabulary", status: "completed" },
      { skill: "grammar", status: "pending" },
      { skill: "listening", status: "pending" },
      { skill: "speaking", status: "pending" },
      { skill: "writing", status: "pending" },
    ]);
    expect(skillProgress.find(item => item.skill === "vocabulary")?.percentage).toBe(100);
    expect(skillProgress.find(item => item.skill === "speaking")?.percentage).toBe(0);
    const gaps = buildCalibrationGaps({
      scores: { vocabulary: 65, grammar: 51, listening: 43, speaking: 35, writing: 48 },
      evidenceCounts: { vocabulary: 1, grammar: 0, listening: 0, speaking: 0, writing: 0 },
      skillProgress,
      weakDueCards: 1,
    });
    expect(gaps[0]?.skill).toBe("speaking");
    expect(gaps[0]?.message).toContain("لا توجد إجابة");
  });

  it("يكمل مهمة المفردات فقط عندما تختفي البطاقات المستحقة ويحوّل تقييم المحادثة إلى دليل", () => {
    expect(isVocabularyReviewComplete(1)).toBe(false);
    expect(isVocabularyReviewComplete(0)).toBe(true);
    expect(conversationScoreToEvidence(7.5)).toBe(75);
    expect(selectListeningTrack("قيد المعايرة · A2/B1")).toBe("guided-workplace");
    expect(selectListeningTrack("B1 · مستقل")).toBe("workplace-b1");
  });

  it("يدور محتوى المحادثة والاستماع يوميًا ويكيّفه مع التخصص والمستوى", () => {
    const firstConversation = selectDailyConversationPlan("2026-08-14", "mechatronics", "job_interviews");
    const nextConversation = selectDailyConversationPlan("2026-08-15", "mechatronics", "job_interviews");
    expect(firstConversation.id).not.toBe(nextConversation.id);
    expect(firstConversation.prompt).toContain("Mechatronics Engineering");
    expect(selectDailyConversationPlan("2026-08-14", "mechatronics", "daily_work").goalTrack).toBe("daily_work");
    expect(selectDailyConversationPlan("2026-08-14", "mechatronics", "daily_work").prompt).not.toBe(firstConversation.prompt);
    const guided = selectDailyListeningPlan("2026-08-14", "قيد المعايرة · A2/B1");
    const workplace = selectDailyListeningPlan("2026-08-14", "B1 · مستقل");
    expect(guided.source).toContain("British Council");
    expect(workplace.source).toContain("BBC");
  });

  it("يكمل مهمة المفردات تلقائيًا فقط بعد آخر بطاقة مستحقة", async () => {
    const events: string[] = [];
    const incomplete = await completeVocabularyReviewWorkflow({ remainingDueCardCount: 1, markVocabularyTaskComplete: async () => { events.push("complete"); }, refreshCalibration: async () => { events.push("recompute"); } });
    expect(incomplete).toBe(false);
    expect(events).toEqual([]);
    const complete = await completeVocabularyReviewWorkflow({ remainingDueCardCount: 0, markVocabularyTaskComplete: async () => { events.push("complete"); }, refreshCalibration: async () => { events.push("recompute"); } });
    expect(complete).toBe(true);
    expect(events).toEqual(["complete", "recompute"]);
  });

  it("يحفظ تقييم المحادثة كدليل للمحادثة ثم يكمل المهمة ويعيد المعايرة", async () => {
    const events: string[] = [];
    const evidence: Array<{ score: number; prompt: string; response: string }> = [];
    const score = await persistConversationEvaluationWorkflow({
      scoreOutOfTen: 7.5,
      prompt: "daily prompt",
      persistEvidence: async item => { evidence.push(item); events.push("evidence"); },
      markSpeakingTaskComplete: async () => { events.push("complete-speaking"); },
      refreshCalibration: async () => { events.push("recompute"); },
    });
    expect(score).toBe(75);
    expect(evidence[0]).toEqual({ score: 75, prompt: "daily prompt", response: "Overall score: 7.5/10" });
    expect(events).toEqual(["evidence", "complete-speaking", "recompute"]);
  });
});
