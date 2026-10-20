import { speak } from "@/lib/speech";
import { levelLabels, type BankLevel } from "@/lib/vocabularyBank";
import { AudioLines, BookOpenCheck } from "lucide-react";
import { useState } from "react";

type Props = {
  card: any;
  badge?: string;           // for example "كلمة جديدة" or "مراجعة"
  footer?: React.ReactNode; // the rating buttons in the session; nothing when only viewing
};

// One vocabulary card: term, pronunciation, Arabic meaning, definition and translated examples.
export default function VocabCardView({ card, badge, footer }: Props) {
  const [examplesOpen, setExamplesOpen] = useState(true);
  const examples: Array<{ english: string; arabic: string }> = Array.isArray(card.examples)
    ? card.examples.map((item: any) => (typeof item === "string" ? { english: item, arabic: "" } : item))
    : [];
  return (
    <section className="overflow-hidden rounded-[30px] border border-border bg-white soft-shadow">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-[#fbfcf9] px-5 py-3.5 text-xs text-muted-foreground">
        {badge && <span className="rounded-lg bg-[#1f4c4c] px-2 py-1 font-bold text-white">{badge}</span>}
        <span className="rounded-lg bg-[#eaf6ed] px-2 py-1 font-bold text-[#0d7a6e]" dir="ltr">{card.category ?? card.engineering_domain}</span>
        {card.level && <span className="rounded-lg bg-[#eef1fa] px-2 py-1 font-bold text-[#4d60a1]">{levelLabels[card.level as BankLevel] ?? card.level}</span>}
        {card.interviewPriority && <span className="rounded-lg bg-[#f5e3ae] px-2 py-1 font-bold text-[#7a5413]">مهم للمقابلات</span>}
        {card.stageName && <span>{card.stageName}</span>}
      </div>
      <div className="p-5 sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-4" dir="ltr">
          <div className="min-w-0 flex-1">
            <h2 className="break-words font-['DM_Sans'] text-3xl font-bold leading-tight tracking-tight text-primary sm:text-5xl">{card.term}</h2>
            <p className="mt-3 font-['DM_Sans'] text-base text-muted-foreground">{card.pronunciation ?? card.ipa}</p>
          </div>
          <button onClick={() => speak(card.term)} className="grid h-12 w-12 place-items-center rounded-2xl border border-[#b7d9c8] bg-[#f4fbf6] text-[#0d7a6e] hover:bg-[#e7f5ec]" aria-label="نطق الكلمة">
            <AudioLines className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-6 text-lg font-semibold text-[#3b514d]">{card.arabic_meaning}</p>
        {card.definition && <p className="mt-2 text-sm leading-7 text-muted-foreground" dir="ltr">{card.definition}</p>}
        {examples.length > 0 && (
          <>
            <div className="mt-6 flex items-center justify-between">
              <button onClick={() => setExamplesOpen(value => !value)} className="flex items-center gap-2 text-sm font-bold text-primary"><BookOpenCheck className="h-4 w-4" />{examplesOpen ? "إخفاء الأمثلة" : "عرض الأمثلة المترجمة"}</button>
              <span className="text-xs text-muted-foreground">اضغط رمز الصوت لنطق الجملة</span>
            </div>
            {examplesOpen && (
              <div className="mt-4 space-y-2.5">
                {examples.map((example, index) => (
                  <div key={example.english} className="flex items-start gap-3 rounded-2xl border border-border bg-[#fcfdfb] px-3 py-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#edf2ef] text-xs font-bold text-[#51635f]">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-['DM_Sans'] text-sm text-[#314845]" dir="ltr">{example.english}</p>
                      {example.arabic && <p className="mt-1 text-xs leading-6 text-muted-foreground">{example.arabic}</p>}
                    </div>
                    <button onClick={() => speak(example.english)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#0d7a6e] hover:bg-[#e8f4ed]" aria-label={`نطق الجملة ${index + 1}`}><AudioLines className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {footer}
    </section>
  );
}
