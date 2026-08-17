import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bot, BookMarked, CheckCircle2, ExternalLink, FilePenLine, Lightbulb, MessageCircle, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const sourceUrl = "https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/past-continuous";
const comparisonUrl = "https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2/past-continuous-past-simple";
const questionBank = [
  { prompt: "While we ___ the actuator, the alarm went off.", choices: ["tested", "were testing", "have tested"], answer: 1 },
  { prompt: "The engineers ___ when the power failed.", choices: ["were calibrating", "calibrate", "are calibrating"], answer: 0 },
  { prompt: "When I arrived, the machine ___ normally.", choices: ["was operating", "operated", "has operated"], answer: 0 },
  { prompt: "We ___ a report when the client called.", choices: ["were writing", "wrote", "write"], answer: 0 },
  { prompt: "Which sentence is correct?", choices: ["I was knowing the result.", "I knew the result.", "I were knowing the result."], answer: 1 },
  { prompt: "The robot ___ slowly while we checked the signal.", choices: ["moved", "was moving", "moves"], answer: 1 },
  { prompt: "What ___ when the sensor stopped sending data?", choices: ["were you doing", "did you doing", "you were do"], answer: 0 },
  { prompt: "They ___ the prototype when they found the fault.", choices: ["were testing", "tested", "have tested"], answer: 0 },
  { prompt: "The technician ___ the wiring yesterday afternoon.", choices: ["was inspecting", "inspect", "is inspect"], answer: 0 },
  { prompt: "We ___ the project meeting because the server failed.", choices: ["were delaying", "delayed", "are delay"], answer: 1 },
  { prompt: "While the controller ___ data, the display froze.", choices: ["received", "was receiving", "has received"], answer: 1 },
  { prompt: "I ___ the voltage when I noticed the error.", choices: ["measured", "was measuring", "am measuring"], answer: 1 },
  { prompt: "Choose the best pair.", choices: ["We were testing / the alarm rang", "We tested / the alarm was ring", "We were test / the alarm rang"], answer: 0 },
  { prompt: "The team ___ a new motor at 3 p.m. yesterday.", choices: ["installed", "was installing", "has installed"], answer: 1 },
  { prompt: "When the client ___, we were discussing the risk.", choices: ["arrived", "was arriving", "arrives"], answer: 0 },
  { prompt: "Why ___ the system when the error appeared?", choices: ["did it run", "was it running", "it was run"], answer: 1 },
  { prompt: "The camera ___ an image when the cable disconnected.", choices: ["captured", "was capturing", "capture"], answer: 1 },
  { prompt: "We ___ a safety check before the workshop closed.", choices: ["were completing", "complete", "have completing"], answer: 0 },
  { prompt: "Which phrase describes an interrupted action?", choices: ["The test was running when the power went out.", "The test runs every day.", "The test has run."], answer: 0 },
  { prompt: "While I ___ the results, my supervisor asked a question.", choices: ["explained", "was explaining", "explain"], answer: 1 },
] as const;

const modeLimits = {
  steady: { label: "ثبات يومي", questions: 5, writingPrompts: 1 },
  balanced: { label: "تقدم متوازن", questions: 10, writingPrompts: 1 },
  intensive: { label: "تحدٍّ مكثف", questions: 20, writingPrompts: 2 },
} as const;

const writingPrompts = [
  "اكتب بالإنجليزية: ماذا كان فريقك يفعل عندما حدثت مشكلة في مستشعر؟",
  "اكتب بالإنجليزية: ماذا كنت تفعل في مشروع ميكاترونيك عندما لاحظت نتيجة غير متوقعة؟",
];

export default function Grammar() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const dashboard = trpc.learning.dashboard.get.useQuery(undefined, { enabled: isAuthenticated });
  const providerStatus = trpc.learning.writing.providerStatus.useQuery(undefined, { enabled: isAuthenticated });
  const mode = dashboard.data?.profile.studyMode as keyof typeof modeLimits | undefined;
  const limits = modeLimits[mode ?? "balanced"];
  const questions = useMemo(() => questionBank.slice(0, limits.questions), [limits.questions]);
  const [answers, setAnswers] = useState<Array<number | null>>([]);
  const [productions, setProductions] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<{ score: number; correctedText: string; explanationArabic: string; strengths: string[]; priorities: string[] } | null>(null);
  const attempt = trpc.learning.diagnostic.submit.useMutation();
  const complete = trpc.learning.tasks.complete.useMutation();
  const correction = trpc.learning.writing.correct.useMutation();
  const taskId = dashboard.data?.tasks.find(task => task.skill === "grammar")?.id;
  const result = useMemo(() => ({ correct: answers.reduce<number>((total, choice, index) => total + (choice === questions[index]?.answer ? 1 : 0), 0), total: questions.length }), [answers, questions]);

  useEffect(() => { setAnswers(Array.from({ length: limits.questions }, () => null)); setProductions(Array.from({ length: limits.writingPrompts }, () => "")); setSubmitted(false); setFeedback(null); }, [limits.questions, limits.writingPrompts]);

  async function requestCorrection() {
    const combined = productions.filter(Boolean).join("\n\n");
    if (!isAuthenticated) return toast.info("سجل دخولك لاستخدام التصحيح الخارجي الاختياري.");
    if (combined.trim().split(/\s+/).length < 8) return toast.error("اكتب 8 كلمات على الأقل قبل طلب التصحيح.");
    const response = await correction.mutateAsync({ text: combined, context: "Past continuous and past simple for an A2/B1 mechatronics learner." });
    if (!response.available) return toast.info(`التصحيح الخارجي غير مهيأ بعد. أضف: ${response.missing.join("، ")}`);
    setFeedback(response.feedback); toast.success("وصلت ملاحظات التصحيح من مزودك الخارجي.");
  }

  async function finishLesson() {
    const combined = productions.filter(Boolean).join("\n\n");
    if (!isAuthenticated) return toast.info("سجل دخولك لحفظ نتيجة القاعدة ضمن معايرتك.");
    if (answers.some(answer => answer === null) || productions.some(item => item.trim().split(/\s+/).length < 8)) return toast.error(`أجب عن ${limits.questions} سؤالًا واكتب ${limits.writingPrompts} تطبيقًا هندسيًا من 8 كلمات على الأقل.`);
    const objectiveScore = Math.round((result.correct / result.total) * 70);
    const score = objectiveScore + (feedback ? Math.round(feedback.score * .3) : 30);
    const response = feedback ? `${combined}\n\nAI correction:\n${feedback.correctedText}\n${feedback.explanationArabic}` : combined;
    await attempt.mutateAsync({ skill: "grammar", evidenceType: feedback ? "grammar-lesson-ai-review" : "grammar-lesson", prompt: questions.map((question, index) => `${index + 1}. ${question.prompt}`).join("\n"), response, score });
    if (taskId) await complete.mutateAsync({ taskId, completed: true });
    await utils.learning.dashboard.get.invalidate();
    setSubmitted(true); toast.success("تم تصحيح الاختيارات وحفظ دليل القاعدة.");
  }

  const configured = providerStatus.data?.configured ?? false;
  return <div className="mx-auto max-w-5xl space-y-6" dir="rtl">
    <section className="rounded-[28px] bg-[#f2eff9] p-6 sm:p-8"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#7652ad] text-white"><BookMarked className="h-6 w-6" /></div><div><p className="text-xs font-bold text-[#7652ad]">قاعدة اليوم · {limits.label}</p><h1 className="mt-1 text-3xl font-extrabold text-primary">الماضي المستمر مع الماضي البسيط</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-[#5c5572]">نستخدم <span dir="ltr" className="font-['DM_Sans'] font-bold">was/were + verb-ing</span> لوصف فعل كان مستمرًا، ثم الماضي البسيط للحدث القصير الذي قطعه. نمطك الحالي يطلب {limits.questions} سؤالًا و{limits.writingPrompts} تطبيقًا كتابيًا.</p></div></div></section>
    <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]"><section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-6"><h2 className="flex items-center gap-2 font-bold"><Lightbulb className="h-5 w-5 text-[#d79b28]" />كيف تفكر بها؟</h2><div className="mt-5 space-y-3 text-sm leading-7 text-[#425552]"><p><strong>الخلفية المستمرة:</strong> ما كان يحدث بالفعل.</p><p className="rounded-2xl bg-[#f8f7fc] p-3 font-['DM_Sans']" dir="ltr">We <b>were testing</b> the actuator …</p><p><strong>الحدث القصير:</strong> الشيء الذي وقع أو قطع المشهد.</p><p className="rounded-2xl bg-[#f8f7fc] p-3 font-['DM_Sans']" dir="ltr">… when the alarm <b>went off</b>.</p></div><div className="mt-6 flex flex-wrap gap-x-5 gap-y-2"><a href={sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-bold text-[#7652ad] underline underline-offset-4">مرجع الماضي المستمر <ExternalLink className="h-4 w-4" /></a><a href={comparisonUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-bold text-[#7652ad] underline underline-offset-4">مقارنة الماضيين <ExternalLink className="h-4 w-4" /></a></div><div className="mt-6 rounded-2xl border border-[#d8d0ec] bg-[#faf9fd] p-4"><div className="flex gap-2 text-[#7652ad]"><ShieldCheck className="h-5 w-5 shrink-0" /><p className="text-sm font-bold">كيف يُصحح الإنتاج الكتابي؟</p></div><p className="mt-2 text-xs leading-6 text-[#5c5572]">الاختيارات تصحح تلقائيًا. أما الكتابة فتراجع ذاتيًا افتراضيًا؛ وعند إضافة متغيرات مزودك الخارجي يظهر التصحيح الاختياري دون ارتباط بمزود محدد.</p><p className={`mt-3 text-xs font-bold ${configured ? "text-[#0d7a6e]" : "text-[#9b6816]"}`}>{configured ? "التصحيح الخارجي مهيأ وجاهز." : "التصحيح الخارجي غير مهيأ؛ المراجعة الذاتية متاحة."}</p></div></section>
      <section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-6"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><FilePenLine className="h-5 w-5 text-[#7652ad]" />اختبر استخدامك</h2><span className="rounded-lg bg-[#f2eff9] px-2 py-1 text-xs font-bold text-[#7652ad]">{result.correct}/{result.total} صحيح</span></div><div className="mt-5 space-y-5">{questions.map((question, questionIndex) => <div key={question.prompt} className="rounded-2xl border border-border bg-[#fcfdfb] p-4"><p dir="ltr" className="font-['DM_Sans'] text-sm font-semibold text-primary">{questionIndex + 1}. {question.prompt}</p><div className="mt-3 grid gap-2 sm:grid-cols-3" dir="ltr">{question.choices.map((choice, choiceIndex) => { const selected = answers[questionIndex] === choiceIndex; const isCorrect = question.answer === choiceIndex; const state = submitted ? isCorrect ? "border-[#77b892] bg-[#edf8f0] text-[#0d7a6e]" : selected ? "border-[#e4acac] bg-[#fff4f4] text-[#a54444]" : "border-border bg-white" : selected ? "border-[#7652ad] bg-[#f4f0fa] text-[#604095]" : "border-border bg-white"; return <button key={choice} onClick={() => setAnswers(current => current.map((answer, index) => index === questionIndex ? choiceIndex : answer))} className={`rounded-xl border px-3 py-2.5 text-left font-['DM_Sans'] text-xs ${state}`}>{choice}</button>; })}</div></div>)}</div><div className="mt-6 space-y-5 border-t border-border pt-5">{writingPrompts.slice(0, limits.writingPrompts).map((prompt, index) => <div key={prompt}><p className="flex items-center gap-2 text-sm font-bold"><MessageCircle className="h-4 w-4 text-[#7652ad]" />تطبيق كتابي {index + 1}</p><p className="mt-1 text-xs leading-6 text-muted-foreground">{prompt}</p><Textarea dir="ltr" value={productions[index] ?? ""} onChange={event => { setProductions(current => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value)); setFeedback(null); }} className="mt-3 min-h-28 text-left font-['DM_Sans']" placeholder="We were calibrating the sensor when..." /></div>)}</div><Button variant="outline" onClick={requestCorrection} disabled={correction.isPending} className="mt-4 w-full border-[#bba7dc] text-[#68499a] hover:bg-[#f7f3fc]"><Bot className="ml-2 h-4 w-4" />{correction.isPending ? "جارٍ طلب التصحيح..." : "اطلب تصحيحًا من مزودي الخارجي"}</Button>{feedback && <div className="mt-3 rounded-2xl bg-[#edf8f0] p-4"><p className="text-sm font-bold text-[#0d7a6e]">تصحيح اختياري · {feedback.score}/100</p><p className="mt-2 font-['DM_Sans'] text-sm text-primary" dir="ltr">{feedback.correctedText}</p><p className="mt-2 text-xs leading-6 text-[#425552]">{feedback.explanationArabic}</p></div>}<Button onClick={finishLesson} disabled={attempt.isPending || complete.isPending} className="mt-5 w-full bg-[#7652ad] hover:bg-[#68499a]">{submitted ? <><CheckCircle2 className="ml-2 h-4 w-4" />تم حفظ النتيجة</> : "صحح الاختيارات واحفظ التطبيق"}</Button></section></div>
  </div>;
}
