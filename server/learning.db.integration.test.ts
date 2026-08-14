import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { and, desc, eq } from "drizzle-orm";
import { dailyTasks, diagnosticAttempts, skillSnapshots, users, vocabularyCards } from "../drizzle/schema";
import { ensureLearnerWorkspace, getDb, getLearningDashboard, rateVocabularyCard, submitConversationEvaluation } from "./db";

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

    for (const card of dueCards) await rateVocabularyCard(userId, card.id, "good");

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
});
