import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KeyRound, Mail, MailCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type AuthResult = { error: { message: string } | null; data?: { session?: unknown } | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signInWithEmail: (email: string) => Promise<AuthResult>;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUpWithPassword: (email: string, password: string) => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
};

type Mode = "password" | "link";

function friendlyError(message: string) {
  if (/invalid login credentials/i.test(message)) return "البريد أو كلمة المرور غير صحيحة. إن لم يكن لديك حساب فاضغط «إنشاء حساب».";
  if (/already registered|already been registered/i.test(message)) return "هذا البريد مسجّل من قبل. اضغط «دخول» بكلمة مرورك.";
  if (/email not confirmed/i.test(message)) return "لم يُفعَّل الحساب بعد. افتح رسالة التفعيل في بريدك.";
  if (/rate limit|too many/i.test(message)) return "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.";
  return message;
}

export default function LoginDialog({ open, onOpenChange, signInWithEmail, signInWithPassword, signUpWithPassword, requestPasswordReset }: Props) {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [busy, setBusy] = useState(false);

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) { setLinkSent(false); setPassword(""); }
  }

  function validEmail() {
    const clean = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(clean)) { toast.error("أدخل بريدًا إلكترونيًا صحيحًا."); return null; }
    return clean;
  }

  async function submitPassword(kind: "in" | "up") {
    const clean = validEmail();
    if (!clean) return;
    if (password.length < 8) return toast.error("كلمة المرور 8 أحرف على الأقل.");
    setBusy(true);
    const result = kind === "in" ? await signInWithPassword(clean, password) : await signUpWithPassword(clean, password);
    setBusy(false);
    if (result.error) return toast.error(friendlyError(result.error.message));
    if (kind === "up" && !result.data?.session) {
      toast.info("أُرسلت رسالة تفعيل إلى بريدك. افتحها ثم ارجع واضغط «دخول».");
      return;
    }
    toast.success(kind === "up" ? "تم إنشاء حسابك." : "تم تسجيل الدخول.");
    close(false);
  }

  async function forgotPassword() {
    if (!email.trim()) return toast.info("اكتب بريدك في الخانة أولًا، ثم اضغط «نسيت كلمة المرور؟».");
    const clean = validEmail();
    if (!clean) return;
    setBusy(true);
    const { error } = await requestPasswordReset(clean);
    setBusy(false);
    if (error) return toast.error(friendlyError(error.message));
    toast.success("أرسلنا إلى بريدك رابطًا لتعيين كلمة مرور جديدة. افتحه من هذا الجهاز.");
  }

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    const clean = validEmail();
    if (!clean) return;
    setBusy(true);
    const { error } = await signInWithEmail(clean);
    setBusy(false);
    if (error) return toast.error(friendlyError(error.message));
    setLinkSent(true);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent dir="rtl" className="max-w-[calc(100vw-2rem)] rounded-3xl sm:max-w-md">
        <DialogHeader className="pr-8 text-right">
          <DialogTitle>تسجيل الدخول</DialogTitle>
          <DialogDescription>{mode === "password" ? "ادخل ببريدك وكلمة مرور. هذه الطريقة تعمل داخل التطبيق المثبّت على الجوال." : "نرسل لك رابط دخول إلى بريدك. افتح الرابط من نفس الجهاز."}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#f0f2ee] p-1" role="tablist">
          <button role="tab" aria-selected={mode === "password"} onClick={() => { setMode("password"); setLinkSent(false); }} className={`h-10 rounded-lg text-sm font-semibold ${mode === "password" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}>كلمة مرور</button>
          <button role="tab" aria-selected={mode === "link"} onClick={() => setMode("link")} className={`h-10 rounded-lg text-sm font-semibold ${mode === "link" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}>رابط بالبريد</button>
        </div>

        {mode === "password" && (
          <form onSubmit={event => { event.preventDefault(); void submitPassword("in"); }} className="space-y-3">
            <Input type="email" inputMode="email" autoComplete="email" dir="ltr" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" className="h-12 text-left" />
            <Input type="password" autoComplete="current-password" dir="ltr" value={password} onChange={event => setPassword(event.target.value)} placeholder="كلمة المرور (8 أحرف أو أكثر)" className="h-12 text-left" />
            <Button type="submit" disabled={busy} className="h-12 w-full"><KeyRound className="ml-2 h-4 w-4" />{busy ? "لحظة..." : "دخول"}</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => void submitPassword("up")} className="h-12 w-full">إنشاء حساب جديد</Button>
            <button type="button" disabled={busy} onClick={() => void forgotPassword()} className="w-full py-2 text-center text-sm text-muted-foreground underline underline-offset-4">نسيت كلمة المرور؟</button>
          </form>
        )}

        {mode === "link" && !linkSent && (
          <form onSubmit={sendLink} className="space-y-3">
            <Input type="email" inputMode="email" autoComplete="email" dir="ltr" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" className="h-12 text-left" />
            <Button type="submit" disabled={busy} className="h-12 w-full"><Mail className="ml-2 h-4 w-4" />{busy ? "جارٍ الإرسال..." : "أرسل رابط الدخول"}</Button>
          </form>
        )}

        {mode === "link" && linkSent && (
          <div className="space-y-2 rounded-2xl bg-[#edf8f0] p-4 text-center">
            <MailCheck className="mx-auto h-8 w-8 text-[#0d7a6e]" />
            <p className="text-sm font-bold text-[#0d7a6e]">أُرسل الرابط إلى بريدك</p>
            <p className="text-xs leading-6 text-muted-foreground">افتح الرسالة من هذا الجوال واضغط على الرابط. إن لم تجدها فابحث في الرسائل غير المرغوبة.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
