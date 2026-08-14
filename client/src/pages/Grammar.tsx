import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { BookMarked, CheckCircle2, ExternalLink, FilePenLine, Lightbulb, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const sourceUrl = "https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/past-continuous";
const comparisonUrl = "https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2/past-continuous-past-simple";
const question = { prompt: "While we ___ the actuator, the alarm went off.", choices: ["tested", "were testing", "have tested"], answer: 1 };

export default function Grammar() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const dashboard = trpc.learning.dashboard.get.useQuery(undefined, { enabled: isAuthenticated });
  const [choice, setChoice] = useState<number | null>(null);
  const [production, setProduction] = useState("");
  const [saved, setSaved] = useState(false);
  const attempt = trpc.learning.diagnostic.submit.useMutation();
  const complete = trpc.learning.tasks.complete.useMutation();
  const taskId = dashboard.data?.tasks.find(task => task.skill === "grammar")?.id;
  async function finishLesson() {
    if (!isAuthenticated) { toast.info("سجل دخولك لحفظ نتيجة القاعدة ضمن معايرتك."); return; }
    if (choice === null || production.trim().split(/\s+/).length < 5) { toast.error("اختر إجابة واكتب جملة هندسية واحدة على الأقل."); return; }
    const score = (choice === question.answer ? 65 : 35) + Math.min(25, production.trim().split(/\s+/).length);
    await attempt.mutateAsync({ skill: "grammar", evidenceType: "grammar-lesson", prompt: question.prompt, response: production, score });
    if (taskId) await complete.mutateAsync({ taskId, completed: true });
    await utils.learning.dashboard.get.invalidate();
    setSaved(true); toast.success("تم حفظ نتيجة القاعدة وإكمال مهمتها اليوم.");
  }
  return <div className="mx-auto max-w-5xl space-y-6" dir="rtl"><section className="rounded-[28px] bg-[#f2eff9] p-6 sm:p-8"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#7652ad] text-white"><BookMarked className="h-6 w-6" /></div><div><p className="text-xs font-bold text-[#7652ad]">قاعدة اليوم · شرح عربي</p><h1 className="mt-1 text-3xl font-extrabold text-primary">الماضي المستمر مع الماضي البسيط</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-[#5c5572]">نستخدم <span dir="ltr" className="font-['DM_Sans'] font-bold">was/were + verb-ing</span> لوصف فعل كان مستمرًا في لحظة بالماضي، ثم نستخدم الماضي البسيط للحدث القصير الذي قطعه أو وقع أثناءه.</p></div></div></section><div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]"><section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-6"><h2 className="flex items-center gap-2 font-bold"><Lightbulb className="h-5 w-5 text-[#d79b28]" />كيف تفكر بها؟</h2><div className="mt-5 space-y-3 text-sm leading-7 text-[#425552]"><p><strong>الخلفية المستمرة:</strong> ما كان يحدث بالفعل.</p><p className="rounded-2xl bg-[#f8f7fc] p-3 font-['DM_Sans']" dir="ltr">We <b>were testing</b> the actuator …</p><p><strong>الحدث القصير:</strong> الشيء الذي وقع أو قطع المشهد.</p><p className="rounded-2xl bg-[#f8f7fc] p-3 font-['DM_Sans']" dir="ltr">… when the alarm <b>went off</b>.</p><p>لا نستخدم الماضي المستمر عادة مع الأفعال التي تعبّر عن حالة ثابتة، مثل <span dir="ltr" className="font-['DM_Sans']">know, need, believe</span>.</p></div><div className="mt-6 flex flex-wrap gap-x-5 gap-y-2"><a href={sourceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-bold text-[#7652ad] underline underline-offset-4">مرجع الماضي المستمر <ExternalLink className="h-4 w-4" /></a><a href={comparisonUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-bold text-[#7652ad] underline underline-offset-4">مقارنة الماضيين <ExternalLink className="h-4 w-4" /></a></div></section><section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-6"><h2 className="flex items-center gap-2 font-bold"><FilePenLine className="h-5 w-5 text-[#7652ad]" />تطبيق قصير</h2><p className="mt-4 font-['DM_Sans'] text-base font-medium text-primary" dir="ltr">{question.prompt}</p><div className="mt-4 space-y-2" dir="ltr">{question.choices.map((item, index) => <button key={item} onClick={() => setChoice(index)} className={`w-full rounded-xl border px-3 py-3 text-left font-['DM_Sans'] text-sm ${choice === index ? "border-[#7652ad] bg-[#f4f0fa] text-[#604095]" : "border-border bg-[#fcfdfb]"}`}>{choice === index ? "✓ " : "○ "}{item}</button>)}</div><div className="mt-6 border-t border-border pt-5"><p className="flex items-center gap-2 text-sm font-bold"><MessageCircle className="h-4 w-4 text-[#7652ad]" />إنتاج شفهي وكتابي</p><p className="mt-1 text-xs leading-6 text-muted-foreground">قل جملتك أولًا بصوت عالٍ، ثم اكتبها بالإنجليزية: ماذا كان فريقك يفعل عندما حدثت مشكلة؟</p><Textarea dir="ltr" value={production} onChange={event => setProduction(event.target.value)} className="mt-3 min-h-28 text-left font-['DM_Sans']" placeholder="We were calibrating the sensor when..." /></div><Button onClick={finishLesson} disabled={attempt.isPending || complete.isPending} className="mt-5 w-full bg-[#7652ad] hover:bg-[#68499a]">{saved ? <><CheckCircle2 className="ml-2 h-4 w-4" />تم حفظ النتيجة</> : "احفظ التطبيق وأكمل المهمة"}</Button></section></div></div>;
}
