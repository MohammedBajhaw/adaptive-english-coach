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

describe("local vocabulary cards", () => {
  it("parses every engineering word with IPA, meaning and five translated examples", async () => {
    const { getLocalVocabularyCards } = await import("./localLessons");
    const cards = getLocalVocabularyCards();
    expect(cards).toHaveLength(28 + 98);
    expect(new Set(cards.map(card => card.content_id)).size).toBe(28 + 98);
    for (const card of cards) {
      expect(card.term && card.arabic_meaning && card.ipa && card.part_of_speech).toBeTruthy();
      expect(card.examples).toHaveLength(5);
      expect(card.examples.every(example => example.english && /[؀-ۿ]/.test(example.arabic))).toBe(true);
    }
    expect(cards[0]).toMatchObject({ content_id: "vocabulary.w01.d01", term: "sensor", ipa: "/ˈsɛn.sər/" });
  });
});

describe("curriculum day", () => {
  it("يبدأ كل متعلم من اليوم الأول ثم يتقدم يومًا بيوم", async () => {
    const lessons = await import("./localLessons");
    lessons.setLearnerStartDate("2026-03-10T08:00:00Z");
    expect(lessons.getLessonDayIndex(new Date("2026-03-10T23:00:00Z"))).toBe(0);
    expect(lessons.getLessonDayIndex(new Date("2026-03-11T01:00:00Z"))).toBe(1);
    expect(lessons.getLessonDayIndex(new Date("2026-04-14T01:00:00Z"))).toBe(35);
    expect(lessons.getLessonDayIndex(new Date("2026-03-01T00:00:00Z"))).toBe(0);
  });

  it("لا يفتح كلمات الأسبوع الخامس قبل يومها ويفتح سبع كلمات يوميًا بعد ذلك", async () => {
    const { getLocalVocabularyCards } = await import("./localLessons");
    const cards = getLocalVocabularyCards();
    const unlockedOn = (day: number) => cards.filter(card => card.unlock_day <= day).length;
    expect(unlockedOn(0)).toBe(1);
    expect(unlockedOn(27)).toBe(28);
    expect(unlockedOn(28)).toBe(35);
    expect(unlockedOn(34)).toBe(28 + 49);
    expect(unlockedOn(41)).toBe(28 + 98);
  });
});
