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
    expect(cards).toHaveLength(28);
    expect(new Set(cards.map(card => card.content_id)).size).toBe(28);
    for (const card of cards) {
      expect(card.term && card.arabic_meaning && card.ipa && card.part_of_speech).toBeTruthy();
      expect(card.examples).toHaveLength(5);
      expect(card.examples.every(example => example.english && /[؀-ۿ]/.test(example.arabic))).toBe(true);
    }
    expect(cards[0]).toMatchObject({ content_id: "vocabulary.w01.d01", term: "sensor", ipa: "/ˈsɛn.sər/" });
  });
});
