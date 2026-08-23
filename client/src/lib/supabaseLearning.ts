import { getSupabase } from "@/lib/supabase";
import { getTodayContentIds } from "@/lib/localLessons";

const todayKey = () => new Date().toISOString().slice(0, 10);

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

export async function loadSupabaseDashboard(userId: string, displayName?: string | null): Promise<DashboardData> {
  const supabase: any = getSupabase();
  const dateKey = todayKey();
  const profileResult = await supabase.from("learner_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (profileResult.error) throw profileResult.error;
  let profile: any = profileResult.data;
  if (!profile) {
    const created = await supabase.from("learner_profiles").insert({ user_id: userId, display_name: displayName ?? "متعلم" }).select("*").single();
    if (created.error) throw created.error;
    profile = created.data;
  }
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
  const [snapshotResult, cardsResult, notificationsResult] = await Promise.all([
    supabase.from("skill_snapshots").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("vocabulary_cards").select("*").eq("user_id", userId).lte("next_review_at", new Date().toISOString()).order("next_review_at").limit(3),
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
  const task = await supabase.from("daily_tasks").select("id").eq("user_id", userId).eq("task_key", taskKey).eq("date_key", todayKey()).maybeSingle();
  if (task.error) throw task.error;
  if (!task.data?.id) throw new Error("لم تُنشأ مهمة اليوم بعد. افتح لوحة اليوم أولًا.");
  await setSupabaseTaskStatus(task.data.id, true);
}

export async function markSupabaseNotificationRead(notificationId: string) {
  const result = await (getSupabase() as any).from("learner_notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId);
  if (result.error) throw result.error;
}

const starterCard = {
  term: "reliable", arabic_meaning: "موثوق؛ يمكن الاعتماد عليه", part_of_speech: "adjective", ipa: "/rɪˈlaɪ.ə.bəl/", engineering_domain: "general engineering",
  examples: [{ english: "This sensor provides reliable data.", arabic: "يوفر هذا المستشعر بيانات موثوقة." }, { english: "We need a reliable power supply.", arabic: "نحتاج إلى مصدر طاقة موثوق." }, { english: "The test results are reliable.", arabic: "نتائج الاختبار موثوقة." }, { english: "A reliable design reduces risk.", arabic: "التصميم الموثوق يقلل المخاطر." }, { english: "The team chose a reliable material.", arabic: "اختار الفريق مادة موثوقة." }],
};

export async function loadSupabaseDueCards(userId: string) {
  const supabase: any = getSupabase();
  const existing = await supabase.from("vocabulary_cards").select("*").eq("user_id", userId).limit(1);
  if (existing.error) throw existing.error;
  if (!(existing.data ?? []).length) {
    const seeded = await supabase.from("vocabulary_cards").insert({ user_id: userId, content_id: "vocabulary.starter.reliable", ...starterCard, next_review_at: new Date().toISOString() });
    if (seeded.error) throw seeded.error;
  }
  const result = await supabase.from("vocabulary_cards").select("*").eq("user_id", userId).lte("next_review_at", new Date().toISOString()).order("next_review_at");
  if (result.error) throw result.error;
  return result.data ?? [];
}

export async function rateSupabaseCard(userId: string, card: any, rating: "again" | "hard" | "good" | "easy") {
  const hours = { again: 4, hard: 24, good: 72, easy: 168 }[rating];
  const strengthDelta = { again: 0, hard: 1, good: 2, easy: 3 }[rating];
  const strengthAfter = Math.max(0, Number(card.review_strength ?? 0) + strengthDelta);
  const nextReviewAt = new Date(Date.now() + hours * 3_600_000).toISOString();
  const supabase: any = getSupabase();
  const update = await supabase.from("vocabulary_cards").update({ review_strength: strengthAfter, review_count: Number(card.review_count ?? 0) + 1, next_review_at: nextReviewAt }).eq("id", card.id);
  if (update.error) throw update.error;
  const review = await supabase.from("card_reviews").insert({ user_id: userId, card_id: card.id, rating, strength_after: strengthAfter });
  if (review.error) throw review.error;
}
