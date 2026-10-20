import VocabCardView from "@/components/VocabCardView";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cycleWords, ratingLabels, ratingOrder, type Rating } from "@/lib/vocabSession";
import { useMemo, useState } from "react";

type Props = { cards: any[]; openedAt: string | null };
type Scope = "cycle" | "all";
type Filter = "all" | Rating;

const chipColors: Record<Rating, string> = {
  again: "bg-[#fdeeee] text-[#a54444]",
  hard: "bg-[#fbf1d9] text-[#9b6816]",
  good: "bg-[#e6f5ec] text-[#0d7a6e]",
  easy: "bg-[#e8f1fa] text-[#2a73a2]",
};

// The words of the current cycle (and all the learner's words) with a filter by the latest rating.
// Everything stays visible after the session ends, so the learner can come back to any word.
export default function CycleWords({ cards, openedAt }: Props) {
  const [scope, setScope] = useState<Scope>("cycle");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<any | null>(null);

  const pool = useMemo(() => {
    if (scope === "cycle") return cycleWords(cards, openedAt);
    return cards.filter(card => card.review_count).sort((a, b) => (b.last_reviewed_at ?? b.intake_at ?? "").localeCompare(a.last_reviewed_at ?? a.intake_at ?? ""));
  }, [cards, openedAt, scope]);

  const counts = useMemo(() => {
    const result: Record<Filter, number> = { all: pool.length, again: 0, hard: 0, good: 0, easy: 0 };
    for (const card of pool) if (card.last_rating) result[card.last_rating as Rating] += 1;
    return result;
  }, [pool]);

  const visible = filter === "all" ? pool : pool.filter(card => card.last_rating === filter);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#f0f2ee] p-1" role="tablist" aria-label="نطاق الكلمات">
        <button role="tab" aria-selected={scope === "cycle"} onClick={() => setScope("cycle")} className={`h-10 rounded-lg text-sm font-semibold ${scope === "cycle" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}>كلمات هذه الدورة</button>
        <button role="tab" aria-selected={scope === "all"} onClick={() => setScope("all")} className={`h-10 rounded-lg text-sm font-semibold ${scope === "all" ? "bg-white text-primary shadow-sm" : "text-muted-foreground"}`}>كل كلماتي</button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="تصفية حسب التقييم">
        {(["all", ...ratingOrder] as Filter[]).map(key => (
          <button key={key} onClick={() => setFilter(key)} aria-pressed={filter === key} className={`h-10 shrink-0 rounded-full border px-4 text-sm font-semibold ${filter === key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white text-primary"}`}>
            {key === "all" ? "الكل" : ratingLabels[key]} <span className="mr-1 opacity-70">{counts[key]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-sm leading-7 text-muted-foreground">{pool.length === 0 ? "لا توجد كلمات بعد في هذه الدورة. ابدأ الجلسة وستظهر هنا." : "لا توجد كلمات بهذا التقييم."}</p>
      ) : (
        <ul className="space-y-2">
          {visible.map(card => (
            <li key={card.id}>
              <button onClick={() => setOpen(card)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 text-right hover:bg-[#fbfcf9]">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-['DM_Sans'] text-base font-bold text-primary" dir="ltr">{card.term}</p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{card.arabic_meaning}</p>
                </div>
                {card.last_rating && <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${chipColors[card.last_rating as Rating]}`}>{ratingLabels[card.last_rating as Rating]}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open !== null} onOpenChange={value => { if (!value) setOpen(null); }}>
        <DialogContent dir="rtl" className="max-h-[92dvh] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-3xl p-2 sm:max-w-xl">
          <DialogHeader className="sr-only"><DialogTitle>{open?.term}</DialogTitle><DialogDescription>بطاقة الكلمة</DialogDescription></DialogHeader>
          {open && <VocabCardView card={open} badge={open.last_rating ? ratingLabels[open.last_rating as Rating] : undefined} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
