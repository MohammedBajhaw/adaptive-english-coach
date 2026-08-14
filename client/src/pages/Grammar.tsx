import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { BookMarked, CheckCircle2, ExternalLink, FilePenLine, Lightbulb, MessageCircle, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const sourceUrl = "https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/past-continuous";
const comparisonUrl = "https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2/past-continuous-past-simple";
const questions = [
  { prompt: "While we ___ the actuator, the alarm went off.", choices: ["tested", "were testing", "have tested"], answer: 1 },
  { prompt: "The engineers ___ when the power failed.", choices: ["were calibrating", "calibrate", "are calibrating"], answer: 0 },
  { prompt: "When I arrived, the machine ___ normally.", choices: ["was operating", "operated", "has operated"], answer: 0 },
  { prompt: "We ___ a report when the client called.", choices: ["were writing", "wrote", "write"], answer: 0 },
  { prompt: "Which sentence is correct?", choices: ["I was knowing the result.", "I knew the result.", "I were knowing the result."], answer: 1 },
] as const;

export default function Grammar() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const dashboard = trpc.learning.dashboard.get.useQuery(undefined, { enabled: isAuthenticated });
  const [answers, setAnswers] = useState<Array<number | null>>([null, null, null, null, null]);
  const [production, setProduction] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const attempt = trpc.learning.diagnostic.submit.useMutation();
  const complete = trpc.learning.tasks.complete.useMutation();
  const taskId = dashboard.data?.tasks.find(task => task.skill === "grammar")?.id;
  const result = useMemo(() => ({ correct: answers.reduce<number>((total, choice, index) => total + (choice === questions[index]?.answer ? 1 : 0), 0), total: questions.length }), [answers]);
  async function finishLesson() {
    if (!isAuthenticated) { toast.info("سجل دخولك لحفظ نتيجة القاعدة ضمن معايرتك."); return; }
    if (answers.some(answer => answer === null) || production.trim().split(/\s+/).length < 8) { toast.error("أجب عن الأسئلة الخمسة واكتب جملة هندسية من 8 كلمات على الأقل."); return; }
    const score = Math.round((result.correct / result.total) * 70) + 30;
    await attempt.mutateAsync({ skill: "grammar", evidenceType: "grammar-lesson", prompt: questions.map((question, index) => `${index + 1}. ${question.prompt}`).join("\n"), response: production, score });
    if (taskId) await complete.mutateAsync({ taskId, completed: true });
    await utils.learning.dashboard.get.invalidate();
    setSubmitted(true); toast.success("تم تصحيح الاختيارات وحفظ دليل القاعدة.");
  }
  return <div className="mx-auto max-w-5xl space-y-6" dir="rtl"><section className="rounded-[28px] bg-[#f2eff9] p-6 sm:p-8"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#7652ad] text-white"><BookMarked className="h-6 w-6" /></div><div><p className="text-xs font-bold text-[#7652ad]">قاعدة اليوم · شرح عربي</p><h1 className="mt-1 text-3xl font-extrabold text-primary">الماضي المستمر مع الماضي البسيط</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-[#5c5572]">نستخدم <span dir="ltr" className="font-['DM_Sans'] font-bold">was/were + verb-ing</span> لوصف فعل كان مستمرًا في لحظة بالماضي، ثم نستخدم الماضي البسيط للحدث القصير الذي قطعه أو وقع أثناءه.</p></div></div></section><div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]"><section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-6"><h2 className="flex items-center gap-2 font-bold"><Lightbulb className="h-5 w-5 text-[#d79b28]" />كيف تفكر بها؟</h2><div className="mt-5 space-y-3 text-sm leading-7 text-[#425552]"><p><strong>الخلفية المستمرة:</strong> ما كان يحدث بالفعل.</p><p className="rounded-2xl bg-[#f8f7fc] p-3 font-['DM_Sans']" dir="ltr">We <b>were testing</b> the actuator …</p><p><strong>الحدث القصير:</strong> الشيء الذي وقع أو قطع المشهد.</p><p className="rounded-2xl bg-[#f8f7fc] p-3 font-['DM_Sans']" dir="ltr">… when the alarm <b>went off</b>.</p><p>لا نستخدم الماضي المستمر عادة مع أفعال الحالة مثل <span dir="ltr" className="font-['DM_Sans']">know, need, believe</span>.</p></div><div className="mt-6 flex flex-wrap gap-x-5 gap-y-2"><a href={sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-bold text-[#7652ad] underline underline-offset-4">مرجع الماضي المستمر <ExternalLink className="h-4 w-4" /></a><a href={comparisonUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-bold text-[#7652ad] underline underline-offset-4">مقارنة الماضيين <ExternalLink className="h-4 w-4" /></a></div><div className="mt-6 rounded-2xl border border-[#d8d0ec] bg-[#faf9fd] p-4"><div className="flex gap-2 text-[#7652ad]"><ShieldCheck className="h-5 w-5 shrink-0" /><p className="text-sm font-bold">كيف يُصحح السطر الكتابي؟</p></div><p className="mt-2 text-xs leading-6 text-[#5c5572]">الاختيارات الخمسة تصحح تلقائيًا داخل التطبيق. أما إجابتك الكتابية فتظهر لك حاليًا مع قائمة مراجعة ذاتية، ولا تُرسل إلى أي واجهة ذكاء اصطناعي. يمكن إضافة تصحيح اختياري بالذكاء الاصطناعي لاحقًا بعد موافقتك واختيار التكامل.</p></div></section><section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-6"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><FilePenLine className="h-5 w-5 text-[#7652ad]" />اختبر استخدامك</h2><span className="rounded-lg bg-[#f2eff9] px-2 py-1 text-xs font-bold text-[#7652ad]">{result.correct}/{result.total} صحيح</span></div><div className="mt-5 space-y-5">{questions.map((question, questionIndex) => <div key={question.prompt} className="rounded-2xl border border-border bg-[#fcfdfb] p-4"><p dir="ltr" className="font-['DM_Sans'] text-sm font-semibold text-primary">{questionIndex + 1}. {question.prompt}</p><div className="mt-3 grid gap-2 sm:grid-cols-3" dir="ltr">{question.choices.map((choice, choiceIndex) => { const selected = answers[questionIndex] === choiceIndex; const isCorrect = question.answer === choiceIndex; const state = submitted ? isCorrect ? "border-[#77b892] bg-[#edf8f0] text-[#0d7a6e]" : selected ? "border-[#e4acac] bg-[#fff4f4] text-[#a54444]" : "border-border bg-white" : selected ? "border-[#7652ad] bg-[#f4f0fa] text-[#604095]" : "border-border bg-white"; return <button key={choice} onClick={() => setAnswers(current => current.map((answer, index) => index === questionIndex ? choiceIndex : answer))} className={`rounded-xl border px-3 py-2.5 text-left font-['DM_Sans'] text-xs ${state}`}>{choice}</button>; })}</div></div>)}</div><div className="mt-6 border-t border-border pt-5"><p className="flex items-center gap-2 text-sm font-bold"><MessageCircle className="h-4 w-4 text-[#7652ad]" />سؤال كتابي واحد</p><p className="mt-1 text-xs leading-6 text-muted-foreground">اكتب بالإنجليزية: ماذا كان فريقك يفعل عندما حدثت مشكلة؟ بعد الكتابة راجع بنفسك: هل استخدمت <span dir="ltr">was/were + verb-ing</span> للفعل المستمر و<span dir="ltr">past simple</span> للحدث القصير؟</p><Textarea dir="ltr" value={production} onChange={event => setProduction(event.target.value)} className="mt-3 min-h-28 text-left font-['DM_Sans']" placeholder="We were calibrating the sensor when..." /></div><Button onClick={finishLesson} disabled={attempt.isPending || complete.isPending} className="mt-5 w-full bg-[#7652ad] hover:bg-[#68499a]">{submitted ? <><CheckCircle2 className="ml-2 h-4 w-4" />تم حفظ النتيجة</> : "صحح الاختيارات واحفظ التطبيق"}</Button></section></div></div>;
}
