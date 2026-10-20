import { describe, expect, it } from "vitest";
import {
  addDays,
  canWakeWithoutConfirm,
  clockTimeNear,
  cycleEnded,
  cycleEndsAt,
  cycleFromProfile,
  isStartInRange,
  legacyCycleNumber,
  localDateKey,
  nextCycleDateKey,
  startNewCycle,
  type CycleState,
} from "./cycle";

// Local-time constructors keep these tests independent of the machine's time zone.
const local = (day: number, hour: number, minute = 0, month = 9) => new Date(2026, month, day, hour, minute);

const running = (start: Date, hours = 18): CycleState => ({ number: 3, openedAt: start.toISOString(), startedAt: start.toISOString(), dateKey: localDateKey(start), hours });

describe("cycle date keys", () => {
  it("يضيف أيامًا عبر حدود الأشهر والسنة", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("أول دورة تأخذ تاريخ بدايتها المحلي", () => {
    expect(nextCycleDateKey(local(20, 4), null)).toBe("2026-10-20");
  });

  it("الدورة التالية في يوم لاحق تأخذ تاريخها، وفي اليوم نفسه تأخذ اليوم التالي للسابقة فلا يتعارض القيد الفريد", () => {
    expect(nextCycleDateKey(local(21, 5), "2026-10-20")).toBe("2026-10-21");
    expect(nextCycleDateKey(local(20, 23), "2026-10-20")).toBe("2026-10-21");
    expect(nextCycleDateKey(local(20, 23), "2026-10-25")).toBe("2026-10-26");
  });
});

describe("cycle clock", () => {
  it("تنتهي بعد 18 ساعة بالضبط من بدايتها", () => {
    const start = local(20, 4);
    const state = running(start);
    expect(cycleEndsAt(state)!.getTime() - start.getTime()).toBe(18 * 3_600_000);
    expect(cycleEnded(state, local(20, 21, 59))).toBe(false);
    expect(cycleEnded(state, local(20, 22, 0))).toBe(true);
    expect(cycleEnded(state, local(21, 3))).toBe(true);
  });

  it("المدة قابلة للتغيير", () => {
    expect(cycleEnded(running(local(20, 4), 12), local(20, 16))).toBe(true);
  });

  it("دورة لم تبدأ لا تنتهي", () => {
    expect(cycleEnded({ number: 0, openedAt: null, startedAt: null, dateKey: null, hours: 18 }, local(20, 12))).toBe(false);
  });
});

describe("waking up", () => {
  it("بعد 6 ساعات أو أكثر لا يحتاج تأكيدًا، وقبلها يحتاج", () => {
    const state = running(local(20, 4));
    expect(canWakeWithoutConfirm(state, local(20, 9, 59))).toBe(false);
    expect(canWakeWithoutConfirm(state, local(20, 10, 0))).toBe(true);
  });

  it("الدورة الأولى لا تحتاج تأكيدًا", () => {
    expect(canWakeWithoutConfirm({ number: 0, openedAt: null, startedAt: null, dateKey: null, hours: 18 }, local(20, 4))).toBe(true);
  });

  it("الدورة الجديدة ترفع الرقم وتحفظ المدة وتجنب تعارض التاريخ", () => {
    const previous = { number: 3, dateKey: "2026-10-20", hours: 16 };
    const wake = local(20, 23, 30); // woke up the same calendar day the previous cycle was labelled with
    const next = startNewCycle(previous, wake, wake);
    expect(next).toMatchObject({ number: 4, dateKey: "2026-10-21", hours: 16 });
    expect(next.startedAt).toBe(wake.toISOString());
    expect(next.openedAt).toBe(wake.toISOString());
  });

  it("المستخدم القديم يحتفظ بمكانه في المنهج: اليوم الخامس يصبح الدورة 5", () => {
    expect(legacyCycleNumber("2026-10-16T08:00:00Z", new Date("2026-10-20T09:00:00Z"))).toBe(5);
    expect(legacyCycleNumber("2026-10-20T08:00:00Z", new Date("2026-10-20T09:00:00Z"))).toBe(1);
  });
});

describe("adjusting the start time", () => {
  it("04:00 القادمة قبل الفجر تُختار اليوم نفسه، وبعد الفجر تُختار 04:00 التي مضت", () => {
    const beforeDawn = clockTimeNear(4, 0, local(20, 2, 48));
    expect(beforeDawn.getTime()).toBe(local(20, 4).getTime());
    const afterDawn = clockTimeNear(4, 0, local(20, 6, 30));
    expect(afterDawn.getTime()).toBe(local(20, 4).getTime());
  });

  it("وقت بعيد في المستقبل يُحسب في اليوم السابق", () => {
    expect(clockTimeNear(20, 0, local(20, 2, 48)).getTime()).toBe(local(19, 20).getTime());
  });

  it("الحدود المسموحة: من 24 ساعة ماضية إلى 12 ساعة قادمة", () => {
    const now = local(20, 12);
    expect(isStartInRange(local(19, 12), now)).toBe(true);
    expect(isStartInRange(local(19, 11), now)).toBe(false);
    expect(isStartInRange(local(21, 0), now)).toBe(true);
    expect(isStartInRange(local(21, 1), now)).toBe(false);
  });
});

describe("profile columns", () => {
  it("يقرأ الدورة من الملف الشخصي ويتجاهل ملفًا بلا دورة", () => {
    expect(cycleFromProfile({ cycle_number: 0 })).toBeNull();
    expect(cycleFromProfile({ cycle_number: 2, cycle_started_at: "2026-10-20T01:00:00Z", cycle_hours: 18, cycle_date_key: "2026-10-20", cycle_opened_at: "2026-10-20T01:05:00Z" }))
      .toEqual({ number: 2, openedAt: "2026-10-20T01:05:00Z", startedAt: "2026-10-20T01:00:00Z", dateKey: "2026-10-20", hours: 18 });
  });
});
