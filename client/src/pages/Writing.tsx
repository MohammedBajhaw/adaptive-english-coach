import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { requestWritingCorrection, type WritingFeedback } from "@/lib/aiCorrection";
import { getTodayWritingLesson } from "@/lib/localLessons";
import { getSupabase } from "@/lib/supabase";
import { useStudyMode } from "@/lib/studyMode";
import { completeSupabaseTaskByKey } from "@/lib/supabaseLearning";
import { Bot, CheckCircle2, FilePenLine, Lightbulb, ListChecks } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function parseWritingLesson(markdown: string) {
  const brief = markdown.match(/موجز بالعربية:\s*([\s\S]*?)\n\nTarget length/mi)?.[1]?.trim() ?? "اكتب المهمة التالية بالإنجليزية.";
  const vocabulary = (markdown.match(/Target vocabulary:\s*([\s\S]*?)\n\nModel answer/mi)?.[1] ?? "").split(/\n|,/).map(item => item.replace(/^-\s*/, "").trim()).filter(Boolean);
  const modelAnswer = markdown.match(/Model answer \(English\):\s*([\s\S]*?)\n\nالترجمة العربية/mi)?.[1]?.trim() ?? "";
  const modelArabic = markdown.match(/الترجمة العربية للنموذج:\s*([\s\S]*?)\n\nSelf-check rubric/mi)?.[1]?.trim() ?? "";
  const rubric = Array.from((markdown.match(/Self-check rubric:\s*([\s\S]*)$/mi)?.[1] ?? "").matchAll(/-\s*(.+)/g)).map(([, item]) => item.trim());
  return { brief, vocabulary, modelAnswer, modelArabic, rubric };
}

export default function Writing() {
  const { isAuthenticated, user } = useAuth();
  const sentenceTarget = useStudyMode(user?.id).settings.writingSentences;
  const writingItem = useMemo(() => ({ task: { id: "writing" }, content: getTodayWritingLesson() }), [user?.id]);
  const lesson = useMemo(() => parseWritingLesson(writingItem.content.contentMarkdown), [writingItem]);
  const [text, setText] = useState("");
  const [checks, setChecks] = useState<boolean[]>([]);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selfScore, setSelfScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const sentenceCount = text.split(/[.!?]+/).filter(item => item.trim()).length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  async function requestCorrection() {
    if (wordCount < 8) return toast.error("اكتب 8 كلمات على الأقل قبل طلب التصحيح.");
    setIsCorrecting(true);
    const aiFeedback = await requestWritingCorrection(text, `Writing task: ${writingItem.content.titleEnglish}`);
    setIsCorrecting(false);
    setFeedback(aiFeedback);
    if (aiFeedback) toast.success("وصل التصحيح الذكي لنصك.");
    else toast.info("التصحيح الذكي غير مفعّل حاليًا؛ أكمل قائمة المراجعة الذاتية وقيّم نصك من 10.");
  }

  async function finish() {
    if (wordCount < 8 || sentenceCount < sentenceTarget) return toast.error(`اكتب ${sentenceTarget} جمل على الأقل وبحد أدنى 8 كلمات.`);
    if (lesson.rubric.length && checks.filter(Boolean).length < lesson.rubric.length) return toast.error("أكمل التحقق الذاتي قبل حفظ المهمة.");
    if (!feedback && selfScore === null) return toast.error("قيّم نصك من 10 بعد مقارنته بالنموذج، أو اطلب التصحيح الذكي.");
    if (!user?.id) return toast.error("تعذر تحديد حسابك.");
    setIsSaving(true);
    // Evidence comes from a real AI correction when available, otherwise from the learner's own rubric-based rating.
    const score = feedback ? feedback.score : selfScore! * 10;
    const supabase: any = getSupabase();
    const [attempt, task] = await Promise.all([
      supabase.from("diagnostic_attempts").insert({ user_id: user.id, skill: "writing", evidence_type: feedback ? "local-writing-ai-correction" : "local-writing-self-review", prompt: writingItem.content.titleEnglish, response: text, score }),
      completeSupabaseTaskByKey(user.id, "writing").then(() => ({ error: null })).catch(error => ({ error })),
    ]);
    setIsSaving(false);
    if (attempt.error || task.error) return toast.error(attempt.error?.message ?? task.error?.message ?? "تعذر حفظ مهمة الكتابة.");
    setSaved(true); toast.success("تم حفظ مهمة الكتابة المحلية ضمن تقدمك.");
  }
  if (!isAuthenticated) return <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 text-center soft-shadow" dir="rtl"><h1 className="text-2xl font-extrabold text-primary">سجّل دخولك لبدء مهمة الكتابة المحلية</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">ستحصل على مهمة مناسبة مع نموذج ومراجعة ذاتية وتقدم محفوظ.</p></div>;
  return <div className="mx-auto max-w-5xl space-y-6" dir="rtl"><section className="rounded-[28px] bg-[#f8f1e5] p-6 sm:p-8"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#a76f22] text-white"><FilePenLine className="h-6 w-6" /></div><div><p className="text-xs font-bold text-[#9b6816]">كتابة اليوم المحلية · {sentenceTarget} جمل</p><h1 className="mt-1 text-3xl font-extrabold text-primary">{writingItem.content.titleArabic}</h1><p className="mt-3 text-sm leading-7 text-[#725c38]">المهمة والنموذج ومعايير المراجعة محفوظة محليًا، وتُحفظ نتيجتك في حسابك.</p></div></div></section><div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><section className="rounded-[24px] bg-white p-5 soft-shadow"><h2 className="flex items-center gap-2 font-bold"><Lightbulb className="h-5 w-5 text-[#d79b28]" />المطلوب منك</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{lesson.brief.split(/\nTask:/)[0]}</p>{lesson.brief.includes("\nTask:") && <p dir="ltr" className="mt-3 rounded-xl bg-[#f8f1e5] p-3 text-left text-sm font-semibold leading-7 text-primary">Task: {lesson.brief.split(/\nTask:/)[1]?.trim()}</p>}<p className="mt-6 text-sm font-bold">مفردات مقترحة</p><div className="mt-3 flex flex-wrap gap-2">{lesson.vocabulary.map(word => <span key={word} dir="ltr" className="rounded-lg bg-[#f8f1e5] px-2 py-1 font-['DM_Sans'] text-xs font-bold text-[#8a5b19]">{word}</span>)}</div><details className="mt-6 rounded-2xl bg-[#f7f8f5] p-4"><summary className="cursor-pointer text-sm font-bold">اعرض نموذجًا للمراجعة بعد الكتابة</summary><p dir="ltr" className="mt-3 font-['DM_Sans'] text-sm leading-7 text-primary">{lesson.modelAnswer}</p><p className="mt-3 text-xs leading-6 text-muted-foreground">{lesson.modelArabic}</p></details></section><section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-6"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><FilePenLine className="h-5 w-5 text-[#a76f22]" />مسودتك</h2><span className="text-xs font-bold text-muted-foreground">{sentenceCount}/{sentenceTarget} جمل · {wordCount} كلمة</span></div><Textarea dir="ltr" value={text} onChange={event => { setText(event.target.value); setSaved(false); setFeedback(null); }} className="mt-5 min-h-56 text-left font-['DM_Sans']" placeholder="Write your professional English response here…" /><Button variant="outline" onClick={requestCorrection} disabled={isCorrecting} className="mt-4 w-full border-[#e0c48f] text-[#8a5b19] hover:bg-[#f8f1e5]"><Bot className="ml-2 h-4 w-4" />{isCorrecting ? "جارٍ طلب التصحيح..." : "اطلب التصحيح الذكي"}</Button>{feedback && <div className="mt-3 rounded-2xl bg-[#edf8f0] p-4"><p className="text-sm font-bold text-[#0d7a6e]">تصحيح ذكي · {feedback.score}/100</p><p className="mt-2 font-['DM_Sans'] text-sm text-primary" dir="ltr">{feedback.correctedText}</p><p className="mt-2 text-xs leading-6 text-[#425552]">{feedback.explanationArabic}</p>{feedback.priorities.length > 0 && <ul className="mt-2 list-disc space-y-1 pr-5 text-xs leading-6 text-[#425552]">{feedback.priorities.map(item => <li key={item}>{item}</li>)}</ul>}</div>}<div className="mt-6 border-t border-border pt-5"><h3 className="flex items-center gap-2 text-sm font-bold"><ListChecks className="h-4 w-4 text-[#a76f22]" />تحقق ذاتي</h3><div className="mt-3 space-y-3">{lesson.rubric.map((item, index) => <label key={item} className="flex cursor-pointer items-start gap-3 text-xs leading-6 text-muted-foreground"><Checkbox checked={checks[index] ?? false} onCheckedChange={value => setChecks(current => { const next = [...current]; next[index] = Boolean(value); return next; })} /><span dir="ltr" className="text-left">{item}</span></label>)}</div></div>{!feedback && <div className="mt-5"><p className="text-xs font-bold text-[#8a5b19]">قيّم نصك من 10 بعد مقارنته بالنموذج</p><div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-10" dir="ltr">{Array.from({ length: 10 }, (_, index) => index + 1).map(value => <button key={value} type="button" onClick={() => { setSelfScore(value); setSaved(false); }} className={`rounded-lg border py-2 text-sm font-bold ${selfScore === value ? "border-[#a76f22] bg-[#a76f22] text-white" : "border-[#e0c48f] bg-white text-[#8a5b19]"}`}>{value}</button>)}</div></div>}<Button onClick={finish} disabled={isSaving} className="mt-5 w-full bg-[#a76f22] hover:bg-[#8a5b19]">{saved ? <><CheckCircle2 className="ml-2 h-4 w-4" />تم حفظ المهمة</> : isSaving ? "جارٍ الحفظ..." : "احفظ مهمة الكتابة"}</Button></section></div></div>;
}
