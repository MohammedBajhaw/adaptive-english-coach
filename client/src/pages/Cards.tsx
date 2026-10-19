import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { loadStudyMode, studyModeSettings } from "@/lib/studyMode";
import { levelLabels, type BankLevel } from "@/lib/vocabularyBank";
import { completeSupabaseTaskByKey, loadSupabaseDueCards, rateSupabaseCard } from "@/lib/supabaseLearning";
import { ArrowLeft, AudioLines, BookOpenCheck, Check, CircleHelp, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const previewCards = [{ id: "preview", term: "Actuator", arabic_meaning: "مشغّل / مُحرِّك", pronunciation: "AK-choo-ay-ter", category: "Actuators", definition: "A device that turns an electrical, hydraulic, or pneumatic input into physical motion or force.", examples: [{ english: "The actuator moves the robot arm when it receives a signal.", arabic: "يحرّك المشغّل ذراع الروبوت عندما يستقبل إشارة." }, { english: "A pneumatic actuator opens and closes the gripper.", arabic: "يفتح المشغّل الهوائي القابض ويغلقه." }], level: "Beginner", stageName: "المحركات والحساسات", interviewPriority: false, review_strength: 0 }];
const ratings = [{ key: "again", label: "لم أتذكر", className: "border-[#e6c0c0] text-[#a54444] hover:bg-[#fff6f6]" }, { key: "hard", label: "صعبة", className: "border-[#ead8ab] text-[#9b6816] hover:bg-[#fffcf3]" }, { key: "good", label: "جيدة", className: "border-[#b7d9c8] text-[#0d7a6e] hover:bg-[#f4fbf6]" }, { key: "easy", label: "سهلة", className: "border-[#b8d1e3] text-[#2a73a2] hover:bg-[#f5faff]" }] as const;

export default function Cards() {
  const { isAuthenticated, user } = useAuth();
  const [_, setLocation] = useLocation();
  const [cards, setCards] = useState<any[]>(previewCards);
  const [exampleOpen, setExampleOpen] = useState(true);
  const [isRating, setIsRating] = useState(false);
  useEffect(() => {
    if (!isAuthenticated || !user?.id) { setCards(previewCards); return; }
    void loadStudyMode(user.id).then(mode => loadSupabaseDueCards(user.id, studyModeSettings[mode].newWords)).then(setCards).catch(error => toast.error(error.message));
  }, [isAuthenticated, user?.id]);
  const current = cards[0];
  function speak(sentence: string) { if (!("speechSynthesis" in window)) return toast.info("النطق غير متاح في هذا المتصفح."); window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(sentence); utterance.lang = "en-US"; utterance.rate = .9; window.speechSynthesis.speak(utterance); }
  async function chooseRating(rating: typeof ratings[number]["key"]) {
    if (!isAuthenticated || !user?.id) return toast.info("سجل دخولك لتُحفظ قوة هذه البطاقة وتظهر في موعدها التالي.");
    setIsRating(true);
    try {
      await rateSupabaseCard(user.id, current, rating);
      const remaining = cards.filter(item => item.id !== current.id);
      setCards(remaining);
      // Reviewing the last due card completes today's vocabulary task.
      if (remaining.length === 0) { await completeSupabaseTaskByKey(user.id, "vocabulary"); toast.success("أنهيت كل البطاقات المستحقة واكتملت مهمة المفردات."); }
      else toast.success("تمت الجدولة حسب قوة تذكرك.");
    }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر حفظ مراجعة البطاقة."); }
    finally { setIsRating(false); }
  }
  if (!current) return <div className="mx-auto max-w-3xl" dir="rtl"><section className="rounded-[28px] bg-white p-9 text-center soft-shadow"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#eaf6ed] text-[#0d7a6e]"><Check className="h-7 w-7" /></div><h1 className="mt-5 text-2xl font-extrabold text-primary">لا توجد بطاقات مستحقة الآن</h1><p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">المراجعة المتباعدة تحفظ بطاقاتك القوية لوقت لاحق بدل أن تكرر ما تعرفه كل يوم.</p><Button onClick={() => setLocation("/")} className="mt-6 bg-primary">العودة لخطة اليوم</Button></section></div>;
  const examples = Array.isArray(current.examples) ? current.examples.map((item: any) => typeof item === "string" ? { english: item, arabic: "ترجمة المثال ستظهر بعد تحديث البطاقة." } : item) : [];
  return <div className="mx-auto max-w-4xl space-y-6" dir="rtl"><section className="flex flex-wrap items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-bold text-[#0d7a6e]"><Sparkles className="h-4 w-4" />مراجعة متباعدة · استرجاع نشط</div><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-primary">قلها قبل أن تقرأها.</h1><p className="mt-2 text-sm text-muted-foreground">قيّم التذكر بصدق؛ اختيارك يحدد متى تعود البطاقة.</p></div><span className="rounded-2xl bg-[#eff7f1] px-4 py-2 text-sm font-bold text-[#0d7a6e]">{cards.length} بطاقة مستحقة</span></section><section className="overflow-hidden rounded-[30px] border border-border bg-white soft-shadow"><div className="border-b border-border bg-[#fbfcf9] px-6 py-4 text-xs text-muted-foreground"><span className="rounded-lg bg-[#eaf6ed] px-2 py-1 font-bold text-[#0d7a6e]" dir="ltr">{current.category ?? current.engineering_domain}</span>{current.level && <span className="mr-2 rounded-lg bg-[#eef1fa] px-2 py-1 font-bold text-[#4d60a1]">{levelLabels[current.level as BankLevel] ?? current.level}</span>}{current.interviewPriority && <span className="mr-2 rounded-lg bg-[#f5e3ae] px-2 py-1 font-bold text-[#7a5413]">مهم للمقابلات</span>}{current.stageName && <span className="mr-2">{current.stageName}</span>}</div><div className="p-6 sm:p-9"><div className="flex flex-wrap items-start justify-between gap-4" dir="ltr"><div className="min-w-0 flex-1"><h2 className="break-words font-['DM_Sans'] text-3xl font-bold leading-tight tracking-tight text-primary sm:text-5xl">{current.term}</h2><p className="mt-3 font-['DM_Sans'] text-base text-muted-foreground">{current.pronunciation ?? current.ipa}</p></div><button onClick={() => speak(current.term)} className="grid h-12 w-12 place-items-center rounded-2xl border border-[#b7d9c8] bg-[#f4fbf6] text-[#0d7a6e] hover:bg-[#e7f5ec]" aria-label="نطق الكلمة"><AudioLines className="h-5 w-5" /></button></div><p className="mt-7 text-lg font-semibold text-[#3b514d]">{current.arabic_meaning}</p>{current.definition && <p className="mt-2 text-sm leading-7 text-muted-foreground" dir="ltr">{current.definition}</p>}<div className="mt-7 flex items-center justify-between"><button onClick={() => setExampleOpen(value => !value)} className="flex items-center gap-2 text-sm font-bold text-primary"><BookOpenCheck className="h-4 w-4" />{exampleOpen ? "إخفاء الأمثلة" : "عرض الأمثلة المترجمة"}</button><span className="text-xs text-muted-foreground">اضغط رمز الصوت لنطق كل جملة</span></div>{exampleOpen && <div className="mt-4 space-y-2.5">{examples.map((example: any, index: number) => <div key={example.english} className="flex items-start gap-3 rounded-2xl border border-border bg-[#fcfdfb] px-3 py-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#edf2ef] text-xs font-bold text-[#51635f]">{index + 1}</span><div className="min-w-0 flex-1"><p className="font-['DM_Sans'] text-sm text-[#314845]" dir="ltr">{example.english}</p><p className="mt-1 text-xs leading-6 text-muted-foreground">{example.arabic}</p></div><button onClick={() => speak(example.english)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#0d7a6e] hover:bg-[#e8f4ed]" aria-label={`نطق الجملة ${index + 1}`}><AudioLines className="h-4 w-4" /></button></div>)}</div>}</div><div className="border-t border-border bg-[#f9faf7] p-5 sm:px-9"><p className="mb-3 text-center text-xs font-semibold text-muted-foreground">كيف كان استرجاعك قبل النظر إلى المعنى؟</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{ratings.map(item => <button key={item.key} onClick={() => chooseRating(item.key)} disabled={isRating} className={`rounded-xl border bg-white px-3 py-2.5 text-sm font-bold ${item.className}`}>{item.label}</button>)}</div></div></section><section className="rounded-3xl bg-[#f5ebd3] p-5 text-[#5d4519]"><div className="flex gap-3"><CircleHelp className="mt-0.5 h-5 w-5 shrink-0" /><p className="text-sm leading-7">عدد البطاقات يتكيّف مع نمطك ومكتبتك المحلية. «لم أتذكر» تعيد البطاقة بعد نحو 4 ساعات، بينما «سهلة» تمدد موعدها؛ وتظهر التراجم بجانب الأمثلة والنطق داخل الجملة.</p></div></section><button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm font-bold text-primary"><ArrowLeft className="h-4 w-4" />العودة إلى يومي</button></div>;
}
