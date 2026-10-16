import { Button } from "@/components/ui/button";
import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "aec.install-dismissed";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function wasDismissed() {
  try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}

// Invites the learner to install the web app: a real install button on Android/desktop Chrome,
// and a short "Add to Home Screen" instruction on iPhone/iPad where browsers have no install API.
export default function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(true);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return;
    setIos(isIos());
    setHidden(false);
    const onPrompt = (next: Event) => { next.preventDefault(); setEvent(next as InstallEvent); };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  function dismiss() {
    setHidden(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* storage unavailable */ }
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setEvent(null);
    setHidden(true);
  }

  // Nothing to offer: not iOS and the browser has not made the app installable.
  if (hidden || (!event && !ios)) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#d8ad4d]/40 bg-[#fbf5e6] p-4" role="region" aria-label="تثبيت التطبيق">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#123b3b] text-[#d8ad4d]"><Download className="h-5 w-5" /></div>
      <div className="min-w-0 flex-1 text-right">
        <p className="text-sm font-bold text-primary">ثبّت التطبيق على جوالك</p>
        {event ? (
          <p className="mt-1 text-xs leading-6 text-muted-foreground">يفتح من الشاشة الرئيسية كتطبيق كامل ويعمل حتى بدون إنترنت.</p>
        ) : (
          <p className="mt-1 text-xs leading-6 text-muted-foreground">في Safari اضغط زر المشاركة <Share className="mx-0.5 inline h-3.5 w-3.5" /> ثم «إضافة إلى الشاشة الرئيسية».</p>
        )}
        {event && <Button size="sm" onClick={install} className="mt-3 h-10">تثبيت الآن</Button>}
      </div>
      <button onClick={dismiss} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-black/5" aria-label="إخفاء"><X className="h-4 w-4" /></button>
    </div>
  );
}
