import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requestWritingCorrection, type WritingFeedback } from "@/lib/aiCorrection";
import { getTodayGrammarLesson } from "@/lib/localLessons";
import { getSupabase } from "@/lib/supabase";
import { useStudyMode } from "@/lib/studyMode";
import { completeSupabaseTaskByKey } from "@/lib/supabaseLearning";
import { Bot, BookMarked, CheckCircle2, ExternalLink, FilePenLine, Lightbulb, MessageCircle, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const selfReviewChecklist = [
  "هل استخدمت قاعدة درس اليوم في كل جملة؟",
  "هل يتوافق الفعل مع الفاعل (he works / they work)؟",
  "هل الزمن مناسب لما تصفه (الآن، عادةً، في الماضي)؟",
  "هل استخدمت مصطلحًا هندسيًا واحدًا على الأقل بشكل صحيح؟",
  "هل تبدأ الجملة بحرف كبير وتنتهي بنقطة؟",
];

type ParsedQuestion = { prompt: string; choices: string[]; answer: number };

function parseGrammarLesson(markdown: string) {
  const explanation = markdown.split(/20 أسئلة اختيار|أسئلة اختيار من ثلاثة خيارات/)[0]?.trim() ?? markdown;
  const questions = Array.from(markdown.matchAll(/\d+[.)]\s*(.+?)\nA\)\s*(.+?)\nB\)\s*(.+?)\nC\)\s*(.+?)\nAnswer:\s*([ABC])/g)).map(([, prompt, a, b, c, answer]) => ({
    prompt: prompt.trim(), choices: [a.trim(), b.trim(), c.trim()], answer: "ABC".indexOf(answer),
  } satisfies ParsedQuestion));
  const writingSection = markdown.match(/(?:سؤالان للكتابة الهندسية(?: \(قصيرة\))?|مهمتان قصيرتان للكتابة الهندسية|(?:مهام?|مهمات) كتابة قصيرة|كتابة قصيرة(?: \([^)]*\))?)\s*:?\s*\n([\s\S]*?)(?:\n\n(?:مراجع|ملاحظة|تلميح|تذكير)|$)/)?.[1] ?? "";
  const extractedPrompts = Array.from(writingSection.matchAll(/(?:^|\n)\d+[.)]\s*(.+)/g)).map(([, prompt]) => prompt.trim()).filter(Boolean);
  const writingPrompts = extractedPrompts.length ? extractedPrompts.slice(0, 2) : ["Write one short engineering sentence that applies today's grammar lesson."];
  return { explanation, questions, writingPrompts };
}

export default function Grammar() {
  const { isAuthenticated, user } = useAuth();
  const { settings: mode } = useStudyMode(user?.id);
  const limits = { label: mode.label, questions: mode.grammarQuestions, writingPrompts: mode.grammarPrompts };
  const grammarItem = useMemo(() => {
    const item = getTodayGrammarLesson();
    return { task: { id: "grammar" }, content: item };
  }, [user?.id]);
  const lesson = useMemo(() => parseGrammarLesson(grammarItem.content.contentMarkdown), [grammarItem]);
  const questions = useMemo(() => lesson.questions.slice(0, limits.questions), [lesson.questions, limits.questions]);
  const prompts = useMemo(() => lesson.writingPrompts.slice(0, limits.writingPrompts), [lesson.writingPrompts, limits.writingPrompts]);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [productions, setProductions] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [selfReviewOpen, setSelfReviewOpen] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const grammarTitle = grammarItem.content.titleEnglish;
  const taskId = grammarItem?.task.id;
  const [isSaving, setIsSaving] = useState(false);
  const result = useMemo(() => ({ correct: answers.reduce<number>((total, choice, index) => total + (choice === questions[index]?.answer ? 1 : 0), 0), total: questions.length }), [answers, questions]);

  useEffect(() => {
    setAnswers(Array.from({ length: questions.length }, () => null));
    setProductions(Array.from({ length: prompts.length }, () => ""));
    setSubmitted(false); setFeedback(null); setSelfReviewOpen(false);
  }, [grammarItem?.content.id, questions.length, prompts.length]);

  async function requestCorrection() {
    const combined = productions.filter(Boolean).join("\n\n");
    if (combined.trim().split(/\s+/).length < 8) return toast.error("اكتب 8 كلمات على الأقل قبل طلب التصحيح.");
    setIsCorrecting(true);
    const aiFeedback = await requestWritingCorrection(combined, `Grammar lesson: ${grammarTitle}`);
    setIsCorrecting(false);
    setFeedback(aiFeedback);
    setSelfReviewOpen(!aiFeedback);
    if (aiFeedback) toast.success("وصل التصحيح الذكي لتطبيقك الكتابي.");
    else toast.info("التصحيح الذكي غير مفعّل حاليًا؛ استخدم قائمة المراجعة الذاتية.");
  }

  async function finishLesson() {
    const combined = productions.filter(Boolean).join("\n\n");
    if (!taskId || questions.length === 0) return toast.error("يتم تجهيز درس اليوم المحلي؛ أعد المحاولة بعد لحظة.");
    if (answers.some(answer => answer === null) || productions.some(item => item.trim().split(/\s+/).length < 8)) return toast.error(`أجب عن ${questions.length} سؤالًا واكتب ${prompts.length} تطبيقًا هندسيًا من 8 كلمات على الأقل.`);
    // Only measured evidence counts: the multiple-choice result, plus the AI score when a real correction exists.
    const objectiveRatio = result.correct / result.total;
    const score = feedback ? Math.round(objectiveRatio * 70 + feedback.score * .3) : Math.round(objectiveRatio * 100);
    if (!user?.id) return toast.error("تعذر تحديد حسابك.");
    setIsSaving(true);
    const supabase: any = getSupabase();
    const created = await supabase.from("diagnostic_attempts").insert({ user_id: user.id, skill: "grammar", evidence_type: feedback ? "grammar-local-ai-correction" : "grammar-local-lesson", prompt: questions.map((question, index) => `${index + 1}. ${question.prompt}`).join("\n"), response: combined, score });
    const completed = await completeSupabaseTaskByKey(user.id, taskId).then(() => ({ error: null })).catch(error => ({ error }));
    setIsSaving(false);
    if (created.error || completed.error) return toast.error(created.error?.message ?? completed.error?.message ?? "تعذر حفظ نتيجة القواعد.");
    setSubmitted(true); toast.success("تم تصحيح الاختيارات وحفظ درس القواعد المحلي للمراجعة القادمة.");
  }

  const configured = false;
  if (!isAuthenticated) return <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 text-center soft-shadow" dir="rtl"><h1 className="text-2xl font-extrabold text-primary">سجّل دخولك لبدء درس القواعد المحلي</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">تُنشأ خطة اليوم وسجل منع التكرار لكل متعلم بعد تسجيل الدخول.</p></div>;
  if (!grammarItem || questions.length === 0) return <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 text-center soft-shadow" dir="rtl">لا يتوفر درس قواعد صالح لليوم بعد. افتح لوحة اليوم ثم حاول مجددًا.</div>;

  return <div className="mx-auto max-w-5xl space-y-6" dir="rtl">
    <section className="rounded-[28px] bg-[#f2eff9] p-6 sm:p-8"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#7652ad] text-white"><BookMarked className="h-6 w-6" /></div><div><p className="text-xs font-bold text-[#7652ad]">قاعدة اليوم المحلية · {limits.label}</p><h1 className="mt-1 text-3xl font-extrabold text-primary">{grammarItem.content.titleArabic}</h1><p className="mt-3 text-sm leading-7 text-[#5c5572]">هذا الدرس محفوظ داخل مكتبتك المحلية. نمطك الحالي يطلب {questions.length} سؤالًا و{prompts.length} تطبيقًا كتابيًا.</p></div></div></section>
    <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]"><section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-6"><h2 className="flex items-center gap-2 font-bold"><Lightbulb className="h-5 w-5 text-[#d79b28]" />شرح القاعدة بالعربية</h2><div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[#425552]">{lesson.explanation}</div><div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">{grammarItem.content.sourceUrls.map(url => <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-bold text-[#7652ad] underline underline-offset-4">مرجع موثوق <ExternalLink className="h-4 w-4" /></a>)}</div><div className="mt-6 rounded-2xl border border-[#d8d0ec] bg-[#faf9fd] p-4"><div className="flex gap-2 text-[#7652ad]"><ShieldCheck className="h-5 w-5 shrink-0" /><p className="text-sm font-bold">كيف يُصحح الإنتاج الكتابي؟</p></div><p className="mt-2 text-xs leading-6 text-[#5c5572]">الاختيارات تصحح تلقائيًا. أما الكتابة فتراجع ذاتيًا افتراضيًا؛ وعند إعداد مزودك الخارجي يظهر التصحيح الاختياري دون ارتباط بمزود محدد.</p><p className={`mt-3 text-xs font-bold ${configured ? "text-[#0d7a6e]" : "text-[#9b6816]"}`}>{configured ? "التصحيح الخارجي مهيأ وجاهز." : "التصحيح الخارجي غير مهيأ؛ المراجعة الذاتية متاحة."}</p></div></section>
      <section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-6"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><FilePenLine className="h-5 w-5 text-[#7652ad]" />اختبر استخدامك</h2><span className="rounded-lg bg-[#f2eff9] px-2 py-1 text-xs font-bold text-[#7652ad]">{result.correct}/{result.total} صحيح</span></div><div className="mt-5 space-y-5">{questions.map((question, questionIndex) => <div key={questionIndex} className="rounded-2xl border border-border bg-[#fcfdfb] p-4"><p dir="ltr" className="font-['DM_Sans'] text-sm font-semibold text-primary">{questionIndex + 1}. {question.prompt}</p><div className="mt-3 grid gap-2 sm:grid-cols-3" dir="ltr">{question.choices.map((choice, choiceIndex) => { const selected = answers[questionIndex] === choiceIndex; const isCorrect = question.answer === choiceIndex; const state = submitted ? isCorrect ? "border-[#77b892] bg-[#edf8f0] text-[#0d7a6e]" : selected ? "border-[#e4acac] bg-[#fff4f4] text-[#a54444]" : "border-border bg-white" : selected ? "border-[#7652ad] bg-[#f4f0fa] text-[#604095]" : "border-border bg-white"; return <button key={choice} onClick={() => setAnswers(current => current.map((answer, index) => index === questionIndex ? choiceIndex : answer))} className={`rounded-xl border px-3 py-2.5 text-left font-['DM_Sans'] text-xs ${state}`}>{choice}</button>; })}</div></div>)}</div><div className="mt-6 space-y-5 border-t border-border pt-5">{prompts.map((prompt, index) => <div key={index}><p className="flex items-center gap-2 text-sm font-bold"><MessageCircle className="h-4 w-4 text-[#7652ad]" />تطبيق كتابي {index + 1}</p><p className="mt-1 text-xs leading-6 text-muted-foreground">{prompt}</p><Textarea dir="ltr" value={productions[index] ?? ""} onChange={event => { setProductions(current => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value)); setFeedback(null); setSelfReviewOpen(false); }} className="mt-3 min-h-28 text-left font-['DM_Sans']" placeholder="Write a short engineering sentence in English…" /></div>)}</div><Button variant="outline" onClick={requestCorrection} disabled={isCorrecting} className="mt-4 w-full border-[#bba7dc] text-[#68499a] hover:bg-[#f7f3fc]"><Bot className="ml-2 h-4 w-4" />{isCorrecting ? "جارٍ طلب التصحيح..." : "راجع تطبيقي الكتابي"}</Button>{feedback && <div className="mt-3 rounded-2xl bg-[#edf8f0] p-4"><p className="text-sm font-bold text-[#0d7a6e]">تصحيح ذكي · {feedback.score}/100</p><p className="mt-2 font-['DM_Sans'] text-sm text-primary" dir="ltr">{feedback.correctedText}</p><p className="mt-2 text-xs leading-6 text-[#425552]">{feedback.explanationArabic}</p>{feedback.priorities.length > 0 && <ul className="mt-2 list-disc space-y-1 pr-5 text-xs leading-6 text-[#425552]">{feedback.priorities.map(item => <li key={item}>{item}</li>)}</ul>}</div>}{selfReviewOpen && <div className="mt-3 rounded-2xl bg-[#f7f3fc] p-4"><p className="text-sm font-bold text-[#68499a]">مراجعة ذاتية موجهة</p><ul className="mt-2 list-disc space-y-1 pr-5 text-xs leading-6 text-[#425552]">{selfReviewChecklist.map(item => <li key={item}>{item}</li>)}</ul><p className="mt-2 text-xs leading-6 text-muted-foreground">لا تُمنح علامة على المراجعة الذاتية؛ تُحسب نتيجة الدرس من أسئلة الاختيار فقط.</p></div>}<Button onClick={finishLesson} disabled={isSaving} className="mt-5 w-full bg-[#7652ad] hover:bg-[#68499a]">{submitted ? <><CheckCircle2 className="ml-2 h-4 w-4" />تم حفظ النتيجة</> : isSaving ? "جارٍ الحفظ..." : "صحح الاختيارات واحفظ التطبيق"}</Button></section></div>
  </div>;
}
