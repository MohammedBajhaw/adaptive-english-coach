import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { BookOpen, BrainCircuit, Check, ChevronLeft, Clock3, Ear, FilePenLine, MessageCircle, Sparkles, Target, TriangleAlert } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const preview = {
  profile: { dailyMinutes: 50, engineeringSpecialty: "هندسة عامة", calibrationConfidence: 31 },
  snapshot: { practicalBand: "قيد المعايرة · A2/B1", aggregateScore: 46, vocabularyScore: 39, grammarScore: 51, listeningScore: 43, speakingScore: 35, writingScore: 48, evidenceCount: 2, summary: "نبدأ من أدلة قصيرة بدل حكم نهائي." },
  stats: { totalCards: 5, strongCards: 0, completedToday: 1, totalToday: 5 },
  skillProgress: [
    { skill: "vocabulary", completed: 1, total: 1, percentage: 100 }, { skill: "grammar", completed: 0, total: 1, percentage: 0 }, { skill: "listening", completed: 0, total: 1, percentage: 0 }, { skill: "speaking", completed: 0, total: 1, percentage: 0 }, { skill: "writing", completed: 0, total: 1, percentage: 0 },
  ],
  dailyReport: { completedSkillCount: 1, gaps: [{ skill: "speaking", title: "أضف دليلًا في المحادثة", message: "لا توجد إجابة أو عينة مباشرة كافية لهذه المهارة بعد؛ أكمل مهمتها أو أضفها من صفحة المعايرة." }, { skill: "grammar", title: "مهمة القواعد بانتظارك", message: "إنجاز اليوم في هذه المهارة 0%؛ إكمال المهمة يجعل صورة مستواك اليوم أكثر دقة." }, { skill: "vocabulary", title: "بطاقات تحتاج تثبيتًا", message: "بطاقة مستحقة جديدة؛ قيّم الاسترجاع لتحديد موعد المراجعة التالي." }] },
  dueCards: [{ id: 1, term: "reliable", arabicMeaning: "موثوق؛ يمكن الاعتماد عليه", engineeringDomain: "general engineering", reviewStrength: 0 }],
  tasks: [
    { id: 1, skill: "vocabulary", title: "مراجعة مفردات هندسية", instructions: "استرجع البطاقات المستحقة وانطق كل كلمة في جملة.", minutes: 14, status: "completed" },
    { id: 2, skill: "grammar", title: "دقة القاعدة في السياق", instructions: "حل تدريبًا قصيرًا ثم اكتب جملتين.", minutes: 12, status: "pending" },
    { id: 3, skill: "listening", title: "استماع مركز", instructions: "استمع لمقطع قصير وسجل 3 أفكار.", minutes: 10, status: "pending" },
    { id: 4, skill: "speaking", title: "تدريب كلامي موجّه", instructions: "تحدث بصوت مسموع عن مشروعك.", minutes: 10, status: "pending" },
    { id: 5, skill: "writing", title: "كتابة مهنية قصيرة", instructions: "اكتب 3 جمل عن مهمة هندسية.", minutes: 8, status: "pending" },
  ],
};

const skillMeta = {
  vocabulary: { label: "المفردات", icon: BookOpen, color: "#0d7a6e" },
  grammar: { label: "القواعد", icon: BrainCircuit, color: "#8b65c2" },
  listening: { label: "الاستماع", icon: Ear, color: "#d07936" },
  speaking: { label: "المحادثة", icon: MessageCircle, color: "#3282b8" },
  writing: { label: "الكتابة", icon: FilePenLine, color: "#b85769" },
} as const;

export default function Home() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [_, setLocation] = useLocation();
  const query = trpc.learning.dashboard.get.useQuery(undefined, { enabled: isAuthenticated });
  const mutation = trpc.learning.tasks.complete.useMutation({ onSuccess: () => { utils.learning.dashboard.get.invalidate(); toast.success("تم تسجيل الإنجاز، وسيؤثر في معايرة المستوى."); } });
  const data = (isAuthenticated ? query.data : preview) ?? preview;
  const completedPercent = Math.round((data.stats.completedToday / data.stats.totalToday) * 100);
  const tasks = data.tasks as typeof preview.tasks;
  const snapshot = data.snapshot;
  const skillRows = [
    ["vocabulary", snapshot.vocabularyScore], ["grammar", snapshot.grammarScore], ["speaking", snapshot.speakingScore], ["listening", snapshot.listeningScore], ["writing", snapshot.writingScore],
  ] as const;

  function toggleTask(task: typeof tasks[number]) {
    if (!isAuthenticated) { toast.info("سجّل دخولك لتتحول المعاينة إلى خطتك الحقيقية."); return; }
    mutation.mutate({ taskId: task.id, completed: task.status !== "completed" });
  }

  return <div className="space-y-7" dir="rtl">
    <section className="enter overflow-hidden rounded-[28px] bg-primary px-6 py-7 text-white soft-shadow sm:px-9 sm:py-9">
      <div className="relative z-10 grid gap-8 lg:grid-cols-[1.4fr_.8fr] lg:items-end">
        <div><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-emerald-50"><Sparkles className="h-3.5 w-3.5 text-[#e3bc62]" />المرحلة الأولى · تشخيص متدرج</div><h1 className="max-w-xl text-3xl font-extrabold leading-[1.35] tracking-tight sm:text-4xl">اليوم لا نختبرك فقط،<br /><span className="text-[#e3bc62]">نبدأ بفهم طريقتك في التعلم.</span></h1><p className="mt-4 max-w-xl text-sm leading-7 text-emerald-50/78 sm:text-base">كل إجابة، بطاقة، ومهمة مكتملة تضيف دليلًا جديدًا. لا مستوى نهائي في اليوم الأول.</p></div>
        <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur"><div className="flex items-start justify-between"><div><p className="text-xs text-emerald-50/70">مستواك العملي الحالي</p><p className="mt-1 text-xl font-bold">{snapshot.practicalBand}</p></div><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e3bc62] text-xl font-extrabold text-primary">{snapshot.aggregateScore}</div></div><div className="mt-5"><div className="mb-2 flex justify-between text-xs text-emerald-50/70"><span>ثقة المعايرة</span><span>{data.profile.calibrationConfidence}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#e3bc62]" style={{ width: `${data.profile.calibrationConfidence}%` }} /></div></div></div>
      </div><div className="pointer-events-none absolute -left-16 -top-12 h-52 w-52 rounded-full bg-[#55a578]/20 blur-3xl" /></section>

    <section className="grid gap-5 xl:grid-cols-[1.5fr_.9fr]">
      <div className="rounded-[24px] bg-card p-5 soft-shadow sm:p-6"><div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-semibold text-[#0d7a6e]">خريطة اليوم</p><h2 className="mt-1 text-xl font-extrabold">خمس مهام، بوتيرة واقعية</h2></div><div className="text-left"><p className="text-2xl font-extrabold text-primary">{completedPercent}%</p><p className="text-[11px] text-muted-foreground">مكتمل اليوم</p></div></div><div className="space-y-2.5">{tasks.map(task => { const meta = skillMeta[task.skill as keyof typeof skillMeta]; const Icon = meta.icon; const done = task.status === "completed"; return <button key={task.id} onClick={() => toggleTask(task)} className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-right ${done ? "border-emerald-100 bg-emerald-50/70" : "border-border bg-white hover:border-[#b9d6ca] hover:bg-[#fbfdfb]"}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${done ? "bg-[#0d7a6e] text-white" : "bg-muted text-muted-foreground"}`}>{done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="font-bold text-sm">{task.title}</span><span className="text-[11px] text-muted-foreground">{task.minutes} د</span></span><span className="mt-1 block truncate text-xs text-muted-foreground">{task.instructions}</span></span><ChevronLeft className={`h-4 w-4 ${done ? "text-[#0d7a6e]" : "text-muted-foreground/40 group-hover:text-primary"}`} /></button>; })}</div></div>
      <div className="rounded-[24px] bg-[#ecf3ef] p-5 sm:p-6"><div className="flex items-center gap-2 text-[#0d7a6e]"><Target className="h-5 w-5" /><p className="text-sm font-bold">مؤشرات لا أحكام</p></div><p className="mt-3 text-sm leading-7 text-[#375651]">{snapshot.summary}</p><div className="mt-6 space-y-4">{skillRows.map(([key, value]) => { const item = skillMeta[key]; return <div key={key}><div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold">{item.label}</span><span className="font-bold" style={{ color: item.color }}>{value}%</span></div><div className="meter-track h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: item.color }} /></div></div>; })}</div><button onClick={() => setLocation("/diagnostic")} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[#b6d5c6] bg-white px-4 py-2.5 text-sm font-bold text-primary hover:bg-[#f8fbf9]">أضف دليلًا جديدًا للمستوى<ChevronLeft className="h-4 w-4" /></button></div>
    </section>

    <section className="grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
      <div className="rounded-[24px] border border-border bg-white p-5 soft-shadow sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-[#8b65c2]">تفصيل الإنجاز اليومي</p><h2 className="mt-1 text-xl font-extrabold">كل مهارة لها مسارها</h2></div><span className="rounded-xl bg-[#f2eff9] px-3 py-1.5 text-xs font-bold text-[#7652ad]">{data.dailyReport.completedSkillCount}/5 مكتمل</span></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{data.skillProgress.map(item => { const meta = skillMeta[item.skill as keyof typeof skillMeta]; const Icon = meta.icon; return <div key={item.skill} className="rounded-2xl border border-border bg-[#fcfdfb] p-3"><div className="flex items-center justify-between"><div className="grid h-8 w-8 place-items-center rounded-xl bg-white shadow-sm" style={{ color: meta.color }}><Icon className="h-4 w-4" /></div><span className="text-sm font-extrabold" style={{ color: meta.color }}>{item.percentage}%</span></div><p className="mt-3 text-xs font-bold">{meta.label}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.completed} من {item.total} مهام</p></div>; })}</div></div>
      <div className="rounded-[24px] bg-[#fff9eb] p-5 sm:p-6"><div className="flex items-center gap-2 text-[#9b6816]"><TriangleAlert className="h-5 w-5" /><p className="text-sm font-bold">تقرير اليوم: ما الذي يحتاج دعمًا؟</p></div><div className="mt-4 space-y-3">{data.dailyReport.gaps.map((gap, index) => { const meta = skillMeta[gap.skill as keyof typeof skillMeta]; return <div key={`${gap.skill}-${index}`} className="rounded-2xl border border-[#f0e1bc] bg-white/70 p-3"><p className="text-sm font-bold" style={{ color: meta.color }}>{gap.title}</p><p className="mt-1 text-xs leading-6 text-[#73582a]">{gap.message}</p></div>; })}</div></div>
    </section>

    <section className="grid gap-5 md:grid-cols-2"><div className="rounded-[24px] border border-border bg-card p-5 soft-shadow"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-[#8b65c2]">بطاقات مستحقة</p><h2 className="mt-1 text-xl font-extrabold">استرجاع، لا قراءة فقط</h2></div><span className="rounded-xl bg-[#f2eff9] px-3 py-1.5 text-xs font-bold text-[#7652ad]">{data.dueCards.length} الآن</span></div>{data.dueCards[0] ? <div className="mt-5 rounded-2xl bg-[#f7f8f5] p-4"><p className="font-['DM_Sans'] text-2xl font-bold text-primary" dir="ltr">{data.dueCards[0].term}</p><p className="mt-1 text-sm text-muted-foreground">{data.dueCards[0].arabicMeaning}</p><p className="mt-3 text-xs text-[#0d7a6e]">{data.dueCards[0].engineeringDomain}</p></div> : <div className="mt-5 rounded-2xl bg-[#f7f8f5] p-4 text-sm text-muted-foreground">ممتاز، لا توجد بطاقات مستحقة الآن.</div>}<Button onClick={() => setLocation("/cards")} className="mt-4 w-full bg-primary">ابدأ مراجعة مركزة</Button></div>
      <div className="rounded-[24px] bg-[#f5ebd3] p-5 soft-shadow"><div className="flex items-center gap-2 text-[#9b6816]"><Clock3 className="h-5 w-5" /><p className="text-sm font-bold">إيقاع قابل للاستمرار</p></div><h2 className="mt-3 text-xl font-extrabold text-[#573f16]">{data.profile.dailyMinutes} دقيقة اليوم، لا أكثر.</h2><p className="mt-2 text-sm leading-7 text-[#73582a]">الخطة توزع الوقت وفق ما تختاره أنت. في الأيام المزدحمة تبقى المراجعة الأساسية خفيفة بدل أن تنقطع السلسلة.</p><button onClick={() => setLocation("/settings")} className="mt-5 flex items-center gap-2 text-sm font-bold text-[#573f16] underline decoration-[#cba762] underline-offset-4">عدّل الوقت والأولوية<ChevronLeft className="h-4 w-4" /></button></div></section>
  </div>;
}
