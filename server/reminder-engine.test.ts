import { describe, expect, it } from "vitest";
import { reminderCron, reminderMessage, shouldDispatchReminder } from "./reminder-engine";

describe("learning reminder schedule", () => {
  it("builds a valid six-field UTC cron expression", () => {
    expect(reminderCron(17)).toBe("0 0 17 * * *");
    expect(() => reminderCron(24)).toThrow("بين 0 و23");
  });

  it("dispatches once only when a learner has due work", () => {
    expect(shouldDispatchReminder({ enabled: true, lastReminderDateKey: null, dateKey: "2026-08-14", dueCards: 2, pendingTasks: 0 })).toBe(true);
    expect(shouldDispatchReminder({ enabled: true, lastReminderDateKey: "2026-08-14", dateKey: "2026-08-14", dueCards: 2, pendingTasks: 1 })).toBe(false);
    expect(shouldDispatchReminder({ enabled: false, lastReminderDateKey: null, dateKey: "2026-08-14", dueCards: 2, pendingTasks: 1 })).toBe(false);
    expect(reminderMessage({ dueCards: 1, pendingTasks: 2 }).content).toContain("1 بطاقة مستحقة");
  });
});
