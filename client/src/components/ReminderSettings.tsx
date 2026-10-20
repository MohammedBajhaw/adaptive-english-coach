import WakeButton from "@/components/WakeButton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useCycle } from "@/hooks/useCycle";
import { DEFAULT_CYCLE_HOURS, clockTimeNear, cycleEndsAt, isStartInRange } from "@/lib/cycle";
import { disablePush, enablePush, getPushState, showTestNotification, syncSubscription, type PushState } from "@/lib/push";
import { getSupabase } from "@/lib/supabase";
import { adjustCycleStart, ensureLearnerCycle, updateCycleHours } from "@/lib/supabaseLearning";
import { Bell, BellOff, BellRing, Sunrise } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const everyOptions = [1, 2, 3, 4, 6];
const cycleHourOptions = [12, 14, 16, 18, 20, 22, 24];
const afterOptions = [0, 2, 4, 6, 8, 10, 12];
const selectClass = "h-12 w-full rounded-2xl border border-[#eeddb7] bg-white px-3 text-sm text-[#5d4519] outline-none focus:ring-2 focus:ring-[#e0c48f]";
const formatTime = (date: Date) => new Intl.DateTimeFormat("ar-u-nu-latn", { weekday: "long", hour: "2-digit", minute: "2-digit" }).format(date);
const hoursText = (hours: number) => (hours === 0 ? "فور الاستيقاظ" : hours === 1 ? "ساعة" : hours === 2 ? "ساعتين" : `${hours} ساعات`);

type Props = { userId: string | undefined; isAuthenticated: boolean };

const stateText: Record<PushState, string> = {
  unsupported: "هذا المتصفح لا يدعم إشعارات الجوال. جرّب Chrome على أندرويد.",
  "needs-install": "على الآيفون تعمل الإشعارات فقط بعد إضافة التطبيق إلى الشاشة الرئيسية (مشاركة ← إضافة إلى الشاشة الرئيسية)، ثم افتحه من هناك.",
  denied: "الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح ثم أعد المحاولة.",
  off: "التنبيهات غير مفعّلة على هذا الجهاز.",
  on: "التنبيهات مفعّلة على هذا الجهاز.",
};

// The wake cycle (the app's "day") and the phone reminders that follow it.
export default function ReminderSettings({ userId, isAuthenticated }: Props) {
  const cycle = useCycle();
  const [state, setState] = useState<PushState>("off");
  const [vocabEnabled, setVocabEnabled] = useState(true);
  const [every, setEvery] = useState(2);
  const [dailyEnabled, setDailyEnabled] = useState(true);
  const [dailyAfter, setDailyAfter] = useState(8);
  const [cycleHours, setCycleHours] = useState(DEFAULT_CYCLE_HOURS);
  const [startTime, setStartTime] = useState("04:00");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getPushState().then(setState);
    if (!isAuthenticated || !userId) return;
    void syncSubscription(userId).catch(() => undefined);
    void ensureLearnerCycle(userId).catch(() => undefined);
    void (getSupabase() as any).from("learner_profiles").select("*").eq("user_id", userId).maybeSingle().then(({ data }: { data: any }) => {
      if (!data || data.daily_reminder_after_hours === undefined) return;
      setVocabEnabled(Boolean(data.vocab_reminder_enabled));
      setEvery(data.vocab_reminder_every_hours);
      setDailyEnabled(Boolean(data.reminder_enabled));
      setDailyAfter(data.daily_reminder_after_hours);
      setCycleHours(data.cycle_hours ?? DEFAULT_CYCLE_HOURS);
    });
  }, [isAuthenticated, userId]);

  async function toggleDevice() {
    if (!userId) return toast.info("سجل دخولك أولًا.");
    setBusy(true);
    try {
      if (state === "on") { await disablePush(); toast.success("أُوقفت التنبيهات على هذا الجهاز."); }
      else { await enablePush(userId); toast.success("فُعّلت التنبيهات على هذا الجهاز."); }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تغيير حالة التنبيهات.");
    }
    setState(await getPushState());
    setBusy(false);
  }

  async function test() {
    try { await showTestNotification(); } catch { toast.error("تعذر عرض التنبيه التجريبي. تأكد من تفعيل الإذن."); }
  }

  async function applyStart() {
    if (!userId) return toast.info("سجل دخولك أولًا.");
    const [hour, minute] = startTime.split(":").map(Number);
    if (hour === undefined || minute === undefined || Number.isNaN(hour) || Number.isNaN(minute)) return toast.error("اختر الساعة أولًا.");
    const at = clockTimeNear(hour, minute, new Date());
    if (!isStartInRange(at, new Date())) return toast.error("اختر وقتًا بين 24 ساعة ماضية و12 ساعة قادمة.");
    setBusy(true);
    try {
      await adjustCycleStart(userId, at);
      toast.success(`بدأت دورتك عند ${formatTime(at)}. التذكيرات تعدّ من هذه الساعة.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تعديل بداية الدورة.");
    }
    setBusy(false);
  }

  async function save() {
    if (!userId) return toast.info("سجل دخولك لحفظ تفضيلات التذكير.");
    setBusy(true);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    try {
      if (cycleHours !== cycle.hours) await updateCycleHours(userId, cycleHours);
      const { error } = await (getSupabase() as any).from("learner_profiles").update({
        timezone,
        vocab_reminder_enabled: vocabEnabled,
        vocab_reminder_every_hours: every,
        reminder_enabled: dailyEnabled,
        daily_reminder_after_hours: dailyAfter,
      }).eq("user_id", userId);
      if (error) throw new Error(/column|schema/.test(error.message) ? "أعمدة الدورة غير موجودة بعد في Supabase. شغّل ملف الهجرة 003 أولًا." : error.message);
      toast.success("تم حفظ تفضيلات الدورة والتذكير.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر الحفظ.");
    }
    setBusy(false);
  }

  const end = cycleEndsAt(cycle);
  const canToggle = state === "off" || state === "on";
  return (
    <>
      <section className="rounded-[24px] bg-[#eef2fb] p-5 soft-shadow sm:p-7">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#cdd8f2] text-[#3b4d8f]"><Sunrise className="h-5 w-5" /></div>
          <div><h2 className="font-bold text-[#2c3a6e]">دورتي</h2><p className="text-xs text-[#4b5a8a]">يومك في هذا الموقع يبدأ حين تستيقظ ويدوم عدة ساعات، لا من منتصف الليل. الدرس والمهام والكلمات والتذكيرات كلها تتبعه.</p></div>
        </div>
        <div className="mt-4 rounded-2xl border border-[#c9d4ef] bg-white/70 p-4 text-sm leading-7 text-[#2c3a6e]">
          {cycle.number > 0 && cycle.startedAt ? (
            <>
              <p><strong>الدورة {cycle.number}</strong> · بدأت {formatTime(new Date(cycle.startedAt))}</p>
              {end && <p>{end.getTime() > Date.now() ? "تنتهي" : "انتهت"} {formatTime(end)}</p>}
            </>
          ) : <p>لم تبدأ دورتك بعد. ستبدأ تلقائيًا عند فتح لوحة اليوم.</p>}
        </div>
        <WakeButton userId={userId} variant="outline" className="mt-3 h-12 w-full border-[#9fb0e0] bg-white text-[#2c3a6e]" />
        <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
          <label className="text-xs font-bold text-[#4b5a8a]">ساعة بداية دورتي الحالية<input type="time" value={startTime} onChange={event => setStartTime(event.target.value)} dir="ltr" className="mt-1 h-12 w-full rounded-2xl border border-[#c9d4ef] bg-white px-3 text-sm text-[#2c3a6e] outline-none focus:ring-2 focus:ring-[#9fb0e0]" /></label>
          <Button variant="outline" onClick={applyStart} disabled={busy} className="h-12 border-[#9fb0e0] bg-white text-[#2c3a6e]">تثبيت</Button>
        </div>
        <p className="mt-2 text-xs leading-6 text-[#4b5a8a]">مثلًا إن كنت ستستيقظ عند 4 فجرًا فاختر 04:00: تُعدّ التذكيرات من تلك الساعة دون أن يتقدم الدرس.</p>
        <label className="mt-4 block text-xs font-bold text-[#4b5a8a]">مدة الدورة<select value={cycleHours} onChange={event => setCycleHours(Number(event.target.value))} className="mt-1 h-12 w-full rounded-2xl border border-[#c9d4ef] bg-white px-3 text-sm text-[#2c3a6e] outline-none focus:ring-2 focus:ring-[#9fb0e0]">{cycleHourOptions.map(hours => <option key={hours} value={hours}>{hours} ساعة</option>)}</select></label>
      </section>

      <section className="rounded-[24px] bg-[#fff9eb] p-5 soft-shadow sm:p-7">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f5e3ae] text-[#9b6816]"><Bell className="h-5 w-5" /></div>
          <div><h2 className="font-bold text-[#5d4519]">تنبيهات الجوال</h2><p className="text-xs text-[#73582a]">تصلك والتطبيق مغلق، طوال دورتك فقط. بعد انتهاء الدورة تتوقف حتى تؤكد أنك استيقظت.</p></div>
        </div>

        <div className="mt-5 rounded-2xl border border-[#eeddb7] bg-white/70 p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-[#5d4519]">{state === "on" ? <BellRing className="h-4 w-4 text-[#0d7a6e]" /> : <BellOff className="h-4 w-4 text-[#8b6c38]" />}{stateText[state]}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canToggle && <Button onClick={toggleDevice} disabled={busy} className="h-11 flex-1">{state === "on" ? "إيقاف على هذا الجهاز" : "فعّل التنبيهات على هذا الجهاز"}</Button>}
            {state === "on" && <Button variant="outline" onClick={test} className="h-11 flex-1">تنبيه تجريبي</Button>}
          </div>
        </div>

        <label className="mt-4 flex items-center justify-between rounded-2xl border border-[#eeddb7] bg-white/70 p-4"><span><span className="block text-sm font-bold text-[#5d4519]">تذكير الكلمات غير السهلة</span><span className="mt-1 block text-xs text-[#8b6c38]">لم أتذكر وصعبة وجيدة فقط. السهلة بلا تذكير.</span></span><Checkbox checked={vocabEnabled} onCheckedChange={value => setVocabEnabled(Boolean(value))} /></label>
        {vocabEnabled && <label className="mt-3 block text-xs font-bold text-[#73582a]">يتكرر كل<select value={every} onChange={event => setEvery(Number(event.target.value))} className={`${selectClass} mt-1`}>{everyOptions.map(hours => <option key={hours} value={hours}>{hoursText(hours)}</option>)}</select><span className="mt-1 block font-normal text-[#8b6c38]">هذا الفاصل هو أيضًا موعد عودة كل كلمة غير سهلة للمراجعة.</span></label>}

        <label className="mt-4 flex items-center justify-between rounded-2xl border border-[#eeddb7] bg-white/70 p-4"><span><span className="block text-sm font-bold text-[#5d4519]">تذكير خطة اليوم</span><span className="mt-1 block text-xs text-[#8b6c38]">مرة واحدة في الدورة إن بقيت مهام غير مكتملة.</span></span><Checkbox checked={dailyEnabled} onCheckedChange={value => setDailyEnabled(Boolean(value))} /></label>
        {dailyEnabled && <label className="mt-3 block text-xs font-bold text-[#73582a]">بعد الاستيقاظ بـ<select value={dailyAfter} onChange={event => setDailyAfter(Number(event.target.value))} className={`${selectClass} mt-1`}>{afterOptions.map(hours => <option key={hours} value={hours}>{hoursText(hours)}</option>)}</select></label>}

        <p className="mt-3 text-xs leading-6 text-[#8b6c38]">المنطقة الزمنية لجهازك: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
        <Button variant="outline" onClick={save} disabled={busy} className="mt-4 h-12 w-full border-[#cda95c] bg-white text-[#765116] hover:bg-[#fffdf8]">{busy ? "لحظة..." : "حفظ الدورة والتذكيرات"}</Button>
      </section>
    </>
  );
}
