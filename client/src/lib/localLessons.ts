import { getCycle } from "@/lib/cycle";
import grammarWeek01 from "../../../server/content-library/weeks/week-01/grammar.json";
import grammarWeek02 from "../../../server/content-library/weeks/week-02/grammar.json";
import grammarWeek03 from "../../../server/content-library/weeks/week-03/grammar.json";
import grammarWeek04 from "../../../server/content-library/weeks/week-04/grammar.json";
import grammarWeek05 from "../../../server/content-library/weeks/week-05/grammar.json";
import grammarWeek06 from "../../../server/content-library/weeks/week-06/grammar.json";
import conversationWeek01 from "../../../server/content-library/weeks/week-01/conversation.json";
import conversationWeek02 from "../../../server/content-library/weeks/week-02/conversation.json";
import conversationWeek03 from "../../../server/content-library/weeks/week-03/conversation.json";
import conversationWeek04 from "../../../server/content-library/weeks/week-04/conversation.json";
import conversationWeek05 from "../../../server/content-library/weeks/week-05/conversation.json";
import conversationWeek06 from "../../../server/content-library/weeks/week-06/conversation.json";
import listeningWeek01 from "../../../server/content-library/weeks/week-01/listening.json";
import listeningWeek02 from "../../../server/content-library/weeks/week-02/listening.json";
import listeningWeek03 from "../../../server/content-library/weeks/week-03/listening.json";
import listeningWeek04 from "../../../server/content-library/weeks/week-04/listening.json";
import listeningWeek05 from "../../../server/content-library/weeks/week-05/listening.json";
import listeningWeek06 from "../../../server/content-library/weeks/week-06/listening.json";
import writingWeek01 from "../../../server/content-library/weeks/week-01/writing.json";
import writingWeek02 from "../../../server/content-library/weeks/week-02/writing.json";
import writingWeek03 from "../../../server/content-library/weeks/week-03/writing.json";
import writingWeek04 from "../../../server/content-library/weeks/week-04/writing.json";
import writingWeek05 from "../../../server/content-library/weeks/week-05/writing.json";
import writingWeek06 from "../../../server/content-library/weeks/week-06/writing.json";

type GrammarItem = {
  id: string;
  titleArabic: string;
  titleEnglish: string;
  sourceUrls: string[];
  contentMarkdown: string;
};

type LessonItem = GrammarItem;

function itemsOf(packs: Array<{ items: unknown[] }>) {
  return packs.flatMap(pack => pack.items) as LessonItem[];
}

const grammarItems = itemsOf([grammarWeek01, grammarWeek02, grammarWeek03, grammarWeek04, grammarWeek05, grammarWeek06]);
const conversationItems = itemsOf([conversationWeek01, conversationWeek02, conversationWeek03, conversationWeek04, conversationWeek05, conversationWeek06]);
const listeningItems = itemsOf([listeningWeek01, listeningWeek02, listeningWeek03, listeningWeek04, listeningWeek05, listeningWeek06]);
const writingItems = itemsOf([writingWeek01, writingWeek02, writingWeek03, writingWeek04, writingWeek05, writingWeek06]);

// ---- Lesson day -----------------------------------------------------------
// The daily lesson follows the wake cycle: cycle 1 is week 1 day 1, cycle 2 is day 2, and so on
// (the cycle number is advanced when the learner presses "I woke up").
export function getLessonDayIndex() {
  return Math.max(0, getCycle().number - 1);
}

export const curriculumDays = grammarItems.length;

function pickToday<T>(items: T[]) {
  return items[getLessonDayIndex() % items.length] ?? items[0];
}

export function getTodayGrammarLesson() { return pickToday(grammarItems); }
export function getTodayConversationLesson() { return pickToday(conversationItems); }
export function getTodayListeningLesson() { return pickToday(listeningItems); }
export function getTodayWritingLesson() { return pickToday(writingItems); }

export function getTodayContentIds() {
  return {
    vocabulary: `vocabulary.local.${getLessonDayIndex() % curriculumDays}`,
    grammar: getTodayGrammarLesson().id,
    listening: getTodayListeningLesson().id,
    speaking: getTodayConversationLesson().id,
    writing: getTodayWritingLesson().id,
  };
}
