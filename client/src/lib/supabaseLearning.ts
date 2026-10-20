import { getSupabase } from "@/lib/supabase";
import { DEFAULT_CYCLE_HOURS, currentDateKey, cycleFromProfile, cycleToProfile, getCycle, isStartInRange, legacyCycleNumber, setCycle, startNewCycle, type CycleState } from "@/lib/cycle";
import { getTodayContentIds } from "@/lib/localLessons";
import { cardRowFor, decorateCard, loadVocabularyBank, pickNewTerms } from "@/lib/vocabularyBank";
import { DEFAULT_REVIEW_HOURS, nextStrength, reviewDelayHours, type Rating } from "@/lib/vocabSession";


const taskTemplates = [
  { task_key: "vocabulary", skill: "vocabulary", title: "مراجعة مفردات هندسية", instructions: "استرجع البطاقات المستحقة وانطق كل كلمة في جملة.", minutes: 8 },
  { task_key: "grammar", skill: "grammar", title: "دقة القاعدة في السياق", instructions: "حل تدريبًا قصيرًا ثم اكتب جملتين.", minutes: 6 },
  { task_key: "listening", skill: "listening", title: "استماع مركز", instructions: "استمع لمقطع قصير وسجل الأفكار الأساسية.", minutes: 5 },
  { task_key: "speaking", skill: "speaking", title: "تدريب كلامي موجّه", instructions: "تحدث بصوت مسموع عن مشروعك أو مكوّن هندسي.", minutes: 6 },
  { task_key: "writing", skill: "writing", title: "كتابة مهنية قصيرة", instructions: "اكتب ثلاث جمل عن مهمة هندسية.", minutes: 5 },
];

const defaultSnapshot = {
  practicalBand: "قيد المعايرة · A2/B1", aggregateScore: 46, vocabularyScore: 39, grammarScore: 51,
  listeningScore: 43, speakingScore: 35, writingScore: 48, evidenceCount: 0,
  summary: "ابدأ بمهام قصيرة، وسيبني النظام تقديرك من إجاباتك وإنجازاتك الفعلية.",
};

export function getTodaySupabaseTaskSeed(taskKey: string) {
  const template = taskTemplates.find(task => task.task_key === taskKey);
  if (!template) throw new Error("مفتاح المهمة اليومية غير معروف.");
  const contentIds = getTodayContentIds();
  return {
    ...template,
    date_key: currentDateKey(),
    content_id: contentIds[taskKey as keyof typeof contentIds],
  };
}

export function pendingTaskIdsWithTodayEvidence(tasks: Array<{ id: string; skill: string; status: string }>, attempts: Array<{ skill: string }>) {
  const attemptedSkills = new Set(attempts.map(attempt => attempt.skill));
  return tasks.filter(task => task.status !== "completed" && attemptedSkills.has(task.skill)).map(task => task.id);
}

export type DashboardData = {
  profile: { dailyMinutes: number; studyMode: string; engineeringSpecialty: string; calibrationConfidence: number };
  snapshot: typeof defaultSnapshot;
  stats: { totalCards: number; strongCards: number; completedToday: number; totalToday: number };
  tasks: Array<{ id: string; skill: string; title: string; instructions: string; minutes: number; status: string }>;
  dueCards: Array<{ id: string; term: string; arabicMeaning: string; engineeringDomain: string; reviewStrength: number }>;
  skillProgress: Array<{ skill: string; completed: number; total: number; percentage: number }>;
  dailyReport: { completedSkillCount: number; gaps: Array<{ skill: string; title: string; message: string }> };
  notifications: Array<{ id: string; title: string; content: string; readAt: string | null }>;
};

function cycleError(error: { message?: string }) {
  return /cycle_|vocab_session_closed_at|wake_prompt/.test(error.message ?? "") ? new Error("شغّل ملف الهجرة 003_wake_cycle.sql في Supabase أولًا.") : error;
}

// Loads the wake cycle from the profile row. A learner from before the wake cycle keeps their place in the curriculum:
// the first cycle takes the old day number and starts now.
export async function ensureCycle(supabase: any, userId: string, profile: any): Promise<CycleState> {
  const saved = cycleFromProfile(profile);
  if (saved) { setCycle(saved); return saved; }
  const now = new Date();
  const oldDay = profile.created_at ? legacyCycleNumber(profile.created_at, now) : 1;
  const first = startNewCycle({ number: oldDay - 1, dateKey: null, hours: profile.cycle_hours ?? DEFAULT_CYCLE_HOURS }, now, now);
  const { error } = await supabase.from("learner_profiles").update(cycleToProfile(first)).eq("user_id", userId);
  if (error) throw cycleError(error);
  setCycle(first);
  return first;
}

async function loadOrCreateProfile(supabase: any, userId: string, displayName?: string | null) {
  const result = await supabase.from("learner_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (result.error) throw result.error;
  if (result.data) return result.data;
  const created = await supabase.from("learner_profiles").insert({ user_id: userId, display_name: displayName ?? "متعلم" }).select("*").single();
  if (created.error) throw created.error;
  return created.data;
}

// The single entry point that makes sure the learner has a profile and a loaded wake cycle
// (pages opened before the dashboard, and the word session, call this first).
export async function ensureLearnerCycle(userId: string, displayName?: string | null) {
  const supabase: any = getSupabase();
  return ensureCycle(supabase, userId, await loadOrCreateProfile(supabase, userId, displayName));
}

// "I woke up": a new cycle begins (the daily lesson advances, tasks and the vocabulary session start fresh).
export async function wakeUp(userId: string, startAt = new Date()) {
  const supabase: any = getSupabase();
  const { data, error } = await supabase.from("learner_profiles").select("cycle_number,cycle_date_key,cycle_hours").eq("user_id", userId).single();
  if (error) throw cycleError(error);
  const next = startNewCycle({ number: data.cycle_number ?? 0, dateKey: data.cycle_date_key ?? null, hours: data.cycle_hours ?? DEFAULT_CYCLE_HOURS }, startAt, new Date());
  const update = await supabase.from("learner_profiles").update({ ...cycleToProfile(next), wake_prompt_sent_at: null, vocab_session_closed_at: null, last_vocab_push_at: null, last_daily_push_date: null }).eq("user_id", userId);
  if (update.error) throw cycleError(update.error);
  setCycle(next);
  return next;
}

// Moves the current cycle's nominal start (for example to 04:00) without starting a new cycle.
export async function adjustCycleStart(userId: string, startAt: Date) {
  if (!isStartInRange(startAt, new Date())) throw new Error("اختر وقتًا بين 24 ساعة ماضية و12 ساعة قادمة.");
  const supabase: any = getSupabase();
  const update = await supabase.from("learner_profiles").update({ cycle_started_at: startAt.toISOString(), wake_prompt_sent_at: null }).eq("user_id", userId);
  if (update.error) throw cycleError(update.error);
  setCycle({ ...getCycle(), startedAt: startAt.toISOString() });
}

export async function updateCycleHours(userId: string, hours: number) {
  const supabase: any = getSupabase();
  const update = await supabase.from("learner_profiles").update({ cycle_hours: hours }).eq("user_id", userId);
  if (update.error) throw cycleError(update.error);
  setCycle({ ...getCycle(), hours });
}

export async function loadSupabaseDashboard(userId: string, displayName?: string | null): Promise<DashboardData> {
  const supabase: any = getSupabase();
  const profile = await loadOrCreateProfile(supabase, userId, displayName);
  // The wake cycle is the app's "day": make sure it exists and is loaded before tasks are built from it.
  const cycle = await ensureCycle(supabase, userId, profile);
  const dateKey = cycle.dateKey ?? currentDateKey();
  const tasksResult = await supabase.from("daily_tasks").select("*").eq("user_id", userId).eq("date_key", dateKey).order("created_at");
  if (tasksResult.error) throw tasksResult.error;
  let tasks: any[] = tasksResult.data ?? [];
  const contentIds = getTodayContentIds();
  if (!tasks.length) {
    const inserted = await supabase.from("daily_tasks").insert(taskTemplates.map(task => ({ user_id: userId, date_key: dateKey, ...task, content_id: contentIds[task.task_key as keyof typeof contentIds] }))).select("*");
    if (inserted.error) throw inserted.error;
    tasks = inserted.data ?? [];
  } else {
    await Promise.all(tasks.filter(task => !task.content_id).map(task => supabase.from("daily_tasks").update({ content_id: contentIds[task.task_key as keyof typeof contentIds] }).eq("id", task.id)));
    tasks = tasks.map(task => ({ ...task, content_id: task.content_id ?? contentIds[task.task_key as keyof typeof contentIds] }));
  }
  const introducedItems = tasks.filter(task => task.content_id).map(task => ({ user_id: userId, content_id: task.content_id, skill: task.skill, status: "introduced", last_seen_at: new Date().toISOString() }));
  if (introducedItems.length) {
    const progress = await supabase.from("learner_content_progress").upsert(introducedItems, { onConflict: "user_id,content_id", ignoreDuplicates: true });
    if (progress.error) throw progress.error;
  }
  const cycleStart = cycle.openedAt ?? cycle.startedAt ?? new Date().toISOString();
  const attemptsResult = await supabase.from("diagnostic_attempts").select("skill").eq("user_id", userId).gte("created_at", cycleStart);
  if (attemptsResult.error) throw attemptsResult.error;
  const recoveredTaskIds = pendingTaskIdsWithTodayEvidence(tasks, attemptsResult.data ?? []);
  if (recoveredTaskIds.length) {
    await Promise.all(recoveredTaskIds.map(taskId => setSupabaseTaskStatus(taskId, true)));
    tasks = tasks.map(task => recoveredTaskIds.includes(task.id) ? { ...task, status: "completed" } : task);
  }
  const [snapshotResult, cardsResult, notificationsResult] = await Promise.all([
    supabase.from("skill_snapshots").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("vocabulary_cards").select("*").eq("user_id", userId).not("content_id", "like", "vocabulary.%").lte("next_review_at", new Date().toISOString()).order("next_review_at").limit(3),
    supabase.from("learner_notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
  ]);
  if (snapshotResult.error) throw snapshotResult.error;
  if (cardsResult.error) throw cardsResult.error;
  if (notificationsResult.error) throw notificationsResult.error;
  const snapshot = snapshotResult.data ? {
    practicalBand: snapshotResult.data.practical_band, aggregateScore: snapshotResult.data.aggregate_score,
    vocabularyScore: snapshotResult.data.vocabulary_score, grammarScore: snapshotResult.data.grammar_score,
    listeningScore: snapshotResult.data.listening_score, speakingScore: snapshotResult.data.speaking_score,
    writingScore: snapshotResult.data.writing_score, evidenceCount: snapshotResult.data.evidence_count,
    summary: snapshotResult.data.summary,
  } : defaultSnapshot;
  const completed = tasks.filter(task => task.status === "completed").length;
  const skills = ["vocabulary", "grammar", "listening", "speaking", "writing"];
  const skillProgress = skills.map(skill => {
    const own = tasks.filter(task => task.skill === skill);
    const done = own.filter(task => task.status === "completed").length;
    return { skill, completed: done, total: own.length, percentage: own.length ? Math.round((done / own.length) * 100) : 0 };
  });
  const gaps = skillProgress.filter(item => item.percentage < 100).slice(0, 3).map(item => ({
    skill: item.skill,
    title: `مهمة ${item.skill === "speaking" ? "المحادثة" : item.skill === "vocabulary" ? "المفردات" : item.skill === "grammar" ? "القواعد" : item.skill === "listening" ? "الاستماع" : "الكتابة"} بانتظارك`,
    message: "أكمل نشاط اليوم لتبني سجلًا أدق لتقدمك الشخصي.",
  }));
  return {
    profile: { dailyMinutes: profile.daily_minutes, studyMode: profile.study_mode, engineeringSpecialty: profile.engineering_specialty, calibrationConfidence: profile.calibration_confidence },
    snapshot,
    stats: { totalCards: (cardsResult.data ?? []).length, strongCards: 0, completedToday: completed, totalToday: tasks.length },
    tasks: tasks.map(task => ({ id: task.id, skill: task.skill, title: task.title, instructions: task.instructions, minutes: task.minutes, status: task.status })),
    dueCards: (cardsResult.data ?? []).map((card: any) => ({ id: card.id, term: card.term, arabicMeaning: card.arabic_meaning, engineeringDomain: card.engineering_domain, reviewStrength: card.review_strength })),
    skillProgress,
    dailyReport: { completedSkillCount: skillProgress.filter(item => item.percentage === 100).length, gaps },
    notifications: (notificationsResult.data ?? []).map((item: any) => ({ id: item.id, title: item.title, content: item.content, readAt: item.read_at })),
  };
}

export async function setSupabaseTaskStatus(taskId: string, completed: boolean) {
  const supabase: any = getSupabase();
  const result = await supabase.from("daily_tasks").update({ status: completed ? "completed" : "pending", completed_at: completed ? new Date().toISOString() : null }).eq("id", taskId).select("user_id,content_id,skill").maybeSingle();
  if (result.error) throw result.error;
  if (!completed || !result.data?.content_id) return;
  const task = result.data;
  const existing = await supabase.from("learner_content_progress").select("completion_count").eq("user_id", task.user_id).eq("content_id", task.content_id).maybeSingle();
  if (existing.error) throw existing.error;
  const now = new Date().toISOString();
  const progress = await supabase.from("learner_content_progress").upsert({ user_id: task.user_id, content_id: task.content_id, skill: task.skill, status: "completed", last_seen_at: now, completed_at: now, completion_count: Number(existing.data?.completion_count ?? 0) + 1 }, { onConflict: "user_id,content_id" });
  if (progress.error) throw progress.error;
}

export async function completeSupabaseTaskByKey(userId: string, taskKey: string) {
  const supabase: any = getSupabase();
  const task = await supabase.from("daily_tasks").select("id").eq("user_id", userId).eq("task_key", taskKey).eq("date_key", currentDateKey()).maybeSingle();
  if (task.error) throw task.error;
  let taskId = task.data?.id;
  if (!taskId) {
    const seeded = await supabase.from("daily_tasks").upsert({ user_id: userId, ...getTodaySupabaseTaskSeed(taskKey) }, { onConflict: "user_id,date_key,task_key" }).select("id").single();
    if (seeded.error) throw seeded.error;
    taskId = seeded.data?.id;
  }
  if (!taskId) throw new Error("تعذر تجهيز مهمة اليوم.");
  await setSupabaseTaskStatus(taskId, true);
}

export async function markSupabaseNotificationRead(notificationId: string) {
  const result = await (getSupabase() as any).from("learner_notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId);
  if (result.error) throw result.error;
}

// Cards created from the previous word list are archived (hidden for good, never deleted) once the new list is in use.
const ARCHIVED_UNTIL = "2100-01-01T00:00:00.000Z";
let legacyArchived = false;

async function archiveLegacyCards(supabase: any, userId: string) {
  if (legacyArchived) return;
  const { error } = await supabase.from("vocabulary_cards").update({ next_review_at: ARCHIVED_UNTIL }).eq("user_id", userId).like("content_id", "vocabulary.%").lt("next_review_at", ARCHIVED_UNTIL);
  if (!error) legacyArchived = true;
}

// Everything the vocabulary session needs: all of the learner's cards (display text comes from the spreadsheet bank),
// the review interval, and whether the session was closed in the current cycle. The page derives the queue and the load from this.
export async function loadVocabSession(userId: string) {
  const supabase: any = getSupabase();
  const bank = await loadVocabularyBank();
  await archiveLegacyCards(supabase, userId);
  const [profile, cards] = await Promise.all([
    supabase.from("learner_profiles").select("vocab_reminder_every_hours,vocab_session_closed_at").eq("user_id", userId).maybeSingle(),
    supabase.from("vocabulary_cards").select("*").eq("user_id", userId).not("content_id", "like", "vocabulary.%"),
  ]);
  if (profile.error) throw cycleError(profile.error);
  if (cards.error) throw cards.error;
  const cycle = getCycle();
  const closedAt: string | null = profile.data?.vocab_session_closed_at ?? null;
  return {
    cards: (cards.data ?? []).map((row: any) => decorateCard(row, bank)) as any[],
    intervalHours: Number(profile.data?.vocab_reminder_every_hours ?? DEFAULT_REVIEW_HOURS),
    closed: Boolean(closedAt && cycle.openedAt && closedAt >= cycle.openedAt),
    totalWords: bank.terms.length,
  };
}

// Shows the next unseen word: it becomes a card the moment it is displayed, so an unrated word is still there next time.
export async function introduceNextWord(userId: string, existing: Array<{ content_id?: string | null }>) {
  const supabase: any = getSupabase();
  const bank = await loadVocabularyBank();
  const [term] = pickNewTerms(bank.terms, new Set(existing.map(card => card.content_id)), 1);
  if (!term) return null;
  const { data, error } = await supabase.from("vocabulary_cards").upsert({ user_id: userId, ...cardRowFor(term), next_review_at: new Date().toISOString() }, { onConflict: "user_id,content_id" }).select("*").single();
  if (error) throw error;
  return decorateCard(data, bank) as any;
}

// Saves a rating and returns the updated card. The first rating of a new word is its "intake" (it counts toward the load);
// not-easy words come back after the fixed interval, easy words after three weeks.
export async function rateSupabaseCard(userId: string, card: any, rating: Rating, intervalHours = DEFAULT_REVIEW_HOURS) {
  const now = new Date();
  const first = !card.review_count && !card.intake_at;
  const patch = {
    review_strength: nextStrength(rating, Number(card.review_strength ?? 0)),
    review_count: Number(card.review_count ?? 0) + 1,
    next_review_at: new Date(now.getTime() + reviewDelayHours(rating, intervalHours) * 3_600_000).toISOString(),
    last_rating: rating,
    last_reviewed_at: now.toISOString(),
    ...(first ? { intake_rating: rating, intake_at: now.toISOString() } : {}),
  };
  const supabase: any = getSupabase();
  const update = await supabase.from("vocabulary_cards").update(patch).eq("id", card.id);
  if (update.error) throw cycleError(update.error);
  const review = await supabase.from("card_reviews").insert({ user_id: userId, card_id: card.id, rating, strength_after: patch.review_strength });
  if (review.error) throw review.error;
  return { ...card, ...patch };
}

// "Enough for today": no more new words this cycle.
export async function closeVocabSession(userId: string) {
  const supabase: any = getSupabase();
  const update = await supabase.from("learner_profiles").update({ vocab_session_closed_at: new Date().toISOString() }).eq("user_id", userId);
  if (update.error) throw cycleError(update.error);
}
