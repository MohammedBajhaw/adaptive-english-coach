import { getSupabase } from "@/lib/supabase";

// Public VAPID key (safe to ship). The private half lives only in the Supabase secrets of the send-reminders function.
export const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "BIeiOHguSgqYMVXGau9wBieuyO3Flcqg7Q-aoQpCmd1E2O_OAhRT3pfv7WuP-ruSBE30KKvAsz5jzJ-GOPz8FjE";

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

function keyToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("service worker not ready")), ms))]);
}

async function registration() {
  return withTimeout(navigator.serviceWorker.ready, 4000);
}

// iPhone and iPad only deliver push notifications to an app added to the Home Screen.
export async function getPushState(): Promise<PushState> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  try {
    const subscription = await (await registration()).pushManager.getSubscription();
    return subscription && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "unsupported";
  }
}

async function saveSubscription(userId: string, subscription: PushSubscription) {
  const json = subscription.toJSON();
  const keys = json.keys;
  if (!json.endpoint || !keys?.p256dh || !keys.auth) throw new Error("اشتراك الإشعارات غير مكتمل.");
  const { error } = await (getSupabase() as any).from("push_subscriptions").upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: keys.p256dh, auth: keys.auth, user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(/push_subscriptions/.test(error.message) ? "جدول الإشعارات غير موجود بعد في Supabase. شغّل ملف الهجرة 002 أولًا." : error.message);
}

export async function enablePush(userId: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("لم يُسمح بالإشعارات. فعّلها من إعدادات المتصفح أو التطبيق.");
  const reg = await registration();
  const subscription = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) });
  await saveSubscription(userId, subscription);
}

export async function disablePush() {
  const subscription = await (await registration()).pushManager.getSubscription();
  if (!subscription) return;
  await (getSupabase() as any).from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}

// Keeps the stored device row current (for example after reinstalling the app).
export async function syncSubscription(userId: string) {
  if (Notification.permission !== "granted") return;
  const subscription = await (await registration()).pushManager.getSubscription();
  if (subscription) await saveSubscription(userId, subscription);
}

export async function showTestNotification() {
  const reg = await registration();
  await reg.showNotification("مهندس الإنجليزية", { body: "هكذا ستصلك التذكيرات على هذا الجهاز.", icon: `${import.meta.env.BASE_URL}icons/icon-192.png`, lang: "ar", dir: "rtl", tag: "test" });
}
