import { describe, expect, it } from "vitest";
import { getTodaySupabaseTaskSeed } from "./supabaseLearning";
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
});
