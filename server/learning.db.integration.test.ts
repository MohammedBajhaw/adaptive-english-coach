import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { and, desc, eq } from "drizzle-orm";
import { dailyTasks, diagnosticAttempts, learnerProfiles, skillSnapshots, users, vocabularyCards } from "../drizzle/schema";
import { createScheduledReminder, ensureLearnerWorkspace, getDb, getLearnerNotifications, getLearningDashboard, getProgressReports, getScheduledReminder, rateVocabularyCard, submitConversationEvaluation, updateLearnerProfile } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const integrationDescribe = process.env.DATABASE_URL ? describe : describe.skip;
let createdUserIds: number[] = [];

function dateKeyFor(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function createWorkspace() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة لاختبار التكامل");
  const openId = `integration-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  await db.insert(users).values({ openId, name: "Integration Test User" });
  const user = (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0]!;
  createdUserIds.push(user.id);
  await ensureLearnerWorkspace(user.id);
  return { db, userId: user.id };
}

afterEach(async () => {
  const db = await getDb();
  if (!db || createdUserIds.length === 0) return;
  for (const id of createdUserIds) await db.delete(users).where(eq(users.id, id));
  createdUserIds = [];
});

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة بيانات اختبار التكامل");
});

integrationDescribe("learning database integration", () => {
  it("marks vocabulary complete and refreshes the dashboard after the final due card is rated", async () => {
    const { db, userId } = await createWorkspace();
    const before = await db.select().from(skillSnapshots).where(eq(skillSnapshots.userId, userId));
    const dueCards = await db.select().from(vocabularyCards).where(eq(vocabularyCards.userId, userId));
    expect(dueCards.length).toBeGreaterThan(0);
    for (const card of dueCards.slice(1)) {
      await db.update(vocabularyCards).set({ nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }).where(eq(vocabularyCards.id, card.id));
    }
    await rateVocabularyCard(userId, dueCards[0]!.id, "good");

    const task = (await db.select().from(dailyTasks).where(and(eq(dailyTasks.userId, userId), eq(dailyTasks.dateKey, dateKeyFor()), eq(dailyTasks.taskKey, "vocabulary"))).limit(1))[0];
    const dashboard = await getLearningDashboard(userId);
    const after = await db.select().from(skillSnapshots).where(eq(skillSnapshots.userId, userId));
    expect(task?.status).toBe("completed");
    expect(dashboard.tasks.find(item => item.taskKey === "vocabulary")?.status).toBe("completed");
    expect(after.length).toBeGreaterThan(before.length);
  }, 20_000);

  it("stores a speaking attempt, completes speaking, and exposes the result through the dashboard", async () => {
    const { db, userId } = await createWorkspace();
    const before = await db.select().from(skillSnapshots).where(eq(skillSnapshots.userId, userId));

    const evidenceScore = await submitConversationEvaluation(userId, { scoreOutOfTen: 8, prompt: "daily mechatronics conversation prompt" });

    const attempt = (await db.select().from(diagnosticAttempts).where(and(eq(diagnosticAttempts.userId, userId), eq(diagnosticAttempts.skill, "speaking"))).orderBy(desc(diagnosticAttempts.createdAt)).limit(1))[0];
    const task = (await db.select().from(dailyTasks).where(and(eq(dailyTasks.userId, userId), eq(dailyTasks.dateKey, dateKeyFor()), eq(dailyTasks.taskKey, "speaking"))).limit(1))[0];
    const dashboard = await getLearningDashboard(userId);
    const after = await db.select().from(skillSnapshots).where(eq(skillSnapshots.userId, userId));
    expect(evidenceScore).toBe(80);
    expect(attempt).toMatchObject({ score: 80, evidenceType: "ai-conversation-evaluation" });
    expect(task?.status).toBe("completed");
    expect(dashboard.tasks.find(item => item.taskKey === "speaking")?.status).toBe("completed");
    expect(after.length).toBeGreaterThan(before.length);
  }, 20_000);

  it("refreshes an all-pending daily plan when the learner selects a different study mode", async () => {
    const { db, userId } = await createWorkspace();
    await updateLearnerProfile(userId, { dailyMinutes: 45, studyMode: "intensive", engineeringSpecialty: "mechatronics", goalTrack: "job_interviews", vocabularyWeight: 25, grammarWeight: 20, listeningWeight: 15, speakingWeight: 25, writingWeight: 15 });
    const tasks = await db.select().from(dailyTasks).where(and(eq(dailyTasks.userId, userId), eq(dailyTasks.dateKey, dateKeyFor())));
    expect(tasks).toHaveLength(5);
    expect(tasks.map(task => task.skill).sort()).toEqual(["grammar", "listening", "speaking", "vocabulary", "writing"]);
    expect(tasks.find(task => task.skill === "speaking")?.minutes).toBe(13);
    expect(tasks.find(task => task.skill === "grammar")?.instructions).toContain("20 أسئلة");
  }, 20_000);

  it("aggregates weekly and monthly per-skill report metrics from real evidence, tasks, snapshots, and cards", async () => {
    const { userId } = await createWorkspace();
    await submitConversationEvaluation(userId, { scoreOutOfTen: 8, prompt: "weekly report evidence" });

    const report = await getProgressReports(userId);
    const weeklySpeaking = report.weekly.skills.find(item => item.skill === "speaking");
    const monthlySpeaking = report.monthly.skills.find(item => item.skill === "speaking");
    const weeklyVocabulary = report.weekly.skills.find(item => item.skill === "vocabulary");
    expect(weeklySpeaking).toMatchObject({ evidenceCount: 1, completedTasks: 1 });
    expect(monthlySpeaking).toMatchObject({ evidenceCount: 1, completedTasks: 1 });
    expect(weeklyVocabulary?.strongCards).toBe(0);
    expect(report.weekly.snapshotCount).toBeGreaterThan(0);
    expect(report.monthly.snapshotCount).toBeGreaterThan(0);
  }, 20_000);

  it("returns the database-calculated report through learning.reports for the authenticated user", async () => {
    const { userId } = await createWorkspace();
    await submitConversationEvaluation(userId, { scoreOutOfTen: 7, prompt: "router report evidence" });
    const caller = appRouter.createCaller({
      user: { id: userId, openId: `integration-open-${userId}`, email: null, name: "Integration Test User", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => undefined } as TrpcContext["res"],
    });
    const report = await caller.learning.reports();
    expect(report.weekly.skills.find(item => item.skill === "speaking")).toMatchObject({ evidenceCount: 1, completedTasks: 1 });
    expect(report.monthly.snapshotCount).toBeGreaterThan(0);
  }, 20_000);

  it("creates one in-app reminder from the scheduled task and prevents duplicate delivery on the same day", async () => {
    const { db, userId } = await createWorkspace();
    const taskUid = `reminder-test-${userId}`;
    await db.update(learnerProfiles).set({ reminderEnabled: 1, reminderScheduleTaskUid: taskUid, lastReminderDateKey: null }).where(eq(learnerProfiles.userId, userId));
    const scheduled = await getScheduledReminder(taskUid);
    expect(scheduled).not.toBeNull();
    const created = await createScheduledReminder(taskUid, scheduled!.dateKey, scheduled!.message);
    const notifications = await getLearnerNotifications(userId);
    const duplicate = await getScheduledReminder(taskUid);
    expect(created).toBe(true);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ kind: "daily-review", sourceDateKey: scheduled!.dateKey });
    expect(duplicate).toBeNull();
  }, 20_000);
});
