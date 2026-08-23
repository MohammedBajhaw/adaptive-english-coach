import { useAuth } from "@/_core/hooks/useAuth";
import { getSupabase } from "@/lib/supabase";
import { BarChart3, CalendarDays, ChartNoAxesCombined, Clock3, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const skillMeta = { vocabulary: { label: "المفردات", color: "#0d7a6e" }, grammar: { label: "القواعد", color: "#7652ad" }, speaking: { label: "المحادثة", color: "#3282b8" }, listening: { label: "الاستماع", color: "#d07936" }, writing: { label: "الكتابة", color: "#b85769" } } as const;
type Skill = keyof typeof skillMeta;
type Metric = { skill: Skill; latestScore: number; averageScore: number; scoreChange: number; evidenceCount: number; completedTasks: number; strongCards?: number };
type Period = { snapshotCount: number; skills: Metric[] };
const baseline = [39, 51, 35, 43, 48];
const blankPeriod = (): Period => ({ snapshotCount: 0, skills: (Object.keys(skillMeta) as Skill[]).map((skill, index) => ({ skill, latestScore: baseline[index]!, averageScore: baseline[index]!, scoreChange: 0, evidenceCount: 0, completedTasks: 0, strongCards: skill === "vocabulary" ? 0 : undefined })) });

function calculatePeriod(attempts: any[], tasks: any[], strongCards: number, days: number): Period {
  const cutoff = new Date(); cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const from = cutoff.toISOString();
  const periodAttempts = attempts.filter(item => item.created_at >= from);
  const periodTasks = tasks.filter(item => item.status === "completed" && item.completed_at && item.completed_at >= from);
  const skills = (Object.keys(skillMeta) as Skill[]).map((skill, index) => {
    const evidence = periodAttempts.filter(item => item.skill === skill).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const scores = evidence.map(item => Number(item.score));
    const averageScore = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : baseline[index]!;
    const latestScore = scores.length ? scores.at(-1)! : baseline[index]!;
    return { skill, latestScore, averageScore, scoreChange: scores.length > 1 ? latestScore - scores[0]! : 0, evidenceCount: evidence.length, completedTasks: periodTasks.filter(item => item.skill === skill).length, strongCards: skill === "vocabulary" ? strongCards : undefined };
  });
  return { snapshotCount: periodAttempts.length, skills };
}

function PeriodCard({ title, description, period, icon }: { title: string; description: string; period: Period; icon: React.ReactNode }) {
  return <section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-6"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#eef5f1] text-[#0d7a6e]">{icon}</div><div><h2 className="font-bold text-primary">{title}</h2><p className="text-xs text-muted-foreground">{description}</p></div></div><span className="rounded-xl bg-[#f5ebd3] px-3 py-1.5 text-xs font-bold text-[#9b6816]">{period.snapshotCount} أدلة</span></div><div className="mt-5 space-y-4">{period.skills.map(metric => { const meta = skillMeta[metric.skill]; return <div key={metric.skill} className="rounded-2xl border border-border bg-[#fcfdfb] p-4"><div className="flex items-center justify-between"><p className="text-sm font-bold text-primary">{meta.label}</p><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">متوسط {metric.averageScore}%</span><span className="font-bold" style={{ color: meta.color }}>{metric.latestScore}%</span></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf1ee]"><div className="h-full rounded-full" style={{ width: `${metric.latestScore}%`, backgroundColor: meta.color }} /></div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]"><div className="rounded-lg bg-white px-1.5 py-2"><p className="text-muted-foreground">أدلة</p><p className="mt-1 font-bold text-primary">{metric.evidenceCount}</p></div><div className="rounded-lg bg-white px-1.5 py-2"><p className="text-muted-foreground">مهام</p><p className="mt-1 font-bold text-primary">{metric.completedTasks}</p></div><div className="rounded-lg bg-white px-1.5 py-2"><p className="text-muted-foreground">التغير</p><p className="mt-1 font-bold" style={{ color: metric.scoreChange > 0 ? "#0d7a6e" : metric.scoreChange < 0 ? "#b85769" : "#6c7774" }}>{metric.scoreChange > 0 ? "+" : ""}{metric.scoreChange}</p></div></div>{metric.skill === "vocabulary" && <p className="mt-3 text-xs text-[#0d7a6e]">بطاقات قوية: {metric.strongCards ?? 0}</p>}</div>; })}</div></section>;
}

export default function Reports() {
  const { isAuthenticated, user } = useAuth();
  const [weekly, setWeekly] = useState<Period>(blankPeriod());
  const [monthly, setMonthly] = useState<Period>(blankPeriod());
  const [isLoading, setIsLoading] = useState(isAuthenticated);
  useEffect(() => {
    const userId = user?.id;
    if (!isAuthenticated || !userId) { setIsLoading(false); setWeekly(blankPeriod()); setMonthly(blankPeriod()); return; }
    let active = true;
    async function loadReports() {
      setIsLoading(true);
      const supabase: any = getSupabase();
      const [attemptsResult, tasksResult, cardsResult] = await Promise.all([
        supabase.from("diagnostic_attempts").select("skill,score,created_at").eq("user_id", userId).order("created_at", { ascending: true }),
        supabase.from("daily_tasks").select("skill,status,completed_at").eq("user_id", userId).order("date_key", { ascending: false }),
        supabase.from("vocabulary_cards").select("review_strength").eq("user_id", userId).gte("review_strength", 3),
      ]);
      if (!active) return;
      const attempts = attemptsResult.data ?? [];
      const tasks = tasksResult.data ?? [];
      const strongCards = cardsResult.data?.length ?? 0;
      setWeekly(calculatePeriod(attempts, tasks, strongCards, 7));
      setMonthly(calculatePeriod(attempts, tasks, strongCards, 30));
      setIsLoading(false);
    }
    void loadReports();
    return () => { active = false; };
  }, [isAuthenticated, user?.id]);
  return <div className="mx-auto max-w-5xl space-y-6" dir="rtl"><section className="rounded-[28px] bg-primary p-6 text-white sm:p-8"><div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#d8ad4d] text-primary"><ChartNoAxesCombined className="h-6 w-6" /></div><div><p className="text-xs font-bold text-emerald-50/70">تقارير التقدم</p><h1 className="mt-1 text-3xl font-extrabold">اقرأ اتجاهك، لا رقمًا منفصلًا.</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50/75">لكل مهارة متوسطها وتغيرها وعدد أدلتها ومهامها. عند قلة البيانات يبقى التفسير متحفظًا بدل أن يبالغ في تقدير مستواك.</p></div></div></section>{!isAuthenticated && <p className="rounded-2xl bg-[#fff7e8] p-4 text-sm text-[#825a18]">سجّل دخولك لقراءة تقريرك الشخصي المحفوظ في حساب Supabase.</p>}{isLoading ? <p className="p-6 text-center text-sm text-muted-foreground">جارٍ تحميل تقريرك…</p> : <section className="grid gap-5 lg:grid-cols-2"><PeriodCard title="التقرير الأسبوعي" description="آخر سبعة أيام: راقب ما يحتاج تغييرًا في خطة الأسبوع التالي." period={weekly} icon={<CalendarDays className="h-5 w-5" />} /><PeriodCard title="التقرير الشهري" description="آخر ثلاثين يومًا: راقب الاستمرارية وتطور كل مهارة." period={monthly} icon={<Clock3 className="h-5 w-5" />} /></section>}<section className="rounded-[24px] border border-[#d8d0ec] bg-[#faf9fd] p-5"><div className="flex items-center gap-2 text-[#604095]"><BarChart3 className="h-5 w-5" /><h2 className="font-bold">كيف تقرأ هذه الأرقام؟</h2></div><p className="mt-2 text-sm leading-7 text-[#5c5572]">المتوسط يخفف أثر يوم واحد، والتغير يقارن أول دليل بآخر دليل في الفترة. «الأدلة» هي إجابات أو تقييمات مسجلة، و«المهام» هي المهام المكتملة. للمفردات نعرض أيضًا عدد البطاقات التي بلغت قوة حفظ مرتفعة.</p><div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs leading-6 text-muted-foreground"><Sparkles className="h-4 w-4 shrink-0 text-[#d79b28]" />لا توجد مقارنة بمتعلمين آخرين؛ التقرير مصمم لتعديل خطتك الشخصية فقط.</div></section></div>;
}
