import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type AuthResult = { error: { message: string } | null };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signInWithEmail: (email: string) => Promise<AuthResult>;
  verifyEmailCode: (email: string, token: string) => Promise<AuthResult>;
};

export default function LoginDialog({ open, onOpenChange, signInWithEmail, verifyEmailCode }: Props) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) { setSent(false); setCode(""); }
  }

  async function sendEmail(event: React.FormEvent) {
    event.preventDefault();
    const clean = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(clean)) return toast.error("أدخل بريدًا إلكترونيًا صحيحًا.");
    setBusy(true);
    const { error } = await signInWithEmail(clean);
    setBusy(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("أُرسلت رسالة الدخول إلى بريدك.");
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    const token = code.replace(/\s/g, "");
    if (token.length < 6) return toast.error("أدخل الرمز كاملًا كما وصلك في البريد.");
    setBusy(true);
    const { error } = await verifyEmailCode(email.trim(), token);
    setBusy(false);
    if (error) return toast.error("الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا.");
    toast.success("تم تسجيل الدخول.");
    close(false);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent dir="rtl" className="max-w-[calc(100vw-2rem)] rounded-3xl sm:max-w-md">
        <DialogHeader className="pr-8 text-right">
          <DialogTitle>تسجيل الدخول</DialogTitle>
          <DialogDescription>{sent ? "أدخل الرمز الذي وصلك في البريد، أو اضغط على رابط الدخول داخل الرسالة." : "ندخلك ببريدك الإلكتروني بدون كلمة مرور."}</DialogDescription>
        </DialogHeader>
        {!sent ? (
          <form onSubmit={sendEmail} className="space-y-4">
            <Input type="email" inputMode="email" autoComplete="email" dir="ltr" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" className="h-12 text-left" autoFocus />
            <Button type="submit" disabled={busy} className="h-12 w-full"><Mail className="ml-2 h-4 w-4" />{busy ? "جارٍ الإرسال..." : "أرسل رسالة الدخول"}</Button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <Input inputMode="numeric" autoComplete="one-time-code" dir="ltr" value={code} onChange={event => setCode(event.target.value)} placeholder="000000" maxLength={10} className="h-12 text-center text-xl tracking-[0.4em]" autoFocus />
            <Button type="submit" disabled={busy} className="h-12 w-full"><ShieldCheck className="ml-2 h-4 w-4" />{busy ? "جارٍ التحقق..." : "ادخل بالرمز"}</Button>
            <button type="button" onClick={() => { setSent(false); setCode(""); }} className="w-full text-center text-xs text-muted-foreground underline underline-offset-4">استخدم بريدًا آخر أو أعد الإرسال</button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
