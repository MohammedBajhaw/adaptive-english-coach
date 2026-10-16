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
import vocabularyWeek01 from "../../../server/content-library/weeks/week-01/vocabulary.json";
import vocabularyWeek02 from "../../../server/content-library/weeks/week-02/vocabulary.json";
import vocabularyWeek03 from "../../../server/content-library/weeks/week-03/vocabulary.json";
import vocabularyWeek04 from "../../../server/content-library/weeks/week-04/vocabulary.json";
import vocabularyWeek05 from "../../../server/content-library/weeks/week-05/vocabulary.json";
import vocabularyWeek06 from "../../../server/content-library/weeks/week-06/vocabulary.json";

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
// Lessons follow the curriculum in order, starting on the learner's first day,
// so every learner begins with week 1 day 1 regardless of the calendar date.
const START_KEY = "aec.lesson-start-day";

function utcDay(date: Date) {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
}

let learnerStartDay: number | null = null;

function readStoredStartDay() {
  try {
    const raw = globalThis.localStorage?.getItem(START_KEY);
    const value = raw === null || raw === undefined ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

// Called with the learner's first-use date (profile creation) once it is known.
export function setLearnerStartDate(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return;
  learnerStartDay = utcDay(parsed);
  try { globalThis.localStorage?.setItem(START_KEY, String(learnerStartDay)); } catch { /* storage unavailable */ }
}

// Fallback anchor (account creation) for pages opened before the dashboard has loaded the profile.
export function setLearnerStartDateIfMissing(iso: string) {
  if (learnerStartDay === null && readStoredStartDay() === null) setLearnerStartDate(iso);
}

export function getLessonDayIndex(now = new Date()) {
  const today = utcDay(now);
  const start = learnerStartDay ?? readStoredStartDay() ?? today;
  return Math.max(0, today - start);
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

export type LocalVocabularyCard = {
  content_id: string;
  term: string;
  arabic_meaning: string;
  part_of_speech: string;
  ipa: string;
  engineering_domain: string;
  examples: Array<{ english: string; arabic: string }>;
  // Curriculum day (0-based) on which this word becomes available.
  unlock_day: number;
};

function field(markdown: string, label: string) {
  return markdown.match(new RegExp(`^${label}:\\s*(.+)$`, "mi"))?.[1]?.trim() ?? "";
}

// ids look like vocabulary.w05.d03.02 (or vocabulary.w01.d03 in the first four weeks).
function unlockDayOf(id: string) {
  const match = id.match(/\.w(\d+)\.d(\d+)/);
  return match ? (Number(match[1]) - 1) * 7 + (Number(match[2]) - 1) : 0;
}

export function parseVocabularyItem(item: { id: string; titleEnglish: string; contentMarkdown: string }): LocalVocabularyCard {
  const markdown = item.contentMarkdown;
  const examples = Array.from(markdown.matchAll(/^\d+\.\s*(.+)\n\s+(.+)$/gm)).map(([, english, arabic]) => ({ english: english.trim(), arabic: arabic.trim() }));
  return {
    content_id: item.id,
    term: field(markdown, "Term") || item.titleEnglish,
    arabic_meaning: field(markdown, "Arabic meaning"),
    part_of_speech: field(markdown, "Part of speech"),
    ipa: field(markdown, "IPA"),
    engineering_domain: field(markdown, "Mechatronics domain") || "mechatronics",
    examples,
    unlock_day: unlockDayOf(item.id),
  };
}

// Engineering vocabulary in curriculum order. A word is introduced only once its curriculum day has arrived.
export function getLocalVocabularyCards() {
  return itemsOf([vocabularyWeek01, vocabularyWeek02, vocabularyWeek03, vocabularyWeek04, vocabularyWeek05, vocabularyWeek06]).map(parseVocabularyItem);
}
