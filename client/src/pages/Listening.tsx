import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ExternalLink, Headphones, Lightbulb, ListChecks } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const fallbackPlan = { title: "Office English: Pitching", label: "عرض فكرة مهنية", source: "BBC Learning English For Work", url: "https://www.bbc.com/audio/brand/p0h6ffwg", question: "What is the main communication skill in today’s episode?", choices: ["Pitching an idea", "Asking for a taxi", "Booking a hotel"], answer: 0, phraseHint: "e.g. I would like to suggest..." };
const modeLimits = { steady: { label: "ثبات يومي", minutes: 1, questions: 2 }, balanced: { label: "تقدم متوازن", minutes: 2, questions: 4 }, intensive: { label: "تحدٍّ مكثف", minutes: 4, questions: 6 } } as const;
const reflectionPrompts = [
  "من المتحدث أو ما هو السياق الذي فهمته؟",
  "ما المشكلة أو الفكرة الرئيسية التي سمعتها؟",
  "ما الحل أو الخطوة التي اقترحها المتحدث؟",
  "اكتب تفصيلًا واحدًا يدعم الفكرة الرئيسية.",
  "اكتب عبارة مهنية أو تقنية التقطتها من المقطع.",
];

export default function Listening() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const dashboard = trpc.learning.dashboard.get.useQuery(undefined, { enabled: isAuthenticated });
  const mode = dashboard.data?.profile.studyMode as keyof typeof modeLimits | undefined;
  const limits = modeLimits[mode ?? "balanced"];
  const [choice, setChoice] = useState<number | null>(null);
  const [responses, setResponses] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const plan = dashboard.data?.dailyContent.listening ?? fallbackPlan;
  const attempt = trpc.learning.diagnostic.submit.useMutation();
  const complete = trpc.learning.tasks.complete.useMutation();
  const taskId = dashboard.data?.tasks.find(task => task.skill === "listening")?.id;
  const requiredReflections = useMemo(() => reflectionPrompts.slice(0, limits.questions - 1), [limits.questions]);
  useEffect(() => { setChoice(null); setResponses(Array.from({ length: limits.questions - 1 }, () => "")); setSaved(false); }, [limits.questions, plan.title]);

  async function finish() {
    if (!isAuthenticated) return toast.info("سجل دخولك لحفظ نتيجة الاستماع.");
    if (choice === null || responses.some(item => !item.trim())) return toast.error(`أجب عن ${limits.questions} أسئلة واكتب إجاباتك المختصرة قبل الحفظ.`);
    const reflectionScore = Math.round((responses.filter(item => item.trim().split(/\s+/).length >= 2).length / responses.length) * 35);
    const score = (choice === plan.answer ? 60 : 20) + reflectionScore;
    const response = [plan.question, ...requiredReflections].map((question, index) => `${index + 1}. ${question}\n${index === 0 ? plan.choices[choice] : responses[index - 1]}`).join("\n\n");
    await attempt.mutateAsync({ skill: "listening", evidenceType: "daily-listening", prompt: `${plan.source}: ${plan.title} · ${limits.label}`, response, score });
    if (taskId) await complete.mutateAsync({ taskId, completed: true });
    await utils.learning.dashboard.get.invalidate(); setSaved(true); toast.success("تم تسجيل دليل الاستماع وإكمال المهمة.");
  }

  return <div className="mx-auto max-w-5xl space-y-6" dir="rtl"><section className="rounded-[28px] bg-[#edf5f4] p-6 sm:p-8"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#14746d] text-white"><Headphones className="h-6 w-6" /></div><div><p className="text-xs font-bold text-[#0d7a6e]">استماع اليوم · {limits.label}</p><h1 className="mt-1 text-3xl font-extrabold text-primary">استمع لهدف واضح، لا كصوت في الخلفية.</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-[#46665e]">ركز على نحو {limits.minutes} دقيقة من المصدر، ثم أجب عن {limits.questions} أسئلة. إن كان المقطع أقصر، استمع إليه كاملًا وكرره بدلًا من تمديده.</p></div></div></section><div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><section className="rounded-[24px] bg-white p-5 soft-shadow"><h2 className="flex items-center gap-2 font-bold"><Lightbulb className="h-5 w-5 text-[#d79b28]" />خطة الاستماع</h2><ol className="mt-5 list-decimal space-y-3 pr-5 text-sm leading-7 text-muted-foreground"><li>افتح المصدر واختر حلقة <strong dir="ltr">{plan.title}</strong>.</li><li>استمع للفكرة العامة خلال أول {limits.minutes} دقيقة تقريبًا.</li><li>أعد الجزء نفسه لالتقاط التفاصيل والعبارات.</li></ol><a href={plan.url} target="_blank" rel="noreferrer" className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-[#0e3131]">فتح المصدر <ExternalLink className="h-4 w-4" /></a></section><section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-6"><h2 className="flex items-center gap-2 font-bold"><ListChecks className="h-5 w-5 text-[#14746d]" />تحقق من الفهم</h2><div className="mt-5"><p className="text-sm font-semibold text-primary">1. {plan.question}</p><div className="mt-3 space-y-2" dir="ltr">{plan.choices.map((item, index) => <button key={item} onClick={() => setChoice(index)} className={`w-full rounded-xl border px-3 py-3 text-left font-['DM_Sans'] text-sm ${choice === index ? "border-[#14746d] bg-[#ecf6f5] text-[#0d635e]" : "border-border bg-[#fcfdfb]"}`}>{choice === index ? "✓ " : "○ "}{item}</button>)}</div></div><div className="mt-6 space-y-4">{requiredReflections.map((prompt, index) => <label key={prompt} className="block"><span className="block text-sm font-bold">{index + 2}. {prompt}</span>{index === requiredReflections.length - 1 ? <Input dir="ltr" value={responses[index] ?? ""} onChange={event => setResponses(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="mt-2 text-left font-['DM_Sans']" placeholder={plan.phraseHint} /> : <Textarea dir="ltr" value={responses[index] ?? ""} onChange={event => setResponses(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} className="mt-2 min-h-20 text-left font-['DM_Sans']" placeholder="Write a short answer in English..." />}</label>)}</div><Button onClick={finish} disabled={attempt.isPending || complete.isPending} className="mt-5 w-full bg-[#14746d] hover:bg-[#0d635e]">{saved ? <><CheckCircle2 className="ml-2 h-4 w-4" />تم تسجيل الاستماع</> : "احفظ النتيجة وأكمل المهمة"}</Button></section></div></div>;
}
