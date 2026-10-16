import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { disablePush, enablePush, getPushState, showTestNotification, syncSubscription, type PushState } from "@/lib/push";
import { getSupabase } from "@/lib/supabase";
import { Bell, BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const everyOptions = [1, 2, 3, 4, 6];
const hourLabel = (hour: number) => `${String(hour % 24).padStart(2, "0")}:00`;
const selectClass = "h-12 w-full rounded-2xl border border-[#eeddb7] bg-white px-3 text-sm text-[#5d4519] outline-none focus:ring-2 focus:ring-[#e0c48f]";

type Props = { userId: string | undefined; isAuthenticated: boolean };

const stateText: Record<PushState, string> = {
  unsupported: "هذا المتصفح لا يدعم إشعارات الجوال. جرّب Chrome على أندرويد.",
  "needs-install": "على الآيفون تعمل الإشعارات فقط بعد إضافة التطبيق إلى الشاشة الرئيسية (مشاركة ← إضافة إلى الشاشة الرئيسية)، ثم افتحه من هناك.",
  denied: "الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح ثم أعد المحاولة.",
  off: "التنبيهات غير مفعّلة على هذا الجهاز.",
  on: "التنبيهات مفعّلة على هذا الجهاز.",
};

// Phone reminders: vocabulary review every few hours and a daily-plan reminder at a time the learner chooses.
export default function ReminderSettings({ userId, isAuthenticated }: Props) {
  const [state, setState] = useState<PushState>("off");
  const [vocabEnabled, setVocabEnabled] = useState(true);
  const [every, setEvery] = useState(3);
  const [windowStart, setWindowStart] = useState(9);
  const [windowEnd, setWindowEnd] = useState(21);
  const [dailyEnabled, setDailyEnabled] = useState(true);
  const [dailyHour, setDailyHour] = useState(20);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getPushState().then(setState);
    if (!isAuthenticated || !userId) return;
    void syncSubscription(userId).catch(() => undefined);
    void (getSupabase() as any).from("learner_profiles").select("*").eq("user_id", userId).maybeSingle().then(({ data }: { data: any }) => {
      if (!data || data.reminder_hour_local === undefined) return;
      setVocabEnabled(Boolean(data.vocab_reminder_enabled));
      setEvery(data.vocab_reminder_every_hours);
      setWindowStart(data.reminder_window_start);
      setWindowEnd(data.reminder_window_end);
      setDailyEnabled(Boolean(data.reminder_enabled));
      setDailyHour(data.reminder_hour_local);
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

  async function save() {
    if (!userId) return toast.info("سجل دخولك لحفظ تفضيلات التذكير.");
    if (windowStart >= windowEnd) return toast.error("بداية نافذة التذكير يجب أن تسبق نهايتها.");
    setBusy(true);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const { error } = await (getSupabase() as any).from("learner_profiles").update({
      timezone,
      vocab_reminder_enabled: vocabEnabled,
      vocab_reminder_every_hours: every,
      reminder_window_start: windowStart,
      reminder_window_end: windowEnd,
      reminder_enabled: dailyEnabled,
      reminder_hour_local: dailyHour,
    }).eq("user_id", userId);
    setBusy(false);
    if (error) return toast.error(/column|schema/.test(error.message) ? "أعمدة التذكير غير موجودة بعد في Supabase. شغّل ملف الهجرة 002 أولًا." : error.message);
    toast.success("تم حفظ تفضيلات التذكير.");
  }

  const canToggle = state === "off" || state === "on";
  return (
    <section className="rounded-[24px] bg-[#fff9eb] p-5 soft-shadow sm:p-7">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f5e3ae] text-[#9b6816]"><Bell className="h-5 w-5" /></div>
        <div><h2 className="font-bold text-[#5d4519]">تنبيهات الجوال</h2><p className="text-xs text-[#73582a]">تصلك حتى والتطبيق مغلق: تذكير بمراجعة المفردات كل بضع ساعات، وتذكير بخطة اليوم في الوقت الذي تحدده.</p></div>
      </div>

      <div className="mt-5 rounded-2xl border border-[#eeddb7] bg-white/70 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-[#5d4519]">{state === "on" ? <BellRing className="h-4 w-4 text-[#0d7a6e]" /> : <BellOff className="h-4 w-4 text-[#8b6c38]" />}{stateText[state]}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {canToggle && <Button onClick={toggleDevice} disabled={busy} className="h-11 flex-1">{state === "on" ? "إيقاف على هذا الجهاز" : "فعّل التنبيهات على هذا الجهاز"}</Button>}
          {state === "on" && <Button variant="outline" onClick={test} className="h-11 flex-1">تنبيه تجريبي</Button>}
        </div>
      </div>

      <label className="mt-4 flex items-center justify-between rounded-2xl border border-[#eeddb7] bg-white/70 p-4"><span><span className="block text-sm font-bold text-[#5d4519]">تذكير مراجعة المفردات</span><span className="mt-1 block text-xs text-[#8b6c38]">يتوقف تلقائيًا بعد إكمال مفردات اليوم.</span></span><Checkbox checked={vocabEnabled} onCheckedChange={value => setVocabEnabled(Boolean(value))} /></label>
      {vocabEnabled && <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-bold text-[#73582a]">كل<select value={every} onChange={event => setEvery(Number(event.target.value))} className={`${selectClass} mt-1`}>{everyOptions.map(hours => <option key={hours} value={hours}>{hours === 1 ? "ساعة" : hours === 2 ? "ساعتين" : `${hours} ساعات`}</option>)}</select></label>
        <label className="text-xs font-bold text-[#73582a]">من الساعة<select value={windowStart} onChange={event => setWindowStart(Number(event.target.value))} className={`${selectClass} mt-1`} dir="ltr">{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></label>
        <label className="text-xs font-bold text-[#73582a]">إلى الساعة<select value={windowEnd} onChange={event => setWindowEnd(Number(event.target.value))} className={`${selectClass} mt-1`} dir="ltr">{Array.from({ length: 24 }, (_, index) => index + 1).map(hour => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></label>
      </div>}

      <label className="mt-4 flex items-center justify-between rounded-2xl border border-[#eeddb7] bg-white/70 p-4"><span><span className="block text-sm font-bold text-[#5d4519]">تذكير خطة اليوم</span><span className="mt-1 block text-xs text-[#8b6c38]">مرة واحدة يوميًا إن بقيت مهام غير مكتملة.</span></span><Checkbox checked={dailyEnabled} onCheckedChange={value => setDailyEnabled(Boolean(value))} /></label>
      {dailyEnabled && <label className="mt-3 block text-xs font-bold text-[#73582a]">في الساعة<select value={dailyHour} onChange={event => setDailyHour(Number(event.target.value))} className={`${selectClass} mt-1`} dir="ltr">{Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}</select></label>}
      <p className="mt-3 text-xs leading-6 text-[#8b6c38]">الأوقات بتوقيت جهازك: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>

      <Button variant="outline" onClick={save} disabled={busy} className="mt-4 h-12 w-full border-[#cda95c] bg-white text-[#765116] hover:bg-[#fffdf8]">{busy ? "لحظة..." : "حفظ تفضيلات التذكير"}</Button>
    </section>
  );
}
