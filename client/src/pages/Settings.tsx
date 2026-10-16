import { useAuth } from "@/_core/hooks/useAuth";
import ReminderSettings from "@/components/ReminderSettings";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getSupabase } from "@/lib/supabase";
import { Bell, Check, Gauge, Save, SlidersHorizontal, Sparkles, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type GoalTrack = "job_interviews" | "daily_work" | "general_communication";
type StudyMode = "steady" | "balanced" | "intensive";
type FormState = {
  studyMode: StudyMode;
  engineeringSpecialty: string;
  goalTracks: GoalTrack[];
  vocabularyWeight: number;
  grammarWeight: number;
  listeningWeight: number;
  speakingWeight: number;
  writingWeight: number;
};

const modes: Array<{ key: StudyMode; label: string; minutes: number; description: string; vocabulary: string; conversation: string; listening: string; grammar: string; writing: string }> = [
  { key: "steady", label: "ثبات يومي", minutes: 15, description: "لليوم المزدحم: لمس كل المهارات بدون إرهاق.", vocabulary: "5 كلمات", conversation: "5 دقائق", listening: "≈1 دقيقة · سؤالان", grammar: "5 اختيارات + تطبيق", writing: "جملة مهنية" },
  { key: "balanced", label: "تقدم متوازن", minutes: 30, description: "الإيقاع الافتراضي لبناء تقدم ثابت في جميع المهارات.", vocabulary: "7 كلمات", conversation: "10 دقائق", listening: "≈2 د · 4 أسئلة", grammar: "10 اختيارات + تطبيق", writing: "3 جمل مهنية" },
  { key: "intensive", label: "تحدٍّ مكثف", minutes: 45, description: "لليوم الذي تملك فيه وقتًا وطاقة للتطبيق الأعمق.", vocabulary: "10 كلمات", conversation: "13 دقيقة", listening: "≈4 د · 6 أسئلة", grammar: "20 اختيارًا + تطبيقان", writing: "5 جمل مهنية" },
];

const tracks: Array<{ key: GoalTrack; label: string; hint: string }> = [
  { key: "job_interviews", label: "مقابلات العمل", hint: "مشروع التخرج، نقاط القوة، وحل المشكلات" },
  { key: "daily_work", label: "العمل الهندسي اليومي", hint: "اجتماعات وتحديثات وتسليم مهام" },
  { key: "general_communication", label: "التواصل العام", hint: "تقديم النفس وطلب التوضيح والشرح" },
];

const rows = [
  { key: "speakingWeight", label: "المحادثة", description: "يزيد توجيه البرومبت وإنتاجك الشفهي" },
  { key: "vocabularyWeight", label: "المفردات", description: "يزيد أولوية الكلمات والتطبيق" },
  { key: "grammarWeight", label: "القواعد", description: "يزيد عمق الأمثلة والتطبيق" },
  { key: "listeningWeight", label: "الاستماع", description: "يزيد التركيز على الفهم والعبارات" },
  { key: "writingWeight", label: "الكتابة", description: "يزيد صعوبة ومراجعة الإنتاج المكتوب" },
] as const;

const initial: FormState = { studyMode: "balanced", engineeringSpecialty: "mechatronics", goalTracks: ["job_interviews"], vocabularyWeight: 25, grammarWeight: 20, listeningWeight: 15, speakingWeight: 25, writingWeight: 15 };

export default function Settings() {
  const { isAuthenticated, user } = useAuth();
  const [form, setForm] = useState<FormState>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const activeMode = modes.find(mode => mode.key === form.studyMode) ?? modes[1]!;
  const weightsTotal = rows.reduce((sum, row) => sum + form[row.key], 0);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    void (getSupabase() as any).from("learner_profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data, error }: { data: any; error: any }) => {
      if (error || !data) return;
      const savedMode = modes.some(mode => mode.key === data.study_mode) ? data.study_mode as StudyMode : "balanced";
      const savedTracks = String(data.goal_track).split(",").filter(track => tracks.some(item => item.key === track)) as GoalTrack[];
      setForm({ studyMode: savedMode, engineeringSpecialty: data.engineering_specialty, goalTracks: savedTracks.length ? savedTracks : ["job_interviews"], vocabularyWeight: data.vocabulary_weight, grammarWeight: data.grammar_weight, listeningWeight: data.listening_weight, speakingWeight: data.speaking_weight, writingWeight: data.writing_weight });
    });
  }, [isAuthenticated, user?.id]);
  const allocation = useMemo(() => rows.map(row => ({ ...row, percentage: Math.round(form[row.key] / weightsTotal * 100) })), [form, weightsTotal]);

  function toggleTrack(track: GoalTrack) {
    setForm(current => ({ ...current, goalTracks: current.goalTracks.includes(track) ? current.goalTracks.length > 1 ? current.goalTracks.filter(item => item !== track) : current.goalTracks : [...current.goalTracks, track] }));
  }

  function updateWeight(key: typeof rows[number]["key"], value: string) {
    setForm(current => ({ ...current, [key]: Number(value) }));
  }

  async function save() {
    if (!isAuthenticated) return toast.info("سجل دخولك لحفظ خطتك الشخصية.");
    if (!user?.id) return;
    setIsSaving(true);
    const { error } = await (getSupabase() as any).from("learner_profiles").update({ study_mode: form.studyMode, daily_minutes: activeMode.minutes, engineering_specialty: form.engineeringSpecialty, goal_track: form.goalTracks.join(","), vocabulary_weight: form.vocabularyWeight, grammar_weight: form.grammarWeight, listening_weight: form.listeningWeight, speaking_weight: form.speakingWeight, writing_weight: form.writingWeight }).eq("user_id", user.id);
    setIsSaving(false);
    if (error) return toast.error(error.message);
    toast.success("تم حفظ النمط والأولويات لخطة اليوم القادمة.");
  }

  return <div className="mx-auto max-w-4xl space-y-6" dir="rtl">
    <section className="rounded-[28px] bg-primary px-6 py-7 text-white soft-shadow sm:px-8"><div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#d8ad4d] text-primary"><SlidersHorizontal className="h-6 w-6" /></div><div><h1 className="text-3xl font-extrabold tracking-tight">خطتك، بإيقاعك أنت.</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-emerald-50/75">اختر نمطًا يدرّب كل المهارات كل يوم، ثم استخدم الأوزان لتحديد أين يكون التطبيق أعمق.</p></div></div></section>

    <section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-7"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#eaf6ed] text-[#0d7a6e]"><Sparkles className="h-5 w-5" /></div><div><h2 className="font-bold">نمط التعلم اليومي</h2><p className="text-xs text-muted-foreground">كل نمط يشمل المفردات والقواعد والاستماع والمحادثة والكتابة؛ الفرق في الحمل والمدة.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-3">{modes.map(mode => <button type="button" key={mode.key} onClick={() => setForm(current => ({ ...current, studyMode: mode.key }))} className={`rounded-2xl border p-4 text-right transition ${form.studyMode === mode.key ? "border-[#0d7a6e] bg-[#edf8f2] ring-1 ring-[#0d7a6e]" : "border-border bg-[#fcfdfb] hover:border-[#9bc7b2]"}`}><div className="flex items-center justify-between"><strong>{mode.label}</strong>{form.studyMode === mode.key && <Check className="h-4 w-4 text-[#0d7a6e]" />}</div><p className="mt-2 text-xs leading-6 text-muted-foreground">{mode.description}</p><p className="mt-3 text-sm font-bold text-[#0d7a6e]">≈ {mode.minutes} دقيقة</p></button>)}</div><div className="mt-4 grid gap-2 rounded-2xl bg-[#f7f7fb] p-4 text-xs leading-6 text-[#514b68] sm:grid-cols-2"><span>المفردات: <strong>{activeMode.vocabulary}</strong></span><span>المحادثة: <strong>{activeMode.conversation}</strong></span><span>الاستماع: <strong>{activeMode.listening}</strong></span><span>القواعد: <strong>{activeMode.grammar}</strong></span><span className="sm:col-span-2">الكتابة: <strong>{activeMode.writing}</strong></span></div></section>

    <section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-7"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#eef1fa] text-[#4d60a1]"><Wrench className="h-5 w-5" /></div><div><h2 className="font-bold">المجال الهندسي</h2><p className="text-xs text-muted-foreground">يؤثر في مفردات المحتوى ومواقف المحادثة.</p></div></div><select value={form.engineeringSpecialty} onChange={event => setForm(current => ({ ...current, engineeringSpecialty: event.target.value }))} className="mt-5 w-full rounded-2xl border border-border bg-[#fcfdfb] px-4 py-3 text-sm text-primary outline-none focus:ring-2 focus:ring-[#8cbfa5]"><option value="general">هندسة عامة</option><option value="civil">هندسة مدنية</option><option value="mechanical">هندسة ميكانيكية</option><option value="electrical">هندسة كهربائية</option><option value="mechatronics">هندسة ميكاترونيك</option><option value="software">هندسة برمجيات</option><option value="industrial">هندسة صناعية</option><option value="chemical">هندسة كيميائية</option></select></section>

    <section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-7"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f5ebd3] text-[#9b6816]"><Wrench className="h-5 w-5" /></div><div><h2 className="font-bold">مسارات الهدف</h2><p className="text-xs text-muted-foreground">اختر مسارًا واحدًا أو اثنين أو الثلاثة؛ يدوّر النظام موضوع المحادثة بينها.</p></div></div><div className="mt-5 space-y-3">{tracks.map(track => <label key={track.key} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-[#fcfdfb] p-4"><Checkbox checked={form.goalTracks.includes(track.key)} onCheckedChange={() => toggleTrack(track.key)} className="mt-0.5" /><span><span className="block text-sm font-bold text-primary">{track.label}</span><span className="mt-1 block text-xs leading-6 text-muted-foreground">{track.hint}</span></span></label>)}</div></section>

    <section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-7"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f2eff9] text-[#7652ad]"><Gauge className="h-5 w-5" /></div><div><h2 className="font-bold">أوزان المهارات</h2><p className="text-xs text-muted-foreground">لن تلغي أي مهارة؛ تمنح المهارة الأعلى أولوية في كلماتها وأسئلتها وتطبيقها داخل النمط المختار.</p></div></div><div className="mt-5 rounded-2xl bg-[#f8f7fc] p-4 text-xs leading-6 text-[#5c5572]">النمط يضمن الخمس مهارات يوميًا. الأوزان تحدد أين تتوسع الأمثلة أو الصعوبة أو التطبيق الإضافي: {allocation.map(item => `${item.label} ${item.percentage}%`).join("، ")}.</div><div className="mt-4 divide-y divide-border">{rows.map(row => <div key={row.key} className="grid gap-3 py-4 sm:grid-cols-[180px_1fr_52px] sm:items-center"><div><p className="text-sm font-bold">{row.label}</p><p className="text-xs text-muted-foreground">{row.description}</p></div><input aria-label={`أولوية ${row.label}`} type="range" min="5" max="70" value={form[row.key]} onChange={event => updateWeight(row.key, event.target.value)} className="h-2 accent-[#7652ad]" /><span className="rounded-xl bg-[#f6f4fb] py-1.5 text-center text-sm font-bold text-[#7652ad]">{form[row.key]}%</span></div>)}</div></section>

    <ReminderSettings userId={user?.id} isAuthenticated={isAuthenticated} />
    <Button onClick={save} disabled={isSaving} className="w-full bg-primary py-6 text-base"><Save className="ml-2 h-5 w-5" />{isSaving ? "جارٍ حفظ النمط..." : "حفظ نمطي وخطتي الشخصية"}</Button>
  </div>;
}
