import { describe, expect, it } from "vitest";
import {
  BUDGET_UNITS,
  EASY_RETURN_HOURS,
  MAX_NEW_PER_CYCLE,
  RATING_UNITS,
  deriveSession,
  cycleWords,
  loadPercent,
  loadUnits,
  nextStrength,
  reviewDelayHours,
  stopReason,
  type Rating,
} from "./vocabSession";

const repeat = (rating: Rating, count: number) => Array.from({ length: count }, () => rating);
const stopsAt = (ratings: Rating[]) => loadUnits(ratings) >= BUDGET_UNITS;

describe("load budget (the learner's own examples)", () => {
  it("7 لم أتذكر أو 10 صعبة أو 15 جيدة تصل إلى الحد بالضبط، وواحدة أقل لا تصل", () => {
    expect(loadUnits(repeat("again", 7))).toBe(BUDGET_UNITS);
    expect(loadUnits(repeat("hard", 10))).toBe(BUDGET_UNITS);
    expect(loadUnits(repeat("good", 15))).toBe(BUDGET_UNITS);
    expect(stopsAt(repeat("again", 6))).toBe(false);
    expect(stopsAt(repeat("hard", 9))).toBe(false);
    expect(stopsAt(repeat("good", 14))).toBe(false);
  });

  it("السهلة بلا تكلفة: ثمانون كلمة سهلة لا توقف الجلسة", () => {
    expect(RATING_UNITS.easy).toBe(0);
    expect(loadUnits(repeat("easy", 80))).toBe(0);
    expect(stopsAt(repeat("easy", 80))).toBe(false);
  });

  it("المجموع تراكمي: 5 لم أتذكر + 6 صعبة يتجاوز الحد، و3 لم أتذكر + 5 صعبة لا يتجاوزه", () => {
    expect(stopsAt([...repeat("again", 5), ...repeat("hard", 6)])).toBe(true);
    expect(loadUnits([...repeat("again", 5), ...repeat("hard", 6)])).toBe(5 * 30 + 6 * 21);
    expect(stopsAt([...repeat("again", 3), ...repeat("hard", 5)])).toBe(false); // 195
    expect(stopsAt([...repeat("again", 3), ...repeat("hard", 6)])).toBe(true); // 216
    // one forgotten word plus six hard ones is only 156, which the learner chose to accept
    expect(loadUnits([...repeat("again", 1), ...repeat("hard", 6)])).toBe(156);
  });

  it("السهلة وسط الصعبة لا تغيّر الحمل، والترتيب لا يهم", () => {
    const mixed: Rating[] = ["easy", "hard", "easy", "easy", "again", "good", "easy"];
    expect(loadUnits(mixed)).toBe(21 + 30 + 14);
    expect(loadUnits([...mixed].reverse())).toBe(21 + 30 + 14);
  });

  it("الكلمة التي لم تُقيَّم بعد لا تُحسب", () => {
    expect(loadUnits([null, undefined, "hard"])).toBe(21);
  });

  it("النسبة المئوية تتوقف عند 100", () => {
    expect(loadPercent(0)).toBe(0);
    expect(loadPercent(105)).toBe(50);
    expect(loadPercent(BUDGET_UNITS)).toBe(100);
    expect(loadPercent(BUDGET_UNITS * 3)).toBe(100);
  });
});

describe("stop reasons", () => {
  const open = { units: 0, newCount: 0, closed: false, remainingWords: 300 };
  it("لا توقف في بداية الجلسة", () => expect(stopReason(open)).toBeNull());
  it("يتوقف عند بلوغ الحد", () => expect(stopReason({ ...open, units: BUDGET_UNITS })).toBe("budget"));
  it("سقف الأمان بعد 100 كلمة جديدة حتى لو كانت كلها سهلة", () => expect(stopReason({ ...open, newCount: MAX_NEW_PER_CYCLE })).toBe("cap"));
  it("زر كفاية لليوم يغلق الجلسة", () => expect(stopReason({ ...open, closed: true })).toBe("closed"));
  it("ينتهي عند استنفاد قائمة الكلمات", () => expect(stopReason({ ...open, remainingWords: 0 })).toBe("exhausted"));
});

describe("fixed review schedule", () => {
  it("كل الفئات غير السهلة تعود بالفاصل نفسه (ساعتان افتراضيًا ويتبع الإعداد)", () => {
    for (const rating of ["again", "hard", "good"] as const) {
      expect(reviewDelayHours(rating)).toBe(2);
      expect(reviewDelayHours(rating, 3)).toBe(3);
    }
  });

  it("السهلة تغيب ثلاثة أسابيع بغض النظر عن الفاصل", () => {
    expect(EASY_RETURN_HOURS).toBe(504);
    expect(reviewDelayHours("easy")).toBe(504);
    expect(reviewDelayHours("easy", 1)).toBe(504);
  });

  it("قوة البطاقة تزيد كما كانت لأجل التقرير فقط", () => {
    expect([nextStrength("again", 2), nextStrength("hard", 2), nextStrength("good", 2), nextStrength("easy", 2)]).toEqual([2, 3, 4, 5]);
  });
});

describe("deriveSession", () => {
  const now = new Date("2026-10-20T10:00:00Z");
  const opened = "2026-10-20T01:00:00Z";
  const base = { review_count: 0, next_review_at: "2026-10-20T01:30:00Z" };
  it("يحسب الحمل من أول تقييم للكلمات المقدَّمة في الدورة الحالية فقط", () => {
    const cards = [
      { id: "a", ...base, review_count: 1, intake_rating: "hard" as const, intake_at: "2026-10-20T02:00:00Z", last_rating: "good" as const, last_reviewed_at: "2026-10-20T06:00:00Z", next_review_at: "2026-10-20T08:00:00Z" },
      { id: "b", ...base, review_count: 1, intake_rating: "again" as const, intake_at: "2026-10-19T20:00:00Z", last_rating: "hard" as const, last_reviewed_at: "2026-10-20T03:00:00Z", next_review_at: "2026-10-20T05:00:00Z" },
      { id: "c", ...base, review_count: 1, intake_rating: "easy" as const, intake_at: "2026-10-20T04:00:00Z", last_rating: "easy" as const, last_reviewed_at: "2026-10-20T04:00:00Z", next_review_at: "2026-11-10T04:00:00Z" },
    ];
    const session = deriveSession({ cards, openedAt: opened, closed: false, totalWords: 432, now });
    expect(session.units).toBe(21); // only "a" (hard) counts; "b" was introduced in the previous cycle, "c" is easy
    expect(session.newCount).toBe(2);
    expect(session.dueReviews.map(card => card.id)).toEqual(["b", "a"]);
    expect(session.stopped).toBe(false);
  });

  it("الكلمة المعروضة وغير المقيّمة تستمر كجديدة، وتتوقف الجديدة عند الحد مع بقاء المراجعات", () => {
    const hardCards = Array.from({ length: 10 }, (_, index) => ({ id: `h${index}`, review_count: 1, next_review_at: "2026-10-20T08:00:00Z", intake_rating: "hard" as const, intake_at: "2026-10-20T02:00:00Z", last_rating: "hard" as const, last_reviewed_at: "2026-10-20T06:00:00Z" }));
    const unrated = { id: "u", review_count: 0, next_review_at: "2026-10-20T09:00:00Z" };
    const session = deriveSession({ cards: [...hardCards, unrated], openedAt: opened, closed: false, totalWords: 432, now });
    expect(session.units).toBe(210);
    expect(session.stopReason).toBe("budget");
    expect(session.pendingNew.map(card => card.id)).toEqual(["u"]);
    expect(session.dueReviews).toHaveLength(10);
  });

  it("كلمات الدورة: المقدَّمة أو المراجَعة فيها، الأحدث أولًا", () => {
    const cards = [
      { id: "old", review_count: 1, next_review_at: "2026-10-22T00:00:00Z", intake_at: "2026-10-18T10:00:00Z", last_reviewed_at: "2026-10-18T10:00:00Z" },
      { id: "reviewedNow", review_count: 2, next_review_at: "2026-10-20T12:00:00Z", intake_at: "2026-10-18T10:00:00Z", last_reviewed_at: "2026-10-20T08:00:00Z" },
      { id: "newNow", review_count: 1, next_review_at: "2026-10-20T12:00:00Z", intake_at: "2026-10-20T03:00:00Z", last_reviewed_at: "2026-10-20T03:00:00Z" },
    ];
    expect(cycleWords(cards, opened).map(card => card.id)).toEqual(["reviewedNow", "newNow"]);
    expect(cycleWords(cards, null)).toEqual([]);
  });
});
