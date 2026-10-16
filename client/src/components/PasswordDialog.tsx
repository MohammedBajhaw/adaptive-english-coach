import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updatePassword: (password: string) => Promise<{ error: { message: string } | null }>;
  recovery: boolean;
};

// Sets a new password: after a password-reset link, or any time from the account menu.
export default function PasswordDialog({ open, onOpenChange, updatePassword, recovery }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) return toast.error("كلمة المرور 8 أحرف على الأقل.");
    if (password !== confirm) return toast.error("كلمتا المرور غير متطابقتين.");
    setBusy(true);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) return toast.error(/different from the old/i.test(error.message) ? "اختر كلمة مرور مختلفة عن القديمة." : error.message);
    toast.success("تم حفظ كلمة المرور. يمكنك الدخول بها في أي وقت.");
    setPassword(""); setConfirm("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-[calc(100vw-2rem)] rounded-3xl sm:max-w-md">
        <DialogHeader className="pr-8 text-right">
          <DialogTitle>{recovery ? "اختر كلمة مرور جديدة" : "تعيين كلمة المرور"}</DialogTitle>
          <DialogDescription>اكتب كلمة مرور من 8 أحرف أو أكثر لتدخل بها مع بريدك دون رابط.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Input type="password" autoComplete="new-password" dir="ltr" value={password} onChange={event => setPassword(event.target.value)} placeholder="كلمة المرور الجديدة" className="h-12 text-left" autoFocus />
          <Input type="password" autoComplete="new-password" dir="ltr" value={confirm} onChange={event => setConfirm(event.target.value)} placeholder="أعد كتابتها" className="h-12 text-left" />
          <Button type="submit" disabled={busy} className="h-12 w-full"><KeyRound className="ml-2 h-4 w-4" />{busy ? "لحظة..." : "حفظ كلمة المرور"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
