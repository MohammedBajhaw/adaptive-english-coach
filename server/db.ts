import { and, desc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  cardReviews,
  dailyTasks,
  diagnosticAttempts,
  learnerProfiles,
  learnerNotifications,
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
  buildPeriodSkillMetrics,
  clampScore,
  completeVocabularyReviewWorkflow,
  isVocabularyReviewComplete,
  persistConversationEvaluationWorkflow,
  practicalBand,
  reviewSchedule,
  selectDailyConversationPlan,
  selectDailyListeningPlan,
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
    examples: [{ english: "This sensor provides reliable data.", arabic: "يوفر هذا المستشعر بيانات موثوقة." }, { english: "We need a reliable power supply.", arabic: "نحتاج إلى مصدر طاقة موثوق." }, { english: "The test results are reliable.", arabic: "نتائج الاختبار موثوقة." }, { english: "A reliable design reduces risk.", arabic: "التصميم الموثوق يقلل المخاطر." }, { english: "The team chose a reliable material.", arabic: "اختار الفريق مادة موثوقة." }],
  },
  {
    term: "conduct", arabicMeaning: "يجري أو ينفّذ، خاصة اختبارًا أو دراسة", partOfSpeech: "verb", ipa: "/kənˈdʌkt/", engineeringDomain: "testing",
    examples: [{ english: "We will conduct a safety test.", arabic: "سنجري اختبار سلامة." }, { english: "The engineers conducted an inspection.", arabic: "أجرى المهندسون فحصًا." }, { english: "Please conduct the experiment carefully.", arabic: "يرجى تنفيذ التجربة بعناية." }, { english: "They conduct routine maintenance every month.", arabic: "ينفذون صيانة دورية كل شهر." }, { english: "Our lab can conduct material analysis.", arabic: "يمكن لمختبرنا إجراء تحليل للمواد." }],
  },
  {
    term: "efficient", arabicMeaning: "فعّال ويحقق النتيجة بأقل وقت أو طاقة أو موارد", partOfSpeech: "adjective", ipa: "/ɪˈfɪʃ.ənt/", engineeringDomain: "operations",
    examples: [{ english: "This motor is more efficient.", arabic: "هذا المحرك أكثر كفاءة." }, { english: "We need an efficient workflow.", arabic: "نحتاج إلى سير عمل فعّال." }, { english: "The new system uses energy efficiently.", arabic: "يستخدم النظام الجديد الطاقة بكفاءة." }, { english: "Efficient planning saves time.", arabic: "التخطيط الفعّال يوفر الوقت." }, { english: "Her solution is simple and efficient.", arabic: "حلها بسيط وفعّال." }],
  },
  {
    term: "maintain", arabicMeaning: "يصون أو يحافظ على حالة جيدة", partOfSpeech: "verb", ipa: "/meɪnˈteɪn/", engineeringDomain: "maintenance",
    examples: [{ english: "Technicians maintain the equipment.", arabic: "يصون الفنيون المعدات." }, { english: "We must maintain the correct pressure.", arabic: "يجب أن نحافظ على الضغط الصحيح." }, { english: "The company maintains high standards.", arabic: "تحافظ الشركة على معايير عالية." }, { english: "This machine is easy to maintain.", arabic: "هذه الآلة سهلة الصيانة." }, { english: "They maintain a detailed service record.", arabic: "يحافظون على سجل خدمة مفصل." }],
  },
  {
    term: "constraint", arabicMeaning: "قيد أو عامل يحد من الخيارات المتاحة", partOfSpeech: "noun", ipa: "/kənˈstreɪnt/", engineeringDomain: "design",
    examples: [{ english: "Budget is a major design constraint.", arabic: "الميزانية قيد رئيسي في التصميم." }, { english: "Time constraints affected the project.", arabic: "أثرت قيود الوقت في المشروع." }, { english: "Safety is not a constraint we can ignore.", arabic: "السلامة ليست قيدًا يمكن تجاهله." }, { english: "The team listed each technical constraint.", arabic: "سرد الفريق كل قيد تقني." }, { english: "We found a solution within the constraints.", arabic: "وجدنا حلًا ضمن القيود." }],
  },
  { term: "calibrate", arabicMeaning: "يعاير جهازًا ليعطي قياسًا دقيقًا", partOfSpeech: "verb", ipa: "/ˈkæl.ɪ.breɪt/", engineeringDomain: "mechatronics", examples: [{ english: "We need to calibrate the sensor.", arabic: "نحتاج إلى معايرة المستشعر." }, { english: "The team calibrated the camera.", arabic: "عاير الفريق الكاميرا." }, { english: "Calibrate the device before testing.", arabic: "عاير الجهاز قبل الاختبار." }, { english: "The technician is calibrating the meter.", arabic: "الفني يعاير جهاز القياس." }, { english: "Regular calibration improves accuracy.", arabic: "المعايرة الدورية تحسن الدقة." }] },
  { term: "prototype", arabicMeaning: "نموذج أولي للاختبار قبل الإنتاج", partOfSpeech: "noun", ipa: "/ˈprəʊ.tə.taɪp/", engineeringDomain: "product development", examples: [{ english: "We built a prototype for the project.", arabic: "بنينا نموذجًا أوليًا للمشروع." }, { english: "The prototype needs more testing.", arabic: "يحتاج النموذج الأولي إلى مزيد من الاختبار." }, { english: "This prototype uses a small motor.", arabic: "يستخدم هذا النموذج الأولي محركًا صغيرًا." }, { english: "The client approved the prototype.", arabic: "وافق العميل على النموذج الأولي." }, { english: "A prototype helps us find problems early.", arabic: "يساعد النموذج الأولي في اكتشاف المشكلات مبكرًا." }] },
  { term: "troubleshoot", arabicMeaning: "يشخّص مشكلة ويعمل على حلها", partOfSpeech: "verb", ipa: "/ˈtrʌb.əl.ʃuːt/", engineeringDomain: "diagnostics", examples: [{ english: "We must troubleshoot the control system.", arabic: "يجب أن نشخص مشكلة نظام التحكم." }, { english: "She can troubleshoot electrical faults.", arabic: "يمكنها تشخيص الأعطال الكهربائية وحلها." }, { english: "Troubleshoot the signal before replacing the part.", arabic: "شخّص مشكلة الإشارة قبل استبدال القطعة." }, { english: "The manual helps technicians troubleshoot quickly.", arabic: "يساعد الدليل الفنيين على حل المشكلات سريعًا." }, { english: "They are troubleshooting a network error.", arabic: "هم يشخصون خطأ في الشبكة." }] },
  { term: "actuator", arabicMeaning: "مشغّل يحول إشارة التحكم إلى حركة", partOfSpeech: "noun", ipa: "/ˈæk.tʃu.eɪ.tər/", engineeringDomain: "mechatronics", examples: [{ english: "The actuator moves the robotic arm.", arabic: "يحرك المشغّل الذراع الروبوتية." }, { english: "This actuator needs a control signal.", arabic: "يحتاج هذا المشغّل إلى إشارة تحكم." }, { english: "We replaced the faulty actuator.", arabic: "استبدلنا المشغّل المعطل." }, { english: "The actuator responded slowly.", arabic: "استجاب المشغّل ببطء." }, { english: "Check the actuator before starting the machine.", arabic: "افحص المشغّل قبل تشغيل الآلة." }] },
  { term: "feedback", arabicMeaning: "تغذية راجعة أو إشارة تعود لضبط النظام", partOfSpeech: "noun", ipa: "/ˈfiːd.bæk/", engineeringDomain: "control systems", examples: [{ english: "The controller uses feedback from the sensor.", arabic: "تستخدم وحدة التحكم تغذية راجعة من المستشعر." }, { english: "Please give feedback on the design.", arabic: "يرجى تقديم تغذية راجعة عن التصميم." }, { english: "Negative feedback can stabilize a system.", arabic: "يمكن للتغذية الراجعة السالبة أن تثبت النظام." }, { english: "We received useful feedback from the client.", arabic: "تلقينا تغذية راجعة مفيدة من العميل." }, { english: "Feedback helps us improve the prototype.", arabic: "تساعدنا التغذية الراجعة في تحسين النموذج الأولي." }] },
];

function dateKeyFor(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function ensureCards(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, userId: number) {
  const existing = await db.select({ id: vocabularyCards.id, term: vocabularyCards.term }).from(vocabularyCards).where(eq(vocabularyCards.userId, userId));
  const now = new Date();
  const existingByTerm = new Map(existing.map(card => [card.term, card.id]));
  for (const card of starterCards) {
    const existingId = existingByTerm.get(card.term);
    if (existingId) await db.update(vocabularyCards).set({ examples: card.examples }).where(eq(vocabularyCards.id, existingId));
    else await db.insert(vocabularyCards).values({ ...card, userId, nextReviewAt: now });
  }
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
    dailyContent: {
      conversation: selectDailyConversationPlan(dateKey, profile.engineeringSpecialty, profile.goalTrack),
      listening: selectDailyListeningPlan(dateKey, snapshot.practicalBand),
    },
    stats: {
      totalCards: cards.length,
      strongCards: cards.filter(card => card.reviewStrength >= 3).length,
      completedToday: tasks.filter(task => task.status === "completed").length,
      totalToday: tasks.length,
    },
  };
}

export async function updateLearnerProfile(userId: number, input: Omit<Pick<LearnerProfile, "dailyMinutes" | "engineeringSpecialty" | "goalTrack" | "vocabularyWeight" | "grammarWeight" | "listeningWeight" | "speakingWeight" | "writingWeight">, "id">) {
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

export async function submitConversationEvaluation(userId: number, input: { scoreOutOfTen: number; prompt: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await ensureLearnerWorkspace(userId);
  const speakingTask = (await db.select({ id: dailyTasks.id }).from(dailyTasks)
    .where(and(eq(dailyTasks.userId, userId), eq(dailyTasks.dateKey, dateKeyFor()), eq(dailyTasks.taskKey, "speaking"))).limit(1))[0];
  return persistConversationEvaluationWorkflow({
    scoreOutOfTen: input.scoreOutOfTen,
    prompt: input.prompt,
    persistEvidence: async evidence => {
      await db.insert(diagnosticAttempts).values({ userId, skill: "speaking", evidenceType: "ai-conversation-evaluation", ...evidence });
    },
    markSpeakingTaskComplete: async () => {
      if (!speakingTask) return;
      await db.update(dailyTasks).set({ status: "completed", completedAt: new Date() }).where(eq(dailyTasks.id, speakingTask.id));
    },
    refreshCalibration: async () => { await recomputeSnapshot(userId); },
  });
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
  const remainingDueCards = await db.select({ id: vocabularyCards.id }).from(vocabularyCards)
    .where(and(eq(vocabularyCards.userId, userId), lte(vocabularyCards.nextReviewAt, new Date()))).limit(1);
  await completeVocabularyReviewWorkflow({
    remainingDueCardCount: remainingDueCards.length,
    markVocabularyTaskComplete: async () => {
      await db.update(dailyTasks).set({ status: "completed", completedAt: new Date() })
        .where(and(eq(dailyTasks.userId, userId), eq(dailyTasks.dateKey, dateKeyFor()), eq(dailyTasks.taskKey, "vocabulary")));
    },
    refreshCalibration: async () => { await recomputeSnapshot(userId); },
  });
  return schedule;
}

export async function getRecentActivity(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return db.select().from(skillSnapshots).where(and(eq(skillSnapshots.userId, userId), gte(skillSnapshots.createdAt, from))).orderBy(desc(skillSnapshots.createdAt));
}

export async function getProgressReports(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await ensureLearnerWorkspace(userId);
  const now = new Date();
  const weekFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [snapshots, attempts, tasks, cards] = await Promise.all([
    db.select().from(skillSnapshots).where(and(eq(skillSnapshots.userId, userId), gte(skillSnapshots.createdAt, monthFrom))).orderBy(skillSnapshots.createdAt),
    db.select().from(diagnosticAttempts).where(and(eq(diagnosticAttempts.userId, userId), gte(diagnosticAttempts.createdAt, monthFrom))),
    db.select().from(dailyTasks).where(and(eq(dailyTasks.userId, userId), eq(dailyTasks.status, "completed"), gte(dailyTasks.completedAt, monthFrom))),
    db.select().from(vocabularyCards).where(eq(vocabularyCards.userId, userId)),
  ]);
  const skills = ["vocabulary", "grammar", "listening", "speaking", "writing"] as const;
  function summarize(from: Date) {
    const inPeriodSnapshots = snapshots.filter(snapshot => snapshot.createdAt >= from);
    const inPeriodAttempts = attempts.filter(attempt => attempt.createdAt >= from);
    const inPeriodTasks = tasks.filter(task => task.completedAt && task.completedAt >= from);
    const scoreHistory = skills.reduce((result, skill) => {
      const column = `${skill}Score` as keyof typeof inPeriodSnapshots[number];
      result[skill] = inPeriodSnapshots.map(snapshot => Number(snapshot[column]));
      return result;
    }, {} as Record<SkillKey, number[]>);
    const evidenceCounts = skills.reduce((result, skill) => { result[skill] = inPeriodAttempts.filter(attempt => attempt.skill === skill).length; return result; }, {} as Record<SkillKey, number>);
    const completedTasks = skills.reduce((result, skill) => { result[skill] = inPeriodTasks.filter(task => task.skill === skill).length; return result; }, {} as Record<SkillKey, number>);
    return { from: from.getTime(), snapshotCount: inPeriodSnapshots.length, skills: buildPeriodSkillMetrics({ scoreHistory, evidenceCounts, completedTasks, strongCards: cards.filter(card => card.reviewStrength >= 3).length }) };
  }
  return { weekly: summarize(weekFrom), monthly: summarize(monthFrom) };
}

export async function updateReminderPreferences(userId: number, input: { enabled: boolean; hourUtc: number; taskUid?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const profile = await ensureLearnerWorkspace(userId);
  await db.update(learnerProfiles).set({ reminderEnabled: input.enabled ? 1 : 0, reminderHourUtc: input.hourUtc, ...(input.taskUid !== undefined ? { reminderScheduleTaskUid: input.taskUid } : {}) }).where(eq(learnerProfiles.id, profile.id));
  return (await db.select().from(learnerProfiles).where(eq(learnerProfiles.id, profile.id)).limit(1))[0]!;
}

export async function getReminderProfile(userId: number) {
  return ensureLearnerWorkspace(userId);
}

export async function getScheduledReminder(taskUid: string) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const profile = (await db.select().from(learnerProfiles).where(eq(learnerProfiles.reminderScheduleTaskUid, taskUid)).limit(1))[0];
  if (!profile) return null;
  const dateKey = dateKeyFor();
  const [dueCards, pendingTasks] = await Promise.all([
    db.select({ id: vocabularyCards.id }).from(vocabularyCards).where(and(eq(vocabularyCards.userId, profile.userId), lte(vocabularyCards.nextReviewAt, new Date()))),
    db.select({ id: dailyTasks.id }).from(dailyTasks).where(and(eq(dailyTasks.userId, profile.userId), eq(dailyTasks.dateKey, dateKey), eq(dailyTasks.status, "pending"))),
  ]);
  const { reminderMessage, shouldDispatchReminder } = await import("./reminder-engine");
  if (!shouldDispatchReminder({ enabled: Boolean(profile.reminderEnabled), lastReminderDateKey: profile.lastReminderDateKey, dateKey, dueCards: dueCards.length, pendingTasks: pendingTasks.length })) return null;
  return { dateKey, message: reminderMessage({ dueCards: dueCards.length, pendingTasks: pendingTasks.length }) };
}

export async function createScheduledReminder(taskUid: string, dateKey: string, message: { title: string; content: string }) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  const profile = (await db.select().from(learnerProfiles).where(eq(learnerProfiles.reminderScheduleTaskUid, taskUid)).limit(1))[0];
  if (!profile) return false;
  await db.insert(learnerNotifications).values({ userId: profile.userId, kind: "daily-review", sourceDateKey: dateKey, title: message.title, content: message.content }).onDuplicateKeyUpdate({ set: { title: message.title, content: message.content } });
  await db.update(learnerProfiles).set({ lastReminderDateKey: dateKey }).where(eq(learnerProfiles.id, profile.id));
  return true;
}

export async function getLearnerNotifications(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  return db.select().from(learnerNotifications).where(eq(learnerNotifications.userId, userId)).orderBy(desc(learnerNotifications.createdAt)).limit(8);
}

export async function markLearnerNotificationRead(userId: number, notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
  await db.update(learnerNotifications).set({ readAt: new Date() }).where(and(eq(learnerNotifications.id, notificationId), eq(learnerNotifications.userId, userId)));
}
