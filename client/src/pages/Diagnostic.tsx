import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSupabase } from "@/lib/supabase";
import { ArrowLeft, BrainCircuit, CheckCircle2, FilePenLine, MessageCircle, Sparkles, Trophy, Volume2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const grammarQuestion = {
  prompt: "Choose the sentence that best describes an ongoing engineering task yesterday.",
  choices: ["We test the system yesterday.", "We were testing the system yesterday.", "We have test the system yesterday."],
  answer: 1,
};

const vocabularyQuestion = {
  prompt: "What does the word constraint mean in a design project?",
  choices: ["A technical or practical limit", "A final version of a product", "A person who checks a machine"],
  answer: 0,
};

export default function Diagnostic() {
  const { isAuthenticated, user } = useAuth();
  const [_, setLocation] = useLocation();
  const [grammarChoice, setGrammarChoice] = useState<number | null>(null);
  const [vocabularyChoice, setVocabularyChoice] = useState<number | null>(null);
  const [writing, setWriting] = useState("");
  const [recorded, setRecorded] = useState(false);
  const [submitted, setSubmitted] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  async function addEvidence(skill: "grammar" | "vocabulary" | "writing" | "speaking") {
    if (!isAuthenticated) { toast.info("سجل دخولك لحفظ أدلة التشخيص في ملفك."); return; }
    const values = {
      grammar: { score: grammarChoice === grammarQuestion.answer ? 75 : 35, prompt: grammarQuestion.prompt, response: grammarChoice === null ? "" : grammarQuestion.choices[grammarChoice], type: "quick-choice" },
      vocabulary: { score: vocabularyChoice === vocabularyQuestion.answer ? 75 : 35, prompt: vocabularyQuestion.prompt, response: vocabularyChoice === null ? "" : vocabularyQuestion.choices[vocabularyChoice], type: "quick-choice" },
      writing: { score: Math.min(78, Math.max(35, writing.trim().split(/\s+/).filter(Boolean).length * 3)), prompt: "Write 2–4 sentences about a graduation project.", response: writing, type: "writing-sample" },
      speaking: { score: recorded ? 55 : 30, prompt: "Record one minute about an engineering task.", response: recorded ? "Learner confirmed a personal audio practice attempt." : "", type: "speaking-confidence" },
    };
    const item = values[skill];
    if (!item.response.trim()) { toast.error("أكمل هذا الدليل أولًا قبل حفظه."); return; }
    if (!user?.id) { toast.error("تعذر تحديد حسابك."); return; }
    setIsSaving(true);
    const { error } = await (getSupabase() as any).from("diagnostic_attempts").insert({
      user_id: user.id,
      skill,
      evidence_type: item.type,
      prompt: item.prompt,
      response: item.response,
      score: item.score,
    });
    setIsSaving(false);
    if (error) { toast.error(error.message ?? "تعذر حفظ دليل التشخيص."); return; }
    setSubmitted(current => current.includes(skill) ? current : [...current, skill]);
    toast.success("أضفنا هذا الدليل إلى معايرتك الديناميكية.");
  }

  const completed = submitted.length;
  return <div className="mx-auto max-w-5xl space-y-6" dir="rtl">
    <section className="rounded-[28px] border border-[#dbe8e0] bg-[#eff7f1] px-6 py-7 sm:px-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="inline-flex items-center gap-2 text-xs font-bold text-[#0d7a6e]"><Sparkles className="h-4 w-4" />تشخيص مرن · اليوم الأول</div><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-primary">نقيس البداية، لا نحدد سقفك.</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[#46665e]">هذه أدلة قصيرة في القواعد والمفردات والكتابة والمحادثة. ستتغير النتيجة مع مهامك الفعلية خلال الأيام القادمة.</p></div><div className="rounded-2xl bg-white px-4 py-3 text-center soft-shadow"><p className="text-2xl font-extrabold text-primary">{completed}/4</p><p className="text-[11px] text-muted-foreground">أدلة مكتملة</p></div></div></section>
    <div className="grid gap-5 lg:grid-cols-2">
      <DiagnosticCard icon={BrainCircuit} title="1. القواعد في سياق" done={submitted.includes("grammar")}><p className="font-['DM_Sans'] text-sm font-medium text-[#253f3d]" dir="ltr">{grammarQuestion.prompt}</p><ChoiceList choices={grammarQuestion.choices} selected={grammarChoice} onSelect={setGrammarChoice} /><Button disabled={grammarChoice === null || isSaving} onClick={() => addEvidence("grammar")} className="mt-4 w-full bg-primary">{submitted.includes("grammar") ? "تم حفظ الدليل" : "أضف نتيجة القواعد"}</Button></DiagnosticCard>
      <DiagnosticCard icon={Volume2} title="2. مفردة هندسية" done={submitted.includes("vocabulary")}><p className="font-['DM_Sans'] text-sm font-medium text-[#253f3d]" dir="ltr">{vocabularyQuestion.prompt}</p><ChoiceList choices={vocabularyQuestion.choices} selected={vocabularyChoice} onSelect={setVocabularyChoice} /><Button disabled={vocabularyChoice === null || isSaving} onClick={() => addEvidence("vocabulary")} className="mt-4 w-full bg-primary">{submitted.includes("vocabulary") ? "تم حفظ الدليل" : "أضف نتيجة المفردات"}</Button></DiagnosticCard>
      <DiagnosticCard icon={FilePenLine} title="3. عينة كتابة" done={submitted.includes("writing")}><p className="text-sm leading-6 text-muted-foreground">اكتب بالإنجليزية جملتين إلى أربع جمل عن مشروع تخرج، تدريب، أو مشكلة هندسية تعرفها. لا نطلب كتابة مثالية.</p><Textarea dir="ltr" value={writing} onChange={event => setWriting(event.target.value)} className="mt-4 min-h-32 rounded-2xl border-border bg-[#fcfdfb] text-left font-['DM_Sans']" placeholder="My graduation project was about..." /><div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>{writing.trim() ? writing.trim().split(/\s+/).length : 0} كلمة</span><span>هدف مبدئي: 25–60 كلمة</span></div><Button disabled={writing.trim().length < 10 || isSaving} onClick={() => addEvidence("writing")} className="mt-4 w-full bg-primary">{submitted.includes("writing") ? "تم حفظ الدليل" : "أضف عينة الكتابة"}</Button></DiagnosticCard>
      <DiagnosticCard icon={MessageCircle} title="4. محاولة كلام حرة" done={submitted.includes("speaking")}><p className="text-sm leading-6 text-muted-foreground">سجّل على هاتفك دقيقة واحدة بالإنجليزية عن مشروع أو تحدٍ هندسي. في هذه المرحلة نؤكد المحاولة فقط؛ تحليل الصوت التفصيلي سيأتي في مرحلة لاحقة.</p><button onClick={() => setRecorded(value => !value)} className={`mt-5 flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-right ${recorded ? "border-[#72b390] bg-[#eaf6ed] text-[#0d7a6e]" : "border-border bg-[#fcfdfb] text-muted-foreground"}`}>{recorded ? <CheckCircle2 className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}<span><strong className="block text-sm">{recorded ? "أكملت محاولة صوتية" : "علّم هنا بعد تسجيل محاولتك"}</strong><small className="mt-1 block text-xs">لا نرفع الصوت أو نخزنه في المرحلة الأولى.</small></span></button><Button disabled={!recorded || isSaving} onClick={() => addEvidence("speaking")} className="mt-4 w-full bg-primary">{submitted.includes("speaking") ? "تم حفظ الدليل" : "أضف دليل المحادثة"}</Button></DiagnosticCard>
    </div>
    <section className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-primary p-6 text-white sm:flex-row sm:items-center"><div><p className="text-lg font-bold">بعد كل دليل، تصبح المعايرة أدق.</p><p className="mt-1 text-sm text-emerald-50/75">لا تنتظر إكمال كل شيء لتبدأ البطاقة والمهمة اليومية.</p></div><Button onClick={() => setLocation("/")} className="bg-[#d8ad4d] text-primary hover:bg-[#e8bf62]"><Trophy className="ml-2 h-4 w-4" />العودة إلى يومي<ArrowLeft className="mr-2 h-4 w-4" /></Button></section>
  </div>;
}

function DiagnosticCard({ icon: Icon, title, done, children }: { icon: React.ElementType; title: string; done: boolean; children: React.ReactNode }) {
  return <section className="rounded-[24px] border border-border bg-white p-5 soft-shadow"><div className="mb-5 flex items-center gap-3"><div className={`grid h-10 w-10 place-items-center rounded-2xl ${done ? "bg-[#e7f5ec] text-[#0d7a6e]" : "bg-[#edf2ef] text-primary"}`}>{done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}</div><h2 className="font-bold">{title}</h2></div>{children}</section>;
}

function ChoiceList({ choices, selected, onSelect }: { choices: string[]; selected: number | null; onSelect: (index: number) => void }) {
  return <div className="mt-4 space-y-2" dir="ltr">{choices.map((choice, index) => <button key={choice} onClick={() => onSelect(index)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-['DM_Sans'] ${selected === index ? "border-[#0d7a6e] bg-[#eaf6ed] text-[#0d5a49]" : "border-border bg-[#fcfdfb] text-[#405754]"}`}><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${selected === index ? "border-[#0d7a6e] bg-[#0d7a6e] text-white" : "border-[#c9d3ce]"}`}>{selected === index ? "✓" : ""}</span>{choice}</button>)}</div>;
}
