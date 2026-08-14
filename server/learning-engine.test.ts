import { describe, expect, it } from "vitest";
import { aggregateScore, buildCalibrationGaps, buildDailyTaskPlan, practicalBand, reviewSchedule, summarizeDailySkills } from "./learning-engine";

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
});
