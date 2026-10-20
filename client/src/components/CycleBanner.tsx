import { useAuth } from "@/_core/hooks/useAuth";
import WakeButton from "@/components/WakeButton";
import { useCycle } from "@/hooks/useCycle";
import { cycleEnded } from "@/lib/cycle";
import { Moon } from "lucide-react";
import { useEffect, useState } from "react";

// Shown on every page once the cycle's hours are over: the learner confirms they are awake to begin the next one.
export default function CycleBanner() {
  const { user, isAuthenticated } = useAuth();
  const cycle = useCycle();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  if (!isAuthenticated || !cycleEnded(cycle, now)) return null;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#c9d4ef] bg-[#eef2fb] p-4" role="status">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#3b4d8f] text-white"><Moon className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1 text-right">
        <p className="text-sm font-bold text-[#2c3a6e]">انتهت دورتك ({cycle.hours} ساعة)</p>
        <p className="mt-1 text-xs leading-6 text-[#4b5a8a]">توقفت التذكيرات. اضغط عندما تستيقظ لتبدأ دورة جديدة بدرس ومهام جديدة.</p>
        <WakeButton userId={user?.id} className="mt-3 h-11" />
      </div>
    </div>
  );
}
