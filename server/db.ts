import { and, desc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  cardReviews,
  dailyTasks,
  diagnosticAttempts,
  learnerProfiles,
  skillSnapshots,
  users,
  vocabularyCards,
  type LearnerProfile,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  aggregateScore,
  buildDailyTaskPlan,
  buildCalibrationGaps,
  clampScore,
  practicalBand,
  reviewSchedule,
  summarizeDailySkills,
  type CardRating,
  type SkillKey,
} from "./learning-engine";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: typeof users.$inferInsert): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: typeof users.$inferInsert = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field];
      updateSet[field] = user[field];
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

const starterCards = [
  {
    term: "reliable", arabicMeaning: "موثوق؛ يمكن الاعتماد عليه", partOfSpeech: "adjective", ipa: "/rɪˈlaɪ.ə.bəl/", engineeringDomain: "general engineering",
    examples: ["This sensor provides reliable data.", "We need a reliable power supply.", "The test results are reliable.", "A reliable design reduces risk.", "The team chose a reliable material."],
  },
  {
    term: "conduct", arabicMeaning: "يجري أو ينفّذ، خاصة اختبارًا أو دراسة", partOfSpeech: "verb", ipa: "/kənˈdʌkt/", engineeringDomain: "testing",
    examples: ["We will conduct a safety test.", "The engineers conducted an inspection.", "Please conduct the experiment carefully.", "They conduct routine maintenance every month.", "Our lab can conduct material analysis."],
  },
  {
    term: "efficient", arabicMeaning: "فعّال ويحقق النتيجة بأقل وقت أو طاقة أو موارد", partOfSpeech: "adjective", ipa: "/ɪˈfɪʃ.ənt/", engineeringDomain: "operations",
    examples: ["This motor is more efficient.", "We need an efficient workflow.", "The new system uses energy efficiently.", "Efficient planning saves time.", "Her solution is simple and efficient."],
  },
  {
    term: "maintain", arabicMeaning: "يصون أو يحافظ على حالة جيدة", partOfSpeech: "verb", ipa: "/meɪnˈteɪn/", engineeringDomain: "maintenance",
    examples: ["Technicians maintain the equipment.", "We must maintain the correct pressure.", "The company maintains high standards.", "This machine is easy to maintain.", "They maintain a detailed service record."],
  },
  {
    term: "constraint", arabicMeaning: "قيد أو عامل يحد من الخيارات المتاحة", partOfSpeech: "noun", ipa: "/kənˈstreɪnt/", engineeringDomain: "design",
    examples: ["Budget is a major design constraint.", "Time constraints affected the project.", "Safety is not a constraint we can ignore.", "The team listed each technical constraint.", "We found a solution within the constraints."],
  },
];

function dateKeyFor(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function ensureCards(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number) {
  const existing = await db.select({ id: vocabularyCards.id }).from(vocabularyCards).where(eq(vocabularyCards.userId, userId)).limit(1);
  if (existing.length) return;
  const now = new Date();
  await db.insert(vocabularyCards).values(starterCards.map(card => ({ ...card, userId, nextReviewAt: now })));
}

async function ensureTasks(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number, profile: LearnerProfile, dateKey: string) {
  const existing = await db.select({ id: dailyTasks.id }).from(dailyTasks).where(and(eq(dailyTasks.userId, userId), eq(dailyTasks.dateKey, dateKey))).limit(1);
  if (existing.length) return;
  const tasks = buildDailyTaskPlan(profile.dailyMinutes, {
    vocabulary: profile.vocabularyWeight,
    grammar: profile.grammarWeight,
    listening: profile.listeningWeight,
    speaking: profile.speakingWeight,
    writing: profile.writingWeight,
  });
  await db.insert(dailyTasks).values(tasks.map(task => ({ ...task, userId, dateKey })));
}

export async function ensureLearnerWorkspace(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  let profile = (await db.select().from(learnerProfiles).where(eq(learnerProfiles.userId, userId)).limit(1))[0];
  if (!profile) {
    await db.insert(learnerProfiles).values({ userId });
    profile = (await db.select().from(learnerProfiles).where(eq(learnerProfiles.userId, userId)).limit(1))[0]!;
  }
  await ensureCards(db, userId);
  await ensureTasks(db, userId, profile, dateKeyFor());
  return profile;
}

export async function recomputeSnapshot(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await ensureLearnerWorkspace(userId);
  const attempts = await db.select().from(diagnosticAttempts).where(eq(diagnosticAttempts.userId, userId)).orderBy(desc(diagnosticAttempts.createdAt));
  const completed = await db.select().from(dailyTasks).where(and(eq(dailyTasks.userId, userId), eq(dailyTasks.status, "completed")));
  const skills = ["vocabulary", "grammar", "listening", "speaking", "writing"] as const;
  const scores = {} as Record<SkillKey, number>;
  for (const skill of skills) {
    const evidence = attempts.filter(item => item.skill === skill).slice(0, 6);
    const average = evidence.length ? evidence.reduce((sum, item) => sum + item.score, 0) / evidence.length : 42;
    const activityBonus = Math.min(10, completed.filter(item => item.skill === skill).length * 2);
    scores[skill] = clampScore(average + activityBonus);
  }
  const aggregate = aggregateScore(scores);
  const evidenceCount = attempts.length + completed.length;
  const band = practicalBand(aggregate, evidenceCount);
  const snapshot = {
    userId,
    dateKey: dateKeyFor(),
    vocabularyScore: scores.vocabulary,
    grammarScore: scores.grammar,
    listeningScore: scores.listening,
    speakingScore: scores.speaking,
    writingScore: scores.writing,
    aggregateScore: aggregate,
    practicalBand: band,
    evidenceCount,
    summary: evidenceCount < 5 ? "نجمع أدلة قصيرة من إجاباتك ومهامك؛ لا تثبّت المستوى الآن." : "المستوى العملي يتغير وفق الأداء الحديث، لا وفق اختبار واحد.",
  };
  await db.insert(skillSnapshots).values(snapshot);
  const profile = (await db.select().from(learnerProfiles).where(eq(learnerProfiles.userId, userId)).limit(1))[0];
  if (profile) await db.update(learnerProfiles).set({ calibrationConfidence: Math.min(95, 15 + evidenceCount * 8) }).where(eq(learnerProfiles.id, profile.id));
  return snapshot;
}

export async function getLearningDashboard(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const profile = await ensureLearnerWorkspace(userId);
  const dateKey = dateKeyFor();
  const tasks = await db.select().from(dailyTasks).where(and(eq(dailyTasks.userId, userId), eq(dailyTasks.dateKey, dateKey)));
  const dueCards = await db.select().from(vocabularyCards).where(and(eq(vocabularyCards.userId, userId), lte(vocabularyCards.nextReviewAt, new Date()))).orderBy(vocabularyCards.nextReviewAt).limit(4);
  const snapshots = await db.select().from(skillSnapshots).where(eq(skillSnapshots.userId, userId)).orderBy(desc(skillSnapshots.createdAt)).limit(1);
  const snapshot = snapshots[0] ?? await recomputeSnapshot(userId);
  const cards = await db.select().from(vocabularyCards).where(eq(vocabularyCards.userId, userId));
  const attempts = await db.select().from(diagnosticAttempts).where(eq(diagnosticAttempts.userId, userId));
  const skillProgress = summarizeDailySkills(tasks.map(task => ({ skill: task.skill, status: task.status })));
  const scores: Record<SkillKey, number> = {
    vocabulary: snapshot.vocabularyScore,
    grammar: snapshot.grammarScore,
    listening: snapshot.listeningScore,
    speaking: snapshot.speakingScore,
    writing: snapshot.writingScore,
  };
  const evidenceCounts = (Object.keys(scores) as SkillKey[]).reduce((result, skill) => {
    result[skill] = attempts.filter(attempt => attempt.skill === skill).length + tasks.filter(task => task.skill === skill && task.status === "completed").length;
    return result;
  }, {} as Record<SkillKey, number>);
  const dailyReport = {
    completedSkillCount: skillProgress.filter(item => item.percentage === 100).length,
    gaps: buildCalibrationGaps({ scores, evidenceCounts, skillProgress, weakDueCards: dueCards.filter(card => card.reviewStrength < 2).length }),
  };
  return {
    profile,
    tasks,
    dueCards,
    snapshot,
    skillProgress,
    dailyReport,
    stats: {
      totalCards: cards.length,
      strongCards: cards.filter(card => card.reviewStrength >= 3).length,
      completedToday: tasks.filter(task => task.status === "completed").length,
      totalToday: tasks.length,
    },
  };
}

export async function updateLearnerProfile(userId: number, input: Omit<Pick<LearnerProfile, "dailyMinutes" | "engineeringSpecialty" | "vocabularyWeight" | "grammarWeight" | "listeningWeight" | "speakingWeight" | "writingWeight">, "id">) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const profile = await ensureLearnerWorkspace(userId);
  await db.update(learnerProfiles).set(input).where(eq(learnerProfiles.id, profile.id));
  const updated = (await db.select().from(learnerProfiles).where(eq(learnerProfiles.id, profile.id)).limit(1))[0]!;
  return updated;
}

export async function submitDiagnosticAttempt(userId: number, input: { skill: SkillKey; evidenceType: string; prompt: string; response: string; score: number }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await ensureLearnerWorkspace(userId);
  await db.insert(diagnosticAttempts).values({ ...input, userId, score: clampScore(input.score) });
  return recomputeSnapshot(userId);
}

export async function completeDailyTask(userId: number, taskId: number, completed: boolean) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const task = (await db.select().from(dailyTasks).where(and(eq(dailyTasks.id, taskId), eq(dailyTasks.userId, userId))).limit(1))[0];
  if (!task) throw new Error("المهمة غير موجودة");
  await db.update(dailyTasks).set({ status: completed ? "completed" : "pending", completedAt: completed ? new Date() : null }).where(eq(dailyTasks.id, taskId));
  await recomputeSnapshot(userId);
}

export async function getDueCards(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await ensureLearnerWorkspace(userId);
  return db.select().from(vocabularyCards).where(and(eq(vocabularyCards.userId, userId), lte(vocabularyCards.nextReviewAt, new Date()))).orderBy(vocabularyCards.nextReviewAt).limit(20);
}

export async function rateVocabularyCard(userId: number, cardId: number, rating: CardRating) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const card = (await db.select().from(vocabularyCards).where(and(eq(vocabularyCards.id, cardId), eq(vocabularyCards.userId, userId))).limit(1))[0];
  if (!card) throw new Error("البطاقة غير موجودة");
  const schedule = reviewSchedule(rating, card.reviewStrength);
  await db.update(vocabularyCards).set({ reviewStrength: schedule.nextStrength, reviewCount: card.reviewCount + 1, nextReviewAt: schedule.nextReviewAt }).where(eq(vocabularyCards.id, card.id));
  await db.insert(cardReviews).values({ userId, cardId, rating, strengthAfter: schedule.nextStrength });
  return schedule;
}

export async function getRecentActivity(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return db.select().from(skillSnapshots).where(and(eq(skillSnapshots.userId, userId), gte(skillSnapshots.createdAt, from))).orderBy(desc(skillSnapshots.createdAt));
}
