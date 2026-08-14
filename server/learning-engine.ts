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
