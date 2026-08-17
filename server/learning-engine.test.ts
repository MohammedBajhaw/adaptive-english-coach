import { describe, expect, it } from "vitest";
import { aggregateScore, buildCalibrationGaps, buildDailyTaskPlan, buildPeriodSkillMetrics, completeVocabularyReviewWorkflow, conversationScoreToEvidence, describeDailyPlan, getStudyModeProfile, gradeGrammarChoices, isVocabularyReviewComplete, parseGoalTracks, persistConversationEvaluationWorkflow, practicalBand, reviewSchedule, selectDailyConversationPlan, selectDailyListeningPlan, selectListeningTrack, summarizeDailySkills } from "./learning-engine";
import { selectNextLocalContent } from "./content-library/catalog";

describe("محرك خطة التعلم", () => {
  it("يبني خمس مهارات بمجموع حمل نمط التقدم المتوازن", () => {
    const plan = buildDailyTaskPlan(30, { vocabulary: 25, grammar: 20, listening: 15, speaking: 25, writing: 15 }, "balanced");
    expect(plan).toHaveLength(5);
    expect(plan.reduce((sum, task) => sum + task.minutes, 0)).toBe(30);
    expect(plan.every(task => task.minutes >= 3)).toBe(true);
  });

  it("يبني الأنماط الثلاثة بتغطية كل المهارات ويعطي المهارة الأعلى وزنًا تطبيقًا إضافيًا", () => {
    const weights = { vocabulary: 10, grammar: 15, listening: 10, speaking: 60, writing: 5 };
    const steady = buildDailyTaskPlan(15, weights, "steady");
    const balanced = buildDailyTaskPlan(30, weights, "balanced");
    const intensive = buildDailyTaskPlan(45, weights, "intensive");
    expect(steady).toHaveLength(5);
    expect(balanced).toHaveLength(5);
    expect(intensive).toHaveLength(5);
    expect(steady.map(task => task.skill)).toEqual(["vocabulary", "grammar", "listening", "speaking", "writing"]);
    expect(steady.find(task => task.skill === "speaking")?.instructions).toContain("أولوية");
    expect(getStudyModeProfile("steady")).toMatchObject({ vocabularyWords: 5, conversationMinutes: 5, listeningQuestions: 2, grammarChoiceQuestions: 5 });
    expect(getStudyModeProfile("balanced")).toMatchObject({ vocabularyWords: 7, conversationMinutes: 10, listeningQuestions: 4, grammarChoiceQuestions: 10 });
    expect(getStudyModeProfile("intensive")).toMatchObject({ vocabularyWords: 10, conversationMinutes: 13, listeningQuestions: 6, grammarChoiceQuestions: 20 });
    expect(describeDailyPlan(15).label).toBe("ثبات يومي");
    expect(describeDailyPlan(30).label).toBe("تقدم متوازن");
    expect(describeDailyPlan(45).label).toBe("تحدٍّ مكثف");
  });

  it("يختار محتوى محليًا جديدًا ثم يعيد المحتوى المستحق للمراجعة دون تكرار عنصر اليوم", () => {
    const now = new Date("2026-08-17T08:00:00Z");
    const first = selectNextLocalContent({ skill: "grammar", progress: [], now });
    expect(first?.item.id).toBe("grammar.w01.d01");
    const active = selectNextLocalContent({ skill: "grammar", progress: [{ contentId: first!.item.id, status: "introduced", lastSeenAt: now, nextReviewAt: null }], now });
    expect(active).toMatchObject({ mode: "continue", item: { id: "grammar.w01.d01" } });
    const review = selectNextLocalContent({ skill: "grammar", progress: [{ contentId: first!.item.id, status: "completed", lastSeenAt: new Date("2026-08-10T08:00:00Z"), nextReviewAt: new Date("2026-08-16T08:00:00Z") }], now });
    expect(review).toMatchObject({ mode: "review", item: { id: "grammar.w01.d01" } });
    const excluded = selectNextLocalContent({ skill: "grammar", progress: [], excludeContentIds: [first!.item.id], now });
    expect(excluded?.item.id).toBe("grammar.w01.d02");
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
    const skillProgress = summarizeDailySkills([{ skill: "vocabulary", status: "completed" }, { skill: "grammar", status: "pending" }, { skill: "listening", status: "pending" }, { skill: "speaking", status: "pending" }, { skill: "writing", status: "pending" }]);
    expect(skillProgress.find(item => item.skill === "vocabulary")?.percentage).toBe(100);
    const gaps = buildCalibrationGaps({ scores: { vocabulary: 65, grammar: 51, listening: 43, speaking: 35, writing: 48 }, evidenceCounts: { vocabulary: 1, grammar: 0, listening: 0, speaking: 0, writing: 0 }, skillProgress, weakDueCards: 1 });
    expect(gaps[0]?.skill).toBe("speaking");
  });

  it("يكمل مهمة المفردات فقط عندما تختفي البطاقات المستحقة ويحوّل تقييم المحادثة إلى دليل", () => {
    expect(isVocabularyReviewComplete(1)).toBe(false);
    expect(isVocabularyReviewComplete(0)).toBe(true);
    expect(conversationScoreToEvidence(7.5)).toBe(75);
    expect(selectListeningTrack("قيد المعايرة · A2/B1")).toBe("guided-workplace");
    expect(selectListeningTrack("B1 · مستقل")).toBe("workplace-b1");
  });

  it("يدور محتوى المحادثة والاستماع يوميًا ويكيّفه مع التخصص ومسارات الهدف المتعددة", () => {
    const firstConversation = selectDailyConversationPlan("2026-08-14", "mechatronics", "job_interviews", "steady");
    const nextConversation = selectDailyConversationPlan("2026-08-15", "mechatronics", "job_interviews", "balanced");
    expect(firstConversation.id).not.toBe(nextConversation.id);
    expect(firstConversation.prompt).toContain("Mechatronics Engineering");
    expect(firstConversation.targetMinutes).toBe(5);
    expect(nextConversation.targetMinutes).toBe(10);
    expect(firstConversation.words[0]?.arabic).toBeTruthy();
    const multiGoal = selectDailyConversationPlan("2026-08-14", "mechatronics", "job_interviews,daily_work,general_communication");
    expect(multiGoal.goalTracks).toHaveLength(3);
    expect(multiGoal.goalLabel).toContain("مقابلات العمل");
    expect(parseGoalTracks("daily_work,general_communication")).toEqual(["daily_work", "general_communication"]);
    const guided = selectDailyListeningPlan("2026-08-14", "قيد المعايرة · A2/B1");
    const workplace = selectDailyListeningPlan("2026-08-14", "B1 · مستقل");
    expect(guided.source).toContain("British Council");
    expect(workplace.source).toContain("BBC");
  });

  it("يحسب نتيجة الأسئلة الخمسة الموضوعية منفصلة عن التقييم الذاتي للكتابة", () => {
    expect(gradeGrammarChoices([1, 0, 0, 0, 1], [1, 0, 0, 0, 1])).toEqual({ correct: 5, total: 5, score: 70 });
    expect(gradeGrammarChoices([1, 2, 0, null, 1], [1, 0, 0, 0, 1])).toEqual({ correct: 3, total: 5, score: 42 });
  });

  it("يكمل مهمة المفردات تلقائيًا فقط بعد آخر بطاقة مستحقة", async () => {
    const events: string[] = [];
    const incomplete = await completeVocabularyReviewWorkflow({ remainingDueCardCount: 1, markVocabularyTaskComplete: async () => { events.push("complete"); }, refreshCalibration: async () => { events.push("recompute"); } });
    expect(incomplete).toBe(false);
    const complete = await completeVocabularyReviewWorkflow({ remainingDueCardCount: 0, markVocabularyTaskComplete: async () => { events.push("complete"); }, refreshCalibration: async () => { events.push("recompute"); } });
    expect(complete).toBe(true);
    expect(events).toEqual(["complete", "recompute"]);
  });

  it("يحفظ تقييم المحادثة كدليل للمحادثة ثم يكمل المهمة ويعيد المعايرة", async () => {
    const events: string[] = [];
    const evidence: Array<{ score: number; prompt: string; response: string }> = [];
    const score = await persistConversationEvaluationWorkflow({ scoreOutOfTen: 7.5, prompt: "daily prompt", persistEvidence: async item => { evidence.push(item); events.push("evidence"); }, markSpeakingTaskComplete: async () => { events.push("complete-speaking"); }, refreshCalibration: async () => { events.push("recompute"); } });
    expect(score).toBe(75);
    expect(evidence[0]).toEqual({ score: 75, prompt: "daily prompt", response: "Overall score: 7.5/10" });
    expect(events).toEqual(["evidence", "complete-speaking", "recompute"]);
  });

  it("يبني مقاييس أسبوعية وشهرية منفصلة لكل مهارة من اللقطات والأدلة والمهام", () => {
    const metrics = buildPeriodSkillMetrics({ scoreHistory: { vocabulary: [40, 60], grammar: [50], listening: [], speaking: [45, 42], writing: [55, 65] }, evidenceCounts: { vocabulary: 3, grammar: 1, listening: 0, speaking: 2, writing: 2 }, completedTasks: { vocabulary: 4, grammar: 1, listening: 0, speaking: 2, writing: 2 }, strongCards: 6 });
    expect(metrics.find(item => item.skill === "vocabulary")).toMatchObject({ averageScore: 50, scoreChange: 20, evidenceCount: 3, completedTasks: 4, strongCards: 6 });
    expect(metrics.find(item => item.skill === "listening")).toMatchObject({ latestScore: 42, averageScore: 42, evidenceCount: 0 });
  });
});
