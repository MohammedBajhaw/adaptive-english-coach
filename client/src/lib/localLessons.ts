import grammarWeek01 from "../../../server/content-library/weeks/week-01/grammar.json";
import grammarWeek02 from "../../../server/content-library/weeks/week-02/grammar.json";
import grammarWeek03 from "../../../server/content-library/weeks/week-03/grammar.json";
import grammarWeek04 from "../../../server/content-library/weeks/week-04/grammar.json";

type GrammarItem = {
  id: string;
  titleArabic: string;
  titleEnglish: string;
  sourceUrls: string[];
  contentMarkdown: string;
};

const grammarItems = [
  ...grammarWeek01.items,
  ...grammarWeek02.items,
  ...grammarWeek03.items,
  ...grammarWeek04.items,
] as GrammarItem[];

export function getTodayGrammarLesson() {
  const base = new Date(Date.UTC(2026, 0, 1));
  const today = new Date();
  const dayIndex = Math.max(0, Math.floor((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - base.getTime()) / 86_400_000));
  return grammarItems[dayIndex % grammarItems.length] ?? grammarItems[0];
}
