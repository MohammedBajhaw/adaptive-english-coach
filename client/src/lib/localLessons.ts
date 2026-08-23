import grammarWeek01 from "../../../server/content-library/weeks/week-01/grammar.json";
import grammarWeek02 from "../../../server/content-library/weeks/week-02/grammar.json";
import grammarWeek03 from "../../../server/content-library/weeks/week-03/grammar.json";
import grammarWeek04 from "../../../server/content-library/weeks/week-04/grammar.json";
import conversationWeek01 from "../../../server/content-library/weeks/week-01/conversation.json";
import conversationWeek02 from "../../../server/content-library/weeks/week-02/conversation.json";
import conversationWeek03 from "../../../server/content-library/weeks/week-03/conversation.json";
import conversationWeek04 from "../../../server/content-library/weeks/week-04/conversation.json";
import listeningWeek01 from "../../../server/content-library/weeks/week-01/listening.json";
import listeningWeek02 from "../../../server/content-library/weeks/week-02/listening.json";
import listeningWeek03 from "../../../server/content-library/weeks/week-03/listening.json";
import listeningWeek04 from "../../../server/content-library/weeks/week-04/listening.json";
import writingWeek01 from "../../../server/content-library/weeks/week-01/writing.json";
import writingWeek02 from "../../../server/content-library/weeks/week-02/writing.json";
import writingWeek03 from "../../../server/content-library/weeks/week-03/writing.json";
import writingWeek04 from "../../../server/content-library/weeks/week-04/writing.json";

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

export function getTodayConversationLesson() {
  const items = [...conversationWeek01.items, ...conversationWeek02.items, ...conversationWeek03.items, ...conversationWeek04.items];
  const base = new Date(Date.UTC(2026, 0, 1));
  const today = new Date();
  const dayIndex = Math.max(0, Math.floor((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - base.getTime()) / 86_400_000));
  return items[dayIndex % items.length] ?? items[0];
}

export function getTodayListeningLesson() {
  const items = [...listeningWeek01.items, ...listeningWeek02.items, ...listeningWeek03.items, ...listeningWeek04.items];
  const base = new Date(Date.UTC(2026, 0, 1));
  const today = new Date();
  const dayIndex = Math.max(0, Math.floor((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - base.getTime()) / 86_400_000));
  return items[dayIndex % items.length] ?? items[0];
}

export function getTodayWritingLesson() {
  const items = [...writingWeek01.items, ...writingWeek02.items, ...writingWeek03.items, ...writingWeek04.items];
  const base = new Date(Date.UTC(2026, 0, 1));
  const today = new Date();
  const dayIndex = Math.max(0, Math.floor((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - base.getTime()) / 86_400_000));
  return items[dayIndex % items.length] ?? items[0];
}

export function getTodayContentIds() {
  const grammar = getTodayGrammarLesson();
  const conversation = getTodayConversationLesson();
  const listening = getTodayListeningLesson();
  const writing = getTodayWritingLesson();
  const base = new Date(Date.UTC(2026, 0, 1));
  const today = new Date();
  const dayIndex = Math.max(0, Math.floor((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - base.getTime()) / 86_400_000));
  return {
    vocabulary: `vocabulary.local.${dayIndex % 28}`,
    grammar: grammar.id,
    listening: listening.id,
    speaking: conversation.id,
    writing: writing.id,
  };
}
