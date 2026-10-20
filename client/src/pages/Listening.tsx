import { useAuth } from "@/_core/hooks/useAuth";
import { useCycle } from "@/hooks/useCycle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getTodayListeningLesson } from "@/lib/localLessons";
import { getSupabase } from "@/lib/supabase";
import { useStudyMode } from "@/lib/studyMode";
import { completeSupabaseTaskByKey } from "@/lib/supabaseLearning";
import { CheckCircle2, ExternalLink, Headphones, Lightbulb, ListChecks } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function parseListeningLesson(markdown: string) {
  const source = markdown.match(/^Source:\s*(.+)$/mi)?.[1]?.trim() ?? "مصدر الاستماع";
  const url = markdown.match(/^URL:\s*(https?:\/\/\S+)$/mi)?.[1]?.trim() ?? "";
  const focus = markdown.match(/Listening focus \(choose one\):([\s\S]*?)Comprehension/mi)?.[1]?.trim() ?? "استمع مرة للفكرة العامة ثم أعد الجزء نفسه لالتقاط التفاصيل.";
  const questions = Array.from(markdown.matchAll(/(?:^|\n)\d+\)\s*(.+?)(?=\s*\([^\n]*\))?\s*\([^\n]*\)/g)).map(([, question]) => question.trim());
  const phraseInstruction = markdown.match(/Phrase-capture instruction:\s*([\s\S]+)$/mi)?.[1]?.trim() ?? "اكتب عبارة قصيرة التقطتها من التسجيل.";
  const answers = Array.from(markdown.matchAll(/^- Q(\d+):\s*(.+)$/gm)).map(([, number, answer]) => ({ number: Number(number), answer: answer.trim() }));
  const quiz = markdown.match(/^- Quiz:\s*(.+)$/m)?.[1]?.trim() ?? "";
  return { source, url, focus, questions, phraseInstruction, answers, quiz };
}

export default function Listening() {
  const { isAuthenticated, user } = useAuth();
  const cycle = useCycle();
  const { settings: mode } = useStudyMode(user?.id);
  const limits = { label: mode.label, minutes: mode.listeningMinutes, questions: mode.listeningQuestions };
  const listeningItem = useMemo(() => ({ task: { id: "listening" }, content: getTodayListeningLesson() }), [user?.id, cycle.number]);
  const lesson = useMemo(() => parseListeningLesson(listeningItem.content.contentMarkdown), [listeningItem]);
  const questions = useMemo(() => lesson.questions.slice(0, limits.questions), [lesson.questions, limits.questions]);
  const [responses, setResponses] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { setResponses(Array.from({ length: questions.length }, () => "")); setSaved(false); }, [listeningItem?.content.id, questions.length]);

  async function finish() {
    if (questions.length === 0) return toast.error("يتم تجهيز نشاط الاستماع المحلي؛ أعد المحاولة بعد لحظة.");
    if (responses.some(item => item.trim().split(/\s+/).length < 2)) return toast.error(`أجب عن ${questions.length} أسئلة بإجابات قصيرة واضحة قبل الحفظ.`);
    const score = Math.round((responses.filter(item => item.trim().split(/\s+/).length >= 4).length / questions.length) * 70) + 30;
    const response = questions.map((question, index) => `${index + 1}. ${question}\n${responses[index]}`).join("\n\n");
    if (!user?.id) return toast.error("تعذر تحديد حسابك.");
    setIsSaving(true);
    const supabase: any = getSupabase();
    const [attempt, task] = await Promise.all([
      supabase.from("diagnostic_attempts").insert({ user_id: user.id, skill: "listening", evidence_type: "local-listening", prompt: `${lesson.source}: ${listeningItem.content.titleEnglish} · ${limits.label}`, response, score }),
      completeSupabaseTaskByKey(user.id, "listening").then(() => ({ error: null })).catch(error => ({ error })),
    ]);
    setIsSaving(false);
    if (attempt.error || task.error) return toast.error(attempt.error?.message ?? task.error?.message ?? "تعذر حفظ نتيجة الاستماع.");
    setSaved(true); toast.success("تم تسجيل دليل الاستماع المحلي وإكمال المهمة.");
  }

  if (!isAuthenticated) return <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 text-center soft-shadow" dir="rtl"><h1 className="text-2xl font-extrabold text-primary">سجّل دخولك لبدء نشاط الاستماع المحلي</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">سيحفظ التطبيق مصدر الاستماع وأسئلتك وإجاباتك ضمن خطة اليوم الخاصة بك.</p></div>;
  if (questions.length === 0) return <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 text-center soft-shadow" dir="rtl">لا يتوفر نشاط استماع صالح لليوم بعد. افتح لوحة اليوم ثم حاول مجددًا.</div>;

  return <div className="mx-auto max-w-5xl space-y-6" dir="rtl"><section className="rounded-[28px] bg-[#edf5f4] p-6 sm:p-8"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#14746d] text-white"><Headphones className="h-6 w-6" /></div><div><p className="text-xs font-bold text-[#0d7a6e]">استماع اليوم المحلي · {limits.label}</p><h1 className="mt-1 text-3xl font-extrabold text-primary">{listeningItem.content.titleArabic}</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-[#46665e]">ركز على نحو {limits.minutes} دقيقة ثم أجب عن {questions.length} أسئلة. المحتوى والأسئلة محفوظة محليًا داخل خطتك.</p></div></div></section><div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><section className="rounded-[24px] bg-white p-5 soft-shadow"><h2 className="flex items-center gap-2 font-bold"><Lightbulb className="h-5 w-5 text-[#d79b28]" />خطة الاستماع</h2><p dir="ltr" className="mt-5 whitespace-pre-wrap text-left text-sm leading-7 text-muted-foreground">{lesson.focus}</p><p dir="ltr" className="mt-4 text-left text-xs font-bold text-[#0d635e]">{lesson.source}</p><p className="mt-4 rounded-xl bg-[#f3f8f7] p-3 text-xs leading-6 text-[#46665e]" dir="ltr"><span className="font-bold">Phrase capture: </span>{lesson.phraseInstruction}</p>{lesson.url && <a href={lesson.url} target="_blank" rel="noreferrer" className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-[#0e3131]">فتح المصدر <ExternalLink className="h-4 w-4" /></a>}</section><section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-6"><h2 className="flex items-center gap-2 font-bold"><ListChecks className="h-5 w-5 text-[#14746d]" />تحقق من الفهم</h2><div className="mt-5 space-y-4">{questions.map((question, index) => <label key={index} className="block"><span dir="ltr" className="block text-left text-sm font-bold">{index + 1}. {question}</span><Textarea dir="ltr" value={responses[index] ?? ""} onChange={event => setResponses(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="mt-2 min-h-20 text-left font-['DM_Sans']" placeholder="Write a short answer in English..." /></label>)}</div><Button onClick={finish} disabled={isSaving} className="mt-5 w-full bg-[#14746d] hover:bg-[#0d635e]">{saved ? <><CheckCircle2 className="ml-2 h-4 w-4" />تم تسجيل الاستماع</> : isSaving ? "جارٍ الحفظ..." : "احفظ النتيجة وأكمل المهمة"}</Button>{saved && lesson.answers.length > 0 && <div className="mt-5 rounded-2xl bg-[#edf8f0] p-4"><p className="text-sm font-bold text-[#0d7a6e]">مفتاح الإجابات — قارن إجاباتك</p><ul className="mt-3 space-y-2 text-sm leading-6 text-[#425552]" dir="ltr">{lesson.answers.filter(item => item.number <= questions.length).map(item => <li key={item.number} className="text-left"><span className="font-bold text-primary">{item.number}.</span> {item.answer}</li>)}</ul>{lesson.quiz && <p className="mt-3 text-xs leading-6 text-muted-foreground" dir="ltr">Quiz: {lesson.quiz}</p>}</div>}</section></div></div>;
}
