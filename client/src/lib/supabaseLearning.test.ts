import { describe, expect, it } from "vitest";
import { getTodaySupabaseTaskSeed, pendingTaskIdsWithTodayEvidence } from "./supabaseLearning";
import { getTodayContentIds } from "./localLessons";

describe("getTodaySupabaseTaskSeed", () => {
  it("ينشئ مهمة قواعد مكتملة البيانات إذا فُتح الدرس قبل لوحة اليوم", () => {
    const seed = getTodaySupabaseTaskSeed("grammar");
    expect(seed.task_key).toBe("grammar");
    expect(seed.skill).toBe("grammar");
    expect(seed.content_id).toBe(getTodayContentIds().grammar);
    expect(seed.date_key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("يرفض مفتاح مهمة غير معروف بدل إنشاء صف غير صالح", () => {
    expect(() => getTodaySupabaseTaskSeed("unknown")).toThrow("مفتاح المهمة اليومية غير معروف");
  });

  it("يستعيد إتمام مهمة اليوم عندما كانت المحاولة محفوظة قبل إنشاء المهمة", () => {
    const tasks = [
      { id: "grammar-task", skill: "grammar", status: "pending" },
      { id: "writing-task", skill: "writing", status: "pending" },
      { id: "done-listening", skill: "listening", status: "completed" },
    ];
    expect(pendingTaskIdsWithTodayEvidence(tasks, [{ skill: "grammar" }, { skill: "listening" }])).toEqual(["grammar-task"]);
  });
});

describe("the wake cycle is the app's day", () => {
  it("درس اليوم يتبع رقم الدورة: الدورة 1 هي اليوم الأول والدورة 2 هي اليوم الثاني", async () => {
    const { setCycle, getCycle } = await import("./cycle");
    const lessons = await import("./localLessons");
    const before = getCycle();
    const cycle = (number: number) => ({ number, openedAt: "2026-10-20T01:00:00Z", startedAt: "2026-10-20T01:00:00Z", dateKey: "2026-10-20", hours: 18 });
    try {
      setCycle(cycle(1));
      expect(lessons.getLessonDayIndex()).toBe(0);
      const first = lessons.getTodayContentIds();
      setCycle(cycle(2));
      expect(lessons.getLessonDayIndex()).toBe(1);
      expect(lessons.getTodayContentIds().grammar).not.toBe(first.grammar);
      setCycle(cycle(1 + lessons.curriculumDays));
      expect(lessons.getTodayContentIds().grammar).toBe(first.grammar); // the curriculum starts over after its last day
    } finally {
      setCycle(before);
    }
  });

  it("مهام الدورة تأخذ تاريخ الدورة لا التاريخ الميلادي، وتتغير بتغيرها", async () => {
    const { setCycle, getCycle } = await import("./cycle");
    const before = getCycle();
    try {
      setCycle({ number: 4, openedAt: "2026-10-20T01:00:00Z", startedAt: "2026-10-20T01:00:00Z", dateKey: "2026-10-23", hours: 18 });
      expect(getTodaySupabaseTaskSeed("grammar").date_key).toBe("2026-10-23");
      setCycle({ number: 5, openedAt: "2026-10-21T01:00:00Z", startedAt: "2026-10-21T01:00:00Z", dateKey: "2026-10-24", hours: 18 });
      expect(getTodaySupabaseTaskSeed("grammar").date_key).toBe("2026-10-24");
    } finally {
      setCycle(before);
    }
  });
});
