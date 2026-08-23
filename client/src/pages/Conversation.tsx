import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTodayConversationLesson } from "@/lib/localLessons";
import { getSupabase } from "@/lib/supabase";
import { CheckCircle2, Clipboard, Clock3, MessageCircle, Sparkles, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const minutesByMode = { steady: 5, balanced: 10, intensive: 13 } as const;

function parseConversationLesson(markdown: string) {
  const topicArabic = markdown.match(/موضوع اليوم \(بالعربية\):\s*(.+)/)?.[1]?.trim() ?? "موضوع مهني في الميكاترونكس";
  const wordsBlock = markdown.match(/Target words \(English — Arabic\):([\s\S]*?)\n\nInstructions/mi)?.[1] ?? "";
  const words = Array.from(wordsBlock.matchAll(/-\s*(.+?)\s+—\s+(.+)/g)).map(([, english, arabic]) => ({ english: english.trim(), arabic: arabic.trim() }));
  return { topicArabic, words };
}

export default function Conversation() {
  const { isAuthenticated, user } = useAuth();
  const [score, setScore] = useState("");
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const conversationItem = useMemo(() => ({ task: { id: "speaking" }, content: getTodayConversationLesson() }), []);
  const lesson = useMemo(() => parseConversationLesson(conversationItem.content.contentMarkdown), [conversationItem]);
  const targetMinutes = minutesByMode.balanced;
  const prompt = conversationItem.content.contentMarkdown;
  async function copyPrompt() { try { await navigator.clipboard.writeText(prompt); toast.success("تم نسخ برومبت المحادثة المحلي."); } catch { toast.error("تعذر النسخ تلقائيًا؛ انسخ النص يدويًا."); } }
  async function saveScore() {
    const value = Number(score);
    if (!Number.isFinite(value) || value < 0 || value > 10) return toast.error("أدخل تقييمًا من 0 إلى 10 كما ظهر لك بعد المحادثة.");
    if (!user?.id) return toast.error("تعذر تحديد حسابك.");
    setIsSaving(true);
    const supabase: any = getSupabase();
    const [attempt, task] = await Promise.all([
      supabase.from("diagnostic_attempts").insert({ user_id: user.id, skill: "speaking", evidence_type: "conversation-score", prompt, response: `Overall score: ${value}/10`, score: Math.round(value * 10) }),
      supabase.from("daily_tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("user_id", user.id).eq("task_key", "speaking").eq("date_key", new Date().toISOString().slice(0, 10)),
    ]);
    setIsSaving(false);
    if (attempt.error || task.error) return toast.error(attempt.error?.message ?? task.error?.message ?? "تعذر حفظ تقييم المحادثة.");
    setSaved(true); toast.success("تمت إضافة تقييم المحادثة إلى معايرتك وسجل المحتوى.");
  }
  if (!isAuthenticated) return <div className="mx-auto max-w-5xl rounded-3xl bg-white p-8 text-center soft-shadow" dir="rtl"><h1 className="text-2xl font-extrabold text-primary">سجّل دخولك للحصول على برومبت محادثتك المحلي</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">الموضوع والكلمات وسجل التقييم تُختار وفق مسارك وتقدمك الشخصي.</p></div>;
  return <div className="mx-auto max-w-5xl space-y-6" dir="rtl"><section className="rounded-[28px] bg-primary p-6 text-white sm:p-8"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#d8ad4d] text-primary"><MessageCircle className="h-6 w-6" /></div><div><div className="flex flex-wrap items-center gap-2 text-xs text-emerald-50/75"><Sparkles className="h-4 w-4 text-[#e3bc62]" />برومبت اليوم المحلي · {conversationItem.content.titleArabic}</div><h1 className="mt-2 text-3xl font-extrabold">محادثة مفيدة، ثم نتيجة قابلة للقياس.</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50/75">الموضوع والكلمات والتعليمات محفوظة في مكتبتك المحلية؛ استخدم البرومبت مع أي مساعد محادثة وأدخل نتيجته النهائية من 10 هنا.</p></div></div></section><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><section className="rounded-[24px] bg-white p-5 soft-shadow sm:p-6"><div className="flex items-center justify-between"><h2 className="font-bold">البرومبت الجاهز</h2><span className="flex items-center gap-1 text-xs font-bold text-[#d79b28]"><Clock3 className="h-4 w-4" />{targetMinutes} دقائق تقريبًا</span></div><div className="mt-4 rounded-2xl bg-[#f5f8f6] p-3"><p className="text-xs font-bold text-primary">موضوع المحادثة</p><p className="mt-1 text-sm text-[#46665e]">{lesson.topicArabic}</p></div><div className="mt-3 flex flex-wrap gap-2">{lesson.words.map(word => <span key={word.english} className="rounded-lg bg-[#edf5f1] px-2 py-1 text-xs font-bold text-[#0d7a6e]"><span className="font-['DM_Sans']" dir="ltr">{word.english}</span><span className="mx-1 text-[#88a69f]">·</span>{word.arabic}</span>)}</div><pre dir="ltr" className="mt-5 whitespace-pre-wrap rounded-2xl bg-[#f5f8f6] p-4 text-left font-['DM_Sans'] text-xs leading-6 text-[#294642]">{prompt}</pre><Button onClick={copyPrompt} className="mt-4 w-full bg-primary"><Clipboard className="ml-2 h-4 w-4" />نسخ البرومبت</Button></section><section className="rounded-[24px] bg-[#f5ebd3] p-5 sm:p-6"><div className="flex items-center gap-2 text-[#9b6816]"><Star className="h-5 w-5" /><p className="font-bold">بعد انتهاء المحادثة</p></div><ol className="mt-4 list-decimal space-y-2 pr-5 text-sm leading-7 text-[#73582a]"><li>اطلب من المساعد أن يكتب <span dir="ltr" className="font-['DM_Sans'] font-bold">Overall score: X/10</span>.</li><li>أدخل الرقم نفسه هنا.</li><li>سيُسجل كدليل للمحادثة ويكمل مهمة اليوم.</li></ol><label className="mt-6 block text-sm font-bold text-[#5d4519]">تقييمي النهائي من 10</label><Input dir="ltr" inputMode="decimal" value={score} onChange={event => setScore(event.target.value)} className="mt-2 bg-white text-left font-['DM_Sans']" placeholder="e.g. 7.5" /><Button onClick={saveScore} disabled={isSaving} className="mt-4 w-full bg-[#9b6816] hover:bg-[#845710]">{saved ? <><CheckCircle2 className="ml-2 h-4 w-4" />تم تسجيل النتيجة</> : isSaving ? "جارٍ الحفظ..." : "أضف تقييم المحادثة"}</Button></section></div></div>;
}
