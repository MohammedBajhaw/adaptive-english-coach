import { useAuth } from "@/_core/hooks/useAuth";
import WakeButton from "@/components/WakeButton";
import { useCycle } from "@/hooks/useCycle";
import { cycleEnded, getCycle } from "@/lib/cycle";
import { getSupabase } from "@/lib/supabase";
import { ensureLearnerCycle, wakeUp } from "@/lib/supabaseLearning";
import { Sunrise } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// Where the "هل استيقظت؟" notification leads. If the cycle really ended and the notification was sent, it starts the next
// cycle by itself (one tap on the notification is enough); otherwise it shows the button, so opening this address by
// accident never advances the lesson.
export default function Wake() {
  const { isAuthenticated, user, loading } = useAuth();
  const cycle = useCycle();
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (loading || !isAuthenticated || !user?.id) return;
    let active = true;
    void (async () => {
      try {
        await ensureLearnerCycle(user.id);
        const { data } = await (getSupabase() as any).from("learner_profiles").select("wake_prompt_sent_at").eq("user_id", user.id).maybeSingle();
        const current = getCycle();
        const promptSent = Boolean(data?.wake_prompt_sent_at && current.startedAt && data.wake_prompt_sent_at >= current.startedAt);
        if (active && promptSent && cycleEnded(current, new Date())) {
          setStarting(true);
          await wakeUp(user.id);
          toast.success("بدأت دورة جديدة. يوم موفق!");
          window.location.assign(import.meta.env.BASE_URL);
        }
      } catch (error) {
        setStarting(false);
        toast.error(error instanceof Error ? error.message : "تعذر بدء الدورة.");
      }
    })();
    return () => { active = false; };
  }, [loading, isAuthenticated, user?.id]);

  return (
    <div className="mx-auto max-w-xl" dir="rtl">
      <section className="rounded-[28px] bg-white p-8 text-center soft-shadow">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#fbf1d9] text-[#9b6816]"><Sunrise className="h-7 w-7" /></div>
        <h1 className="mt-5 text-2xl font-extrabold text-primary">{starting ? "نبدأ دورتك الجديدة..." : "هل استيقظت؟"}</h1>
        {!isAuthenticated && !loading ? (
          <p className="mt-3 text-sm leading-7 text-muted-foreground">سجّل دخولك أولًا ثم افتح هذه الصفحة مرة أخرى.</p>
        ) : (
          <>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{cycleEnded(cycle, new Date()) ? "انتهت دورتك السابقة. اضغط لتبدأ دورة جديدة بدرس ومهام جديدة." : "دورتك الحالية ما زالت جارية. إن استيقظت من جديد فاضغط لبدء دورة أخرى."}</p>
            {!starting && <WakeButton userId={user?.id} className="mt-6 h-12 w-full" />}
          </>
        )}
      </section>
    </div>
  );
}
