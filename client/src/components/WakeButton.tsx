import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCycle } from "@/hooks/useCycle";
import { MIN_HOURS_BEFORE_WAKE, canWakeWithoutConfirm } from "@/lib/cycle";
import { wakeUp } from "@/lib/supabaseLearning";
import { Sunrise } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Props = { userId: string | undefined; label?: string; variant?: "default" | "outline"; className?: string };

// "I woke up": starts a new cycle. Very early in a cycle it asks first, because it advances the daily lesson.
export default function WakeButton({ userId, label = "استيقظت الآن", variant = "default", className }: Props) {
  const cycle = useCycle();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function run() {
    if (!userId) return toast.info("سجل دخولك أولًا.");
    setBusy(true);
    try {
      await wakeUp(userId);
      toast.success("بدأت دورة جديدة. يوم موفق!");
      // A full reload gives every page the new day: today's tasks, lesson and word session.
      window.location.assign(import.meta.env.BASE_URL);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر بدء الدورة الجديدة.");
      setBusy(false);
    }
  }

  function click() {
    if (canWakeWithoutConfirm(cycle, new Date())) void run();
    else setConfirmOpen(true);
  }

  return (
    <>
      <Button variant={variant} onClick={click} disabled={busy} className={className}><Sunrise className="ml-2 h-4 w-4" />{busy ? "لحظة..." : label}</Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent dir="rtl" className="max-w-[calc(100vw-2rem)] rounded-3xl sm:max-w-md">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>بدء دورة جديدة الآن؟</AlertDialogTitle>
            <AlertDialogDescription>لم تمضِ {MIN_HOURS_BEFORE_WAKE} ساعات على بداية دورتك الحالية. بدء دورة جديدة ينقلك إلى درس اليوم التالي ويفتح مهامه. هل استيقظت فعلًا؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start">
            <AlertDialogAction onClick={() => void run()}>نعم، استيقظت</AlertDialogAction>
            <AlertDialogCancel>لا، ابقَ في دورتي</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
