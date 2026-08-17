import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bot, CheckCircle2, FilePenLine, Lightbulb, ListChecks } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const sentencesByMode = { steady: 1, balanced: 3, intensive: 5 } as const;

function parseWritingLesson(markdown: string) {
  const brief = markdown.match(/موجز بالعربية:\s*([\s\S]*?)\n\nTarget length/mi)?.[1]?.trim() ?? "اكتب المهمة التالية بالإنجليزية.";
  const vocabulary = (markdown.match(/Target vocabulary:\s*([\s\S]*?)\n\nModel answer/mi)?.[1] ?? "").split(/\n|,/).map(item => item.replace(/^-\s*/, "").trim()).filter(Boolean);
  const modelAnswer = markdown.match(/Model answer \(English\):\s*([\s\S]*?)\n\nالترجمة العربية/mi)?.[1]?.trim() ?? "";
  const modelArabic = markdown.match(/الترجمة العربية للنموذج:\s*([\s\S]*?)\n\nSelf-check rubric/mi)?.[1]?.trim() ?? "";
  const rubric = Array.from((markdown.match(/Self-check rubric:\s*([\s\S]*)$/mi)?.[1] ?? "").matchAll(/-\s*(.+)/g)).map(([, item]) => item.trim());
  return { brief, vocabulary, modelAnswer, modelArabic, rubric };
}

export default function Writing() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const dashboard = trpc.learning.dashboard.get.useQuery(undefined, { enabled: isAuthenticated });
  const contentToday = trpc.learning.content.today.useQuery(undefined, { enabled: isAuthenticated });
  const providerStatus = trpc.learning.writing.providerStatus.useQuery(undefined, { enabled: isAuthenticated });
  const writingItem = contentToday.data?.items.find(item => item.task.skill === "writing");
  const mode = dashboard.data?.profile.studyMode as keyof typeof sentencesByMode | undefined;
  const sentenceTarget = sentencesByMode[mode ?? "balanced"];
  const lesson = useMemo(() => writingItem ? parseWritingLesson(writingItem.content.contentMarkdown) : { brief: "", vocabulary: [], modelAnswer: "", modelArabic: "", rubric: [] }, [writingItem]);
  const [text, setText] = useState("");
  const [checks, setChecks] = useState<boolean[]>([]);
  const [feedback, setFeedback] = useState<{ score: number; correctedText: string; explanationArabic: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const correction = trpc.learning.writing.correct.useMutation();
  const attempt = trpc.learning.diagnostic.submit.useMutation();
  const complete = trpc.learning.tasks.complete.useMutation();
  const sentenceCount = text.split(/[.!?]+/).filter(item => item.trim()).length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  async function requestCorrection() {
    if (wordCount < 8) return toast.error("اكتب 8 كلمات على الأقل قبل طلب التصحيح.");
    const response = await correction.mutateAsync({ text, context: `${writingItem?.content.titleEnglish ?? "Professional writing"} for an A2/B1 mechatronics learner.` });
    if (!response.available) return toast.info(`التصحيح الخارجي غير مهيأ بعد. أضف: ${response.missing.join("، ")}`);
    setFeedback(response.feedback); toast.success("وصلت ملاحظات التصحيح من مزودك الخارجي.");
  }

  async function finish() {
    if (!writingItem) return toast.error("يتم تجهيز مهمة الكتابة المحلية؛ أعد المحاولة بعد لحظة.");
    if (wordCount < 8 || sentenceCount < sentenceTarget) return toast.error(`اكتب ${sentenceTarget} ${sentenceTarget === 1 ? "جملة" : "جمل"} على الأقل وبحد أدنى 8 كلمات.`);
    if (lesson.rubric.length && checks.filter(Boolean).length < lesson.rubric.length) return toast.error("أكمل التحقق الذاتي قبل حفظ المهمة.");
    const score = feedback?.score ?? Math.min(80, 45 + wordCount * 2 + sentenceCount * 5);
    await attempt.mutateAsync({ skill: "writing", evidenceType: feedback ? "local-writing-ai-review" : "local-writing-self-review", prompt: writingItem.content.titleEnglish, response: feedback ? `${text}\n\nAI correction:\n${feedback.correctedText}` : text, score });
    await complete.mutateAsync({ taskId: writingItem.task.id, completed: true });
    await Promise.all([utils.learning.dashboard.get.invalidate(), utils.learning.content.today.invalidate()]);
    setSaved(true); toast.success("تم حفظ مهمة الكتابة المحلية ضمن تقدمك.");
  }

  if (!isAuthenticated) return <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 text-center soft-shadow" dir="rtl"><h1 className="text-2xl font-extrabold text-primary">سجّل دخولك لبدء مهمة الكتابة المحلية</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">ستحصل على مهمة مناسبة لنمطك مع نموذج ومراجعة ذاتية وتقدم محفوظ.</p></div>;
  if (contentToday.isLoading || dashboard.isLoading) return <div className="mx-auto max-w-5xl p-8 text-center text-muted-foreground" dir="rtl">يتم تجهيز مهمة الكتابة المحلية…</div>;
  if (!writingItem) return <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 text-center soft-shadow" dir="rtl">لا تتوفر مهمة كتابة صالحة لليوم بعد. افتح لوحة اليوم ثم حاول مجددًا.</div>;
  return <div className="mx-auto max-w-5xl space-y-6" dir="rtl"><section className="rounded-[28px] bg-[#f8f1e5] p-6 sm:p-8"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#a76f22] text-white"><FilePenLine className="h-6 w-6" /></div><div><p className="text-xs font-bold text-[#9b6816]">كتابة اليوم المحلية · {sentenceTarget} {sentenceTarget === 1 ? "جملة" : "جمل"}</p><h1 className="mt-1 text-3xl font-extrabold text-primary">{writingItem.content.titleArabic}</h1><p className="mt-3 text-sm leading-7 text-[#725c38]">المهمة والنموذج ومعايير المراجعة محفوظة محليًا، ويمكنك التصحيح الاختياري بمزودك الخارجي عند إعداده.</p></div></div></section><div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><section className="rounded-[24px] bg-white p-5 soft-shadow"><h2 className="flex items-center gap-2 font-bold"><Lightbulb className="h-5 w-5 text-[#d79b28]" />المطلوب منك</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{lesson.brief}</p><p className="mt-6 text-sm font-bold">مفردات مقترحة</p><div className="mt-3 flex flex-wrap gap-2">{lesson.vocabulary.map(word => <span key={word} dir="ltr" className="rounded-lg bg-[#f8f1e5] px-2 py-1 font-['DM_Sans'] text-xs font-bold text-[#8a5b19]">{word}</span>)}</div><details className="mt-6 rounded-2xl bg-[#f7f8f5] p-4"><summary className="cursor-pointer text-sm font-bold">اعرض نموذجًا للمراجعة بعد الكتابة</summary><p dir="ltr" className="mt-3 font-['DM_Sans'] text-sm leading-7 text-primary">{lesson.modelAnswer}</p><p className="mt-3 text-xs leading-6 text-muted-foreground">{lesson.modelArabic}</p></details></section><section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-6"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><FilePenLine className="h-5 w-5 text-[#a76f22]" />مسودتك</h2><span className="text-xs font-bold text-muted-foreground">{sentenceCount}/{sentenceTarget} جمل · {wordCount} كلمة</span></div><Textarea dir="ltr" value={text} onChange={event => { setText(event.target.value); setFeedback(null); setSaved(false); }} className="mt-5 min-h-56 text-left font-['DM_Sans']" placeholder="Write your professional English response here…" /><Button variant="outline" onClick={requestCorrection} disabled={correction.isPending || !providerStatus.data?.configured} className="mt-4 w-full border-[#e0c48f] text-[#8a5b19] hover:bg-[#f8f1e5]"><Bot className="ml-2 h-4 w-4" />{providerStatus.data?.configured ? correction.isPending ? "جارٍ طلب التصحيح..." : "اطلب تصحيحًا من مزودي الخارجي" : "التصحيح الخارجي غير مهيأ"}</Button>{feedback && <div className="mt-3 rounded-2xl bg-[#edf8f0] p-4"><p className="text-sm font-bold text-[#0d7a6e]">تصحيح اختياري · {feedback.score}/100</p><p dir="ltr" className="mt-2 font-['DM_Sans'] text-sm text-primary">{feedback.correctedText}</p><p className="mt-2 text-xs leading-6 text-[#425552]">{feedback.explanationArabic}</p></div>}<div className="mt-6 border-t border-border pt-5"><h3 className="flex items-center gap-2 text-sm font-bold"><ListChecks className="h-4 w-4 text-[#a76f22]" />تحقق ذاتي</h3><div className="mt-3 space-y-3">{lesson.rubric.map((item, index) => <label key={item} className="flex cursor-pointer items-start gap-3 text-xs leading-6 text-muted-foreground"><Checkbox checked={checks[index] ?? false} onCheckedChange={value => setChecks(current => { const next = [...current]; next[index] = Boolean(value); return next; })} /><span>{item}</span></label>)}</div></div><Button onClick={finish} disabled={attempt.isPending || complete.isPending} className="mt-5 w-full bg-[#a76f22] hover:bg-[#8a5b19]">{saved ? <><CheckCircle2 className="ml-2 h-4 w-4" />تم حفظ المهمة</> : "احفظ مهمة الكتابة"}</Button></section></div></div>;
}
