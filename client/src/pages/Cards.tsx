import { useAuth } from "@/_core/hooks/useAuth";
import CycleWords from "@/components/CycleWords";
import VocabCardView from "@/components/VocabCardView";
import { Button } from "@/components/ui/button";
import { useCycle } from "@/hooks/useCycle";
import { cycleEndsAt } from "@/lib/cycle";
import { closeVocabSession, completeSupabaseTaskByKey, ensureLearnerCycle, introduceNextWord, loadVocabSession, rateSupabaseCard } from "@/lib/supabaseLearning";
import { MAX_NEW_PER_CYCLE, deriveSession, ratingLabels, ratingOrder, type Rating, type StopReason } from "@/lib/vocabSession";
import { ArrowLeft, Check, CircleHelp, Gauge, ListChecks, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const previewCard = { id: "preview", term: "Actuator", arabic_meaning: "مشغّل / مُحرِّك", pronunciation: "AK-choo-ay-ter", category: "Actuators", definition: "A device that turns an electrical, hydraulic, or pneumatic input into physical motion or force.", examples: [{ english: "The actuator moves the robot arm when it receives a signal.", arabic: "يحرّك المشغّل ذراع الروبوت عندما يستقبل إشارة." }, { english: "A pneumatic actuator opens and closes the gripper.", arabic: "يفتح المشغّل الهوائي القابض ويغلقه." }], level: "Beginner", stageName: "المحركات والحساسات", interviewPriority: false };

const ratingStyle: Record<Rating, string> = {
  again: "border-[#e6c0c0] text-[#a54444] hover:bg-[#fff6f6]",
  hard: "border-[#ead8ab] text-[#9b6816] hover:bg-[#fffcf3]",
  good: "border-[#b7d9c8] text-[#0d7a6e] hover:bg-[#f4fbf6]",
  easy: "border-[#b8d1e3] text-[#2a73a2] hover:bg-[#f5faff]",
};

const stopText: Record<StopReason, string> = {
  budget: "وصلت إلى حد الحمل لهذه الدورة، فتوقفت الكلمات الجديدة.",
  cap: `بلغت ${MAX_NEW_PER_CYCLE} كلمة جديدة في هذه الدورة، فتوقفت الكلمات الجديدة.`,
  closed: "أغلقت جلسة هذه الدورة. الكلمات الجديدة تعود في الدورة القادمة.",
  exhausted: "أنهيت كل كلمات القائمة!",
};

function remaining(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} س ${minutes % 60} د` : `${minutes} د`;
}

type SessionData = { cards: any[]; intervalHours: number; closed: boolean; totalWords: number };

export default function Cards() {
  const { isAuthenticated, user } = useAuth();
  const cycle = useCycle();
  const [, setLocation] = useLocation();
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"session" | "words">("session");
  const [now, setNow] = useState(() => new Date());
  const introducing = useRef(false);
  const completed = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    try {
      await ensureLearnerCycle(user.id, (user as any).name);
      setData(await loadVocabSession(user.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تحميل كلمات الجلسة.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) { setLoading(false); setData(null); return; }
    completed.current = false;
    setLoading(true);
    void reload();
    // Coming back to the app later in the day: pick up reviews that became due.
    const onVisible = () => { if (document.visibilityState === "visible") void reload(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [isAuthenticated, user?.id, cycle.number, reload]);

  const session = data ? deriveSession({ cards: data.cards, openedAt: cycle.openedAt, closed: data.closed, totalWords: data.totalWords, now }) : null;
  const current = session ? (session.dueReviews[0] ?? session.pendingNew[0] ?? null) : null;

  // Nothing to show and the session is still open: bring in the next new word.
  useEffect(() => {
    if (!data || !user?.id || !session || current || session.stopped || introducing.current) return;
    introducing.current = true;
    void introduceNextWord(user.id, data.cards)
      .then(card => { if (card) setData(previous => previous && { ...previous, cards: [...previous.cards, card] }); })
      .catch(error => toast.error(error instanceof Error ? error.message : "تعذر تجهيز الكلمة التالية."))
      .finally(() => { introducing.current = false; });
  }, [data, current, session?.stopped, user?.id]);

  async function finishSession(reason: StopReason) {
    if (!user?.id || completed.current) return;
    completed.current = true;
    try {
      await completeSupabaseTaskByKey(user.id, "vocabulary");
      toast.success(`${stopText[reason]} اكتملت مهمة المفردات.`);
    } catch (error) {
      completed.current = false;
      toast.error(error instanceof Error ? error.message : "تعذر إكمال مهمة المفردات.");
    }
  }

  async function rate(rating: Rating) {
    if (!user?.id || !data || !current || !session) return;
    setBusy(true);
    try {
      const updated = await rateSupabaseCard(user.id, current, rating, data.intervalHours);
      const cards = data.cards.map(card => (card.id === updated.id ? updated : card));
      setData({ ...data, cards });
      const after = deriveSession({ cards, openedAt: cycle.openedAt, closed: data.closed, totalWords: data.totalWords, now: new Date() });
      if (after.stopped && !session.stopped && after.stopReason) await finishSession(after.stopReason);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ التقييم.");
    } finally {
      setBusy(false);
    }
  }

  async function enoughForToday() {
    if (!user?.id || !data) return;
    setBusy(true);
    try {
      await closeVocabSession(user.id);
      setData({ ...data, closed: true });
      await finishSession("closed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إغلاق الجلسة.");
    } finally {
      setBusy(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-4xl space-y-6" dir="rtl">
        <section className="rounded-2xl bg-[#f5ebd3] p-4 text-sm leading-7 text-[#5d4519]">هذه بطاقة تجريبية. سجّل دخولك لتبدأ جلستك وتُحفظ تقييماتك.</section>
        <VocabCardView card={previewCard} badge="معاينة" />
      </div>
    );
  }

  const end = cycleEndsAt(cycle);
  const introduced = data && cycle.openedAt ? data.cards.filter(card => card.intake_at && card.intake_at >= cycle.openedAt!) : [];
  const breakdown = ratingOrder.map(rating => ({ rating, count: introduced.filter(card => card.intake_rating === rating).length }));
  const nextDue = data ? data.cards.filter(card => card.review_count && card.last_rating !== "easy" && card.next_review_at > now.toISOString()).map(card => card.next_review_at).sort()[0] : undefined;

  const tabs = (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#f0f2ee] p-1" role="tablist">
      <button role="tab" aria-selected={tab === "session"} onClick={() => setTab("session")} className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold ${tab === "session" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}><Sparkles className="h-4 w-4" />الجلسة</button>
      <button role="tab" aria-selected={tab === "words"} onClick={() => setTab("words")} className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold ${tab === "words" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}><ListChecks className="h-4 w-4" />كلمات الدورة</button>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5" dir="rtl">
      <section>
        <div className="flex items-center gap-2 text-xs font-bold text-[#0d7a6e]"><Sparkles className="h-4 w-4" />مفردات الدورة{cycle.number > 0 ? ` ${cycle.number}` : ""}{end ? ` · ${end.getTime() > now.getTime() ? `تنتهي بعد ${remaining(end.getTime() - now.getTime())}` : "انتهت"}` : ""}</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-primary">قلها قبل أن تقرأها.</h1>
        <p className="mt-2 text-sm text-muted-foreground">كلمات جديدة حتى يمتلئ حمل الدورة. السهلة لا تكلّف شيئًا، والصعبة تملؤه أسرع.</p>
      </section>

      {tabs}

      {tab === "words" ? (
        <CycleWords cards={data?.cards ?? []} openedAt={cycle.openedAt} />
      ) : loading || !data || !session ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-muted-foreground">جارٍ تجهيز كلماتك...</p>
      ) : (
        <>
          <section className="rounded-2xl border border-border bg-white p-4" aria-label="حمل الدورة">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-bold text-primary"><Gauge className="h-4 w-4 text-[#0d7a6e]" />حمل الدورة <span dir="ltr">{session.percent}%</span></span>
              <span className="text-xs text-muted-foreground">{session.newCount} كلمة جديدة{session.dueReviews.length > 0 ? ` · ${session.dueReviews.length} مراجعة` : ""}</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#eef1ee]" role="progressbar" aria-valuenow={session.percent} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full rounded-full transition-all ${session.percent >= 100 ? "bg-[#c9763b]" : session.percent >= 70 ? "bg-[#d8ad4d]" : "bg-[#0d7a6e]"}`} style={{ width: `${session.percent}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {breakdown.map(item => <span key={item.rating} className="rounded-full bg-[#f4f6f3] px-3 py-1 font-semibold text-primary">{ratingLabels[item.rating]} {item.count}</span>)}
            </div>
          </section>

          {session.stopped && current && (
            <p className="rounded-2xl bg-[#fbf1d9] p-3 text-sm leading-7 text-[#7a5413]">{session.stopReason ? stopText[session.stopReason] : ""} بقيت لك مراجعات مستحقة.</p>
          )}

          {current ? (
            <VocabCardView
              card={current}
              badge={current.review_count ? "مراجعة" : "كلمة جديدة"}
              footer={
                <div className="border-t border-border bg-[#f9faf7] p-5 sm:px-9">
                  <p className="mb-3 text-center text-xs font-semibold text-muted-foreground">كيف كان استرجاعك قبل النظر إلى المعنى؟</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {ratingOrder.map(rating => <button key={rating} onClick={() => void rate(rating)} disabled={busy} className={`min-h-12 rounded-xl border bg-white px-3 py-2.5 text-sm font-bold ${ratingStyle[rating]}`}>{ratingLabels[rating]}</button>)}
                  </div>
                </div>
              }
            />
          ) : session.stopped ? (
            <section className="rounded-[28px] bg-white p-8 text-center soft-shadow">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#eaf6ed] text-[#0d7a6e]"><Check className="h-7 w-7" /></div>
              <h2 className="mt-5 text-2xl font-extrabold text-primary">انتهت جلسة كلمات هذه الدورة</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted-foreground">{session.stopReason ? stopText[session.stopReason] : ""}{nextDue ? ` المراجعة التالية بعد ${remaining(Date.parse(nextDue) - now.getTime())}.` : ""}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button onClick={() => setTab("words")}><ListChecks className="ml-2 h-4 w-4" />عرض كلمات الدورة</Button>
                <Button variant="outline" onClick={() => setLocation("/")}>العودة لخطة اليوم</Button>
              </div>
            </section>
          ) : (
            <p className="rounded-2xl bg-white p-8 text-center text-sm text-muted-foreground">جارٍ تجهيز الكلمة التالية...</p>
          )}

          {!session.stopped && (
            <Button variant="outline" onClick={() => void enoughForToday()} disabled={busy} className="h-12 w-full border-[#cda95c] bg-white text-[#765116] hover:bg-[#fffdf8]">كفاية لليوم — أنهِ كلمات هذه الدورة</Button>
          )}

          <section className="rounded-3xl bg-[#f5ebd3] p-5 text-[#5d4519]">
            <div className="flex gap-3">
              <CircleHelp className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm leading-7">«سهلة» تغيب ثلاثة أسابيع. «لم أتذكر» و«صعبة» و«جيدة» تعود كل {data.intervalHours === 1 ? "ساعة" : data.intervalHours === 2 ? "ساعتين" : `${data.intervalHours} ساعات`} مع تذكير على جوالك، إلى أن تقيّمها «سهلة».</p>
            </div>
          </section>
        </>
      )}

      <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm font-bold text-primary"><ArrowLeft className="h-4 w-4" />العودة إلى يومي</button>
    </div>
  );
}
