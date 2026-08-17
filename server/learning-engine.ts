export type SkillKey = "vocabulary" | "grammar" | "listening" | "speaking" | "writing";
export type CardRating = "again" | "hard" | "good" | "easy";
export type GoalTrack = "job_interviews" | "daily_work" | "general_communication";

export const goalTrackLabels: Record<GoalTrack, string> = {
  job_interviews: "مقابلات العمل",
  daily_work: "العمل الهندسي اليومي",
  general_communication: "التواصل العام",
};

export const skillLabels: Record<SkillKey, string> = {
  vocabulary: "المفردات",
  grammar: "القواعد",
  listening: "الاستماع",
  speaking: "المحادثة",
  writing: "الكتابة",
};

export const skillTaskContent: Record<SkillKey, { title: string; instructions: string }> = {
  vocabulary: {
    title: "مراجعة مفردات هندسية",
    instructions: "استرجع البطاقات المستحقة، انطق كل كلمة في جملة، ثم قيّم قوة التذكر بصدق.",
  },
  grammar: {
    title: "دقة القاعدة في السياق",
    instructions: "حل تدريبًا قصيرًا في قاعدة واحدة، ثم اكتب جملتين عن مشروع هندسي باستخدامها.",
  },
  listening: {
    title: "استماع مركز",
    instructions: "استمع لمقطع قصير مناسب لمستواك، وسجل ثلاث أفكار أو كلمات التقطتها.",
  },
  speaking: {
    title: "تدريب كلامي موجّه",
    instructions: "تحدث بصوت مسموع عن موقف هندسي لمدة محددة؛ لا توقف نفسك لتصحيح كل خطأ.",
  },
  writing: {
    title: "كتابة مهنية قصيرة",
    instructions: "اكتب فقرة أو رسالة مهنية قصيرة، ثم راجع وضوح الفكرة واستخدام الكلمات المستهدفة.",
  },
};

type TaskIntensity = "quick" | "core" | "deep";

const taskIntensityText: Record<TaskIntensity, { label: string; suffix: string; minimum: number; multiplier: number }> = {
  quick: { label: "لمسة سريعة", suffix: "أنجز خطوة واحدة مركزة ولا تنتقل قبل إنهائها.", minimum: 3, multiplier: 0.8 },
  core: { label: "جلسة أساسية", suffix: "أنجز النشاط الرئيسي وسجل دليلًا قصيرًا على المحاولة.", minimum: 4, multiplier: 1 },
  deep: { label: "جلسة معمقة", suffix: "أضف تطبيقًا ثانيًا أو إنتاجًا أطول؛ هذه المهارة أخذت أولوية أعلى اليوم.", minimum: 10, multiplier: 1.45 },
};

const skillPriority: SkillKey[] = ["speaking", "vocabulary", "grammar", "listening", "writing"];

function rankedSkills(weights: Record<SkillKey, number>) {
  return (Object.keys(weights) as SkillKey[]).sort((left, right) => {
    const difference = weights[right] - weights[left];
    return difference || skillPriority.indexOf(left) - skillPriority.indexOf(right);
  });
}

export function describeDailyPlan(dailyMinutes: number) {
  const safeMinutes = Math.min(Math.max(Math.round(dailyMinutes), 10), 180);
  if (safeMinutes <= 14) return { mode: "quick", label: "حد أدنى ذكي", taskCount: 2, explanation: "مراجعة مفردات قصيرة مع مهارة واحدة ذات أولوية؛ الهدف الاستمرار لا إنهاء كل شيء." };
  if (safeMinutes <= 24) return { mode: "light", label: "جلسة خفيفة", taskCount: 3, explanation: "مفردات ومهارتان بالأولوية؛ تبقى المهمة قصيرة لكن فيها إنتاج فعلي." };
  if (safeMinutes <= 44) return { mode: "focused", label: "جلسة مركزة", taskCount: 4, explanation: "أربع مهام مختارة بحسب الأوزان، مع قاعدة أو مهارة تحتاج دعمًا." };
  if (safeMinutes <= 69) return { mode: "balanced", label: "جلسة متوازنة", taskCount: 5, explanation: "مهمة أساسية لكل مهارة، وتزيد الدقائق داخل المهارة ذات الوزن الأعلى." };
  return { mode: "deep", label: "جلسة موسعة", taskCount: 6, explanation: "كل المهارات الأساسية مع مهمة إضافية معمقة للمهارة الأعلى وزنًا." };
}

export function buildDailyTaskPlan(dailyMinutes: number, weights: Record<SkillKey, number>) {
  const safeMinutes = Math.min(Math.max(Math.round(dailyMinutes), 10), 180);
  const summary = describeDailyPlan(safeMinutes);
  const ranked = rankedSkills(weights);
  const nonVocabulary = ranked.filter(skill => skill !== "vocabulary");
  const slots: Array<{ skill: SkillKey; intensity: TaskIntensity }> = safeMinutes <= 14
    ? [{ skill: "vocabulary", intensity: "quick" }, { skill: nonVocabulary[0]!, intensity: "quick" }]
    : safeMinutes <= 24
      ? [{ skill: "vocabulary", intensity: "quick" }, ...nonVocabulary.slice(0, 2).map(skill => ({ skill, intensity: "quick" as const }))]
      : safeMinutes <= 44
        ? [{ skill: "vocabulary", intensity: "core" }, { skill: "grammar", intensity: "core" }, ...ranked.filter(skill => skill !== "vocabulary" && skill !== "grammar").slice(0, 2).map(skill => ({ skill, intensity: "core" as const }))]
        : safeMinutes <= 69
          ? (Object.keys(weights) as SkillKey[]).map(skill => ({ skill, intensity: "core" as const }))
          : [...(Object.keys(weights) as SkillKey[]).map(skill => ({ skill, intensity: "core" as const })), { skill: ranked[0]!, intensity: "deep" }];
  const minimumTotal = slots.reduce((sum, slot) => sum + taskIntensityText[slot.intensity].minimum, 0);
  const remaining = Math.max(0, safeMinutes - minimumTotal);
  const weightedTotal = slots.reduce((sum, slot) => sum + Math.max(weights[slot.skill], 1) * taskIntensityText[slot.intensity].multiplier, 0);
  let assigned = 0;

  return slots.map((slot, index) => {
    const weighted = Math.max(weights[slot.skill], 1) * taskIntensityText[slot.intensity].multiplier;
    const extra = index === slots.length - 1 ? remaining - assigned : Math.round((remaining * weighted) / weightedTotal);
    assigned += extra;
    const base = skillTaskContent[slot.skill];
    const duplicate = slots.slice(0, index).some(previous => previous.skill === slot.skill);
    return {
      taskKey: duplicate ? `${slot.skill}-${slot.intensity}` : slot.skill,
      skill: slot.skill,
      minutes: taskIntensityText[slot.intensity].minimum + extra,
      title: `${base.title} · ${taskIntensityText[slot.intensity].label}`,
      instructions: `${base.instructions} ${taskIntensityText[slot.intensity].suffix}`,
    };
  });
}

export function reviewSchedule(rating: CardRating, currentStrength: number, now = new Date()) {
  const strengthChange: Record<CardRating, number> = { again: -1, hard: 0, good: 1, easy: 2 };
  const nextStrength = Math.max(0, Math.min(5, currentStrength + strengthChange[rating]));
  const hoursByRating: Record<CardRating, number> = {
    again: 4,
    hard: 12,
    good: currentStrength >= 2 ? 72 : 24,
    easy: currentStrength >= 3 ? 168 : 72,
  };
  return {
    nextStrength,
    nextReviewAt: new Date(now.getTime() + hoursByRating[rating] * 60 * 60 * 1000),
  };
}

export function practicalBand(score: number, evidenceCount: number) {
  if (evidenceCount < 5) return "قيد المعايرة · A2/B1";
  if (score < 38) return "A2 · أساس عملي";
  if (score < 52) return "A2+ · انتقال";
  if (score < 68) return "B1 · مستقل";
  if (score < 82) return "B1+ · واثق";
  return "B2 · مهني";
}

export function aggregateScore(scores: Record<SkillKey, number>) {
  return Math.round(Object.values(scores).reduce((sum, score) => sum + score, 0) / 5);
}

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

type TaskStatus = { skill: SkillKey; status: "pending" | "completed" };

export function summarizeDailySkills(tasks: TaskStatus[]) {
  return (Object.keys(skillLabels) as SkillKey[]).map(skill => {
    const skillTasks = tasks.filter(task => task.skill === skill);
    const completed = skillTasks.filter(task => task.status === "completed").length;
    return {
      skill,
      completed,
      total: skillTasks.length,
      percentage: skillTasks.length ? Math.round((completed / skillTasks.length) * 100) : 0,
    };
  });
}

export function buildCalibrationGaps(input: {
  scores: Record<SkillKey, number>;
  evidenceCounts: Record<SkillKey, number>;
  skillProgress: ReturnType<typeof summarizeDailySkills>;
  weakDueCards: number;
}) {
  const gaps: Array<{ skill: SkillKey; title: string; message: string }> = [];
  const leastSupported = (Object.keys(input.evidenceCounts) as SkillKey[])
    .filter(skill => input.evidenceCounts[skill] < 1)
    .sort((a, b) => input.scores[a] - input.scores[b])[0];
  if (leastSupported) {
    gaps.push({ skill: leastSupported, title: `أضف دليلًا في ${skillLabels[leastSupported]}`, message: `لا توجد إجابة أو عينة مباشرة كافية لهذه المهارة بعد؛ أكمل مهمتها أو أضفها من صفحة المعايرة.` });
  }
  const unfinished = input.skillProgress.find(item => item.total > 0 && item.percentage < 100 && !gaps.some(gap => gap.skill === item.skill));
  if (unfinished) {
    gaps.push({ skill: unfinished.skill, title: `مهمة ${skillLabels[unfinished.skill]} بانتظارك`, message: `إنجاز اليوم في هذه المهارة ${unfinished.percentage}%؛ إكمال المهمة يجعل صورة مستواك اليوم أكثر دقة.` });
  }
  if (input.weakDueCards > 0 && !gaps.some(gap => gap.skill === "vocabulary")) {
    gaps.push({ skill: "vocabulary", title: "بطاقات تحتاج تثبيتًا", message: `${input.weakDueCards} بطاقة مستحقة ضعيفة أو جديدة؛ قيّم الاسترجاع لتحديد موعد المراجعة التالي.` });
  }
  return gaps.slice(0, 3);
}

export function isVocabularyReviewComplete(dueCardCount: number) {
  return dueCardCount === 0;
}

export function conversationScoreToEvidence(scoreOutOfTen: number) {
  return clampScore(scoreOutOfTen * 10);
}

export function selectListeningTrack(practicalBand: string) {
  return practicalBand.includes("A2") ? "guided-workplace" : "workplace-b1";
}

function dayIndex(dateKey: string, length: number) {
  const numericDate = Number(dateKey.replace(/\D/g, ""));
  return Number.isFinite(numericDate) ? numericDate % length : 0;
}

function specialtyName(specialty: string) {
  const names: Record<string, string> = {
    mechatronics: "Mechatronics Engineering",
    mechanical: "Mechanical Engineering",
    electrical: "Electrical Engineering",
    civil: "Civil Engineering",
    industrial: "Industrial Engineering",
    software: "Software Engineering",
    chemical: "Chemical Engineering",
    general: "Engineering",
  };
  return names[specialty] ?? names.general;
}

const wordTranslations: Record<string, string> = {
  sensor: "مستشعر", actuator: "مشغّل", "control system": "نظام تحكم", reliable: "موثوق", "test results": "نتائج الاختبار",
  troubleshoot: "يشخّص ويحل المشكلة", fault: "عطل", calibrate: "يعاير", signal: "إشارة", "root cause": "السبب الجذري",
  initiative: "مبادرة", adapt: "يتأقلم", collaborate: "يتعاون", improve: "يحسّن", responsibility: "مسؤولية",
  deadline: "موعد نهائي", prototype: "نموذج أولي", coordinate: "ينسّق", risk: "مخاطرة", handover: "تسليم المهمة",
  status: "الحالة", verify: "يتحقق", component: "مكوّن", "next step": "الخطوة التالية", suggest: "يقترح",
  benefit: "فائدة", constraint: "قيد", feasible: "قابل للتنفيذ", feedback: "تغذية راجعة", background: "خلفية",
  "interested in": "مهتم بـ", develop: "يطوّر", experience: "خبرة", goal: "هدف", step: "خطوة",
  process: "عملية", connect: "يربط", measure: "يقيس", result: "نتيجة", clarify: "يوضّح",
  confirm: "يؤكد", mean: "يعني", "could you": "هل يمكنك", understand: "يفهم",
};

const interviewThemes = [
  { id: "project-interview", title: "مقابلة عن مشروع التخرج", topic: "your graduation project, its goal, and your contribution", topicArabic: "مشروع تخرجك، هدفه، ومساهمتك فيه", words: ["sensor", "actuator", "control system", "reliable", "test results"] },
  { id: "technical-interview", title: "مقابلة عن حل مشكلة تقنية", topic: "a technical fault, how you diagnosed it, and the next test", topicArabic: "عطل تقني، كيف شخصته، وما الاختبار التالي", words: ["troubleshoot", "fault", "calibrate", "signal", "root cause"] },
  { id: "strengths-interview", title: "نقاط قوة مهنية", topic: "your strengths, a challenge, and how you learned from it", topicArabic: "نقاط قوتك، تحدٍ واجهته، وما تعلمته منه", words: ["initiative", "adapt", "collaborate", "improve", "responsibility"] },
] as const;

const dailyWorkThemes = [
  { id: "team-update", title: "تحديث لفريق العمل", topic: "a short project update, a delay, and a practical solution", topicArabic: "تحديث قصير عن مشروع وتأخير وحل عملي", words: ["deadline", "prototype", "coordinate", "risk", "improve"] },
  { id: "handover", title: "تسليم مهمة تقنية", topic: "handing over a technical task and explaining its current status", topicArabic: "تسليم مهمة تقنية وشرح حالتها الحالية", words: ["handover", "status", "verify", "component", "next step"] },
  { id: "meeting-idea", title: "فكرة في اجتماع", topic: "suggesting an improvement in a team meeting", topicArabic: "اقتراح تحسين في اجتماع فريق", words: ["suggest", "benefit", "constraint", "feasible", "feedback"] },
] as const;

const generalCommunicationThemes = [
  { id: "professional-introduction", title: "تقديم مهني مختصر", topic: "introducing yourself, your field, and what you enjoy learning", topicArabic: "تقديم نفسك وتخصصك وما تحب تعلمه", words: ["background", "interested in", "develop", "experience", "goal"] },
  { id: "explaining-process", title: "شرح عملية بسيطة", topic: "explaining a simple technical process to a non-specialist", topicArabic: "شرح عملية تقنية بسيطة لغير المتخصص", words: ["step", "process", "connect", "measure", "result"] },
  { id: "asking-clarification", title: "طلب توضيح باحتراف", topic: "asking for clarification and responding politely in a work conversation", topicArabic: "طلب توضيح والرد بلطف في محادثة عمل", words: ["clarify", "confirm", "mean", "could you", "understand"] },
] as const;

type ConversationTheme = {
  id: string;
  title: string;
  topic: string;
  topicArabic: string;
  words: readonly string[];
};

const themeSets: Record<GoalTrack, readonly ConversationTheme[]> = {
  job_interviews: interviewThemes,
  daily_work: dailyWorkThemes,
  general_communication: generalCommunicationThemes,
};

export function parseGoalTracks(value = "job_interviews"): GoalTrack[] {
  const valid = new Set<GoalTrack>(["job_interviews", "daily_work", "general_communication"]);
  const tracks = value.split(",").filter((item): item is GoalTrack => valid.has(item as GoalTrack));
  return tracks.length ? tracks : ["job_interviews"];
}

export function selectDailyConversationPlan(dateKey: string, specialty: string, serializedGoalTracks = "job_interviews") {
  const goalTracks = parseGoalTracks(serializedGoalTracks);
  const themes = goalTracks.flatMap(track => themeSets[track]);
  const theme = themes[dayIndex(dateKey, themes.length)]!;
  const field = specialtyName(specialty);
  return {
    ...theme,
    goalTracks,
    goalLabel: goalTracks.map(track => goalTrackLabels[track]).join(" + "),
    words: theme.words.map(english => ({ english, arabic: wordTranslations[english] ?? english })),
    targetMinutes: 8,
    prompt: `Act as a supportive English interviewer for a recent ${field} graduate at A2/B1 level. Have an 8-minute conversation about ${theme.topic}. Ask one question at a time and wait for my answer. Encourage me to use these words naturally: ${theme.words.join(", ")}. Correct only important errors after every 2–3 answers so the conversation remains natural. At the end, give a complete evaluation with: 1) fluency, 2) vocabulary, 3) grammar, 4) clarity, 5) three corrected sentences from my answers, and 6) one overall score out of 10. State the final score clearly as: Overall score: X/10.`,
  };
}

export function gradeGrammarChoices(selected: Array<number | null>, answers: number[]) {
  const correct = selected.reduce<number>((total, choice, index) => total + (choice === answers[index] ? 1 : 0), 0);
  return { correct, total: answers.length, score: Math.round((correct / answers.length) * 70) };
}

export function buildPeriodSkillMetrics(input: {
  scoreHistory: Record<SkillKey, number[]>;
  evidenceCounts: Record<SkillKey, number>;
  completedTasks: Record<SkillKey, number>;
  strongCards: number;
}) {
  return (Object.keys(skillLabels) as SkillKey[]).map(skill => {
    const history = input.scoreHistory[skill];
    const latestScore = history.at(-1) ?? 42;
    const averageScore = history.length ? Math.round(history.reduce((sum, score) => sum + score, 0) / history.length) : 42;
    return {
      skill,
      latestScore,
      averageScore,
      scoreChange: history.length > 1 ? latestScore - history[0]! : 0,
      evidenceCount: input.evidenceCounts[skill],
      completedTasks: input.completedTasks[skill],
      strongCards: skill === "vocabulary" ? input.strongCards : undefined,
    };
  });
}

const guidedListeningPlans = [
  { id: "customer-call", title: "A phone call from a customer", label: "مكالمة من عميل", source: "British Council B1 Listening", url: "https://learnenglish.britishcouncil.org/free-resources/listening/b1", question: "What is the setting of today’s listening?", choices: ["A customer call", "A football match", "A hotel booking"], answer: 0, phraseHint: "e.g. How can I help you?" },
  { id: "team-meeting", title: "Making a decision", label: "اجتماع لاتخاذ قرار", source: "British Council B1 Listening", url: "https://learnenglish.britishcouncil.org/free-resources/listening/b1", question: "What is the main situation in today’s listening?", choices: ["A team decision", "A cooking lesson", "A train announcement"], answer: 0, phraseHint: "e.g. I think we should..." },
  { id: "work-life", title: "Work–life balance", label: "مقابلة عن توازن العمل والحياة", source: "British Council B1 Listening", url: "https://learnenglish.britishcouncil.org/free-resources/listening/b1", question: "What is the topic of today’s listening?", choices: ["Work–life balance", "Space travel", "Hotel booking"], answer: 0, phraseHint: "e.g. It is important to..." },
] as const;

const workplaceListeningPlans = [
  { id: "pitching", title: "Office English: Pitching", label: "عرض فكرة مهنية", source: "BBC Learning English For Work", url: "https://www.bbc.com/audio/brand/p0h6ffwg", question: "What is the main communication skill in today’s episode?", choices: ["Pitching an idea", "Asking for a taxi", "Booking a hotel"], answer: 0, phraseHint: "e.g. I would like to suggest..." },
  { id: "client-management", title: "Office English: Client management", label: "التعامل مع العملاء", source: "BBC Learning English For Work", url: "https://www.bbc.com/audio/brand/p0h6ffwg", question: "What is the focus of today’s episode?", choices: ["Dealing with customers and clients", "Cooking for friends", "Booking flights"], answer: 0, phraseHint: "e.g. Let me check that for you..." },
  { id: "feedback", title: "Office English: Feedback", label: "تقديم تغذية راجعة", source: "BBC Learning English For Work", url: "https://www.bbc.com/audio/brand/p0h6ffwg", question: "What is the communication goal today?", choices: ["Giving polite feedback", "Ordering a meal", "Talking about sports"], answer: 0, phraseHint: "e.g. One suggestion would be..." },
] as const;

export function selectDailyListeningPlan(dateKey: string, practicalBand: string) {
  const plans = selectListeningTrack(practicalBand) === "guided-workplace" ? guidedListeningPlans : workplaceListeningPlans;
  return plans[dayIndex(dateKey, plans.length)]!;
}

export async function completeVocabularyReviewWorkflow(input: {
  remainingDueCardCount: number;
  markVocabularyTaskComplete: () => Promise<void>;
  refreshCalibration: () => Promise<void>;
}) {
  if (!isVocabularyReviewComplete(input.remainingDueCardCount)) return false;
  await input.markVocabularyTaskComplete();
  await input.refreshCalibration();
  return true;
}

export async function persistConversationEvaluationWorkflow(input: {
  scoreOutOfTen: number;
  prompt: string;
  persistEvidence: (evidence: { score: number; prompt: string; response: string }) => Promise<void>;
  markSpeakingTaskComplete: () => Promise<void>;
  refreshCalibration: () => Promise<void>;
}) {
  const score = conversationScoreToEvidence(input.scoreOutOfTen);
  await input.persistEvidence({ score, prompt: input.prompt, response: `Overall score: ${input.scoreOutOfTen}/10` });
  await input.markSpeakingTaskComplete();
  await input.refreshCalibration();
  return score;
}
