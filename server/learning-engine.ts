export type SkillKey = "vocabulary" | "grammar" | "listening" | "speaking" | "writing";
export type CardRating = "again" | "hard" | "good" | "easy";

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

export function buildDailyTaskPlan(dailyMinutes: number, weights: Record<SkillKey, number>) {
  const safeMinutes = Math.min(Math.max(Math.round(dailyMinutes), 30), 180);
  const baseMinutes = 5;
  const remaining = safeMinutes - baseMinutes * 5;
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + Math.max(value, 1), 0);
  const keys = Object.keys(weights) as SkillKey[];
  let assigned = 0;

  return keys.map((skill, index) => {
    const proportional = index === keys.length - 1
      ? remaining - assigned
      : Math.round((remaining * Math.max(weights[skill], 1)) / totalWeight);
    assigned += proportional;
    return {
      taskKey: skill,
      skill,
      minutes: baseMinutes + proportional,
      ...skillTaskContent[skill],
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

const interviewThemes = [
  { id: "project-interview", title: "مقابلة عن مشروع التخرج", topic: "your graduation project, its goal, and your contribution", words: ["sensor", "actuator", "control system", "reliable", "test results"] },
  { id: "technical-interview", title: "مقابلة عن حل مشكلة تقنية", topic: "a technical fault, how you diagnosed it, and the next test", words: ["troubleshoot", "fault", "calibrate", "signal", "root cause"] },
  { id: "strengths-interview", title: "نقاط قوة مهنية", topic: "your strengths, a challenge, and how you learned from it", words: ["initiative", "adapt", "collaborate", "improve", "responsibility"] },
] as const;

const dailyWorkThemes = [
  { id: "team-update", title: "تحديث لفريق العمل", topic: "a short project update, a delay, and a practical solution", words: ["deadline", "prototype", "coordinate", "risk", "improve"] },
  { id: "handover", title: "تسليم مهمة تقنية", topic: "handing over a technical task and explaining its current status", words: ["handover", "status", "verify", "component", "next step"] },
  { id: "meeting-idea", title: "فكرة في اجتماع", topic: "suggesting an improvement in a team meeting", words: ["suggest", "benefit", "constraint", "feasible", "feedback"] },
] as const;

const generalCommunicationThemes = [
  { id: "professional-introduction", title: "تقديم مهني مختصر", topic: "introducing yourself, your field, and what you enjoy learning", words: ["background", "interested in", "develop", "experience", "goal"] },
  { id: "explaining-process", title: "شرح عملية بسيطة", topic: "explaining a simple technical process to a non-specialist", words: ["step", "process", "connect", "measure", "result"] },
  { id: "asking-clarification", title: "طلب توضيح باحتراف", topic: "asking for clarification and responding politely in a work conversation", words: ["clarify", "confirm", "mean", "could you", "understand"] },
] as const;

export function selectDailyConversationPlan(dateKey: string, specialty: string, goalTrack = "job_interviews") {
  const themes = goalTrack === "daily_work" ? dailyWorkThemes : goalTrack === "general_communication" ? generalCommunicationThemes : interviewThemes;
  const theme = themes[dayIndex(dateKey, themes.length)]!;
  const field = specialtyName(specialty);
  return {
    ...theme,
    goalTrack,
    targetMinutes: 8,
    prompt: `Act as a supportive English interviewer for a recent ${field} graduate at A2/B1 level. Have an 8-minute conversation about ${theme.topic}. Ask one question at a time and wait for my answer. Encourage me to use these words naturally: ${theme.words.join(", ")}. Correct only important errors after every 2–3 answers so the conversation remains natural. At the end, give a complete evaluation with: 1) fluency, 2) vocabulary, 3) grammar, 4) clarity, 5) three corrected sentences from my answers, and 6) one overall score out of 10. State the final score clearly as: Overall score: X/10.`,
  };
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
