import { toast } from "sonner";

// Reads an English word or sentence aloud with the browser's speech engine.
export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    toast.info("النطق غير متاح في هذا المتصفح.");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
