import type { SkillKey } from "../learning-engine";
import week01Conversation from "./weeks/week-01/conversation.json";
import week01Grammar from "./weeks/week-01/grammar.json";
import week01Listening from "./weeks/week-01/listening.json";
import week01Vocabulary from "./weeks/week-01/vocabulary.json";
import week01Writing from "./weeks/week-01/writing.json";
import week02Conversation from "./weeks/week-02/conversation.json";
import week02Grammar from "./weeks/week-02/grammar.json";
import week02Listening from "./weeks/week-02/listening.json";
import week02Vocabulary from "./weeks/week-02/vocabulary.json";
import week02Writing from "./weeks/week-02/writing.json";
import week03Conversation from "./weeks/week-03/conversation.json";
import week03Grammar from "./weeks/week-03/grammar.json";
import week03Listening from "./weeks/week-03/listening.json";
import week03Vocabulary from "./weeks/week-03/vocabulary.json";
import week03Writing from "./weeks/week-03/writing.json";
import week04Conversation from "./weeks/week-04/conversation.json";
import week04Grammar from "./weeks/week-04/grammar.json";
import week04Listening from "./weeks/week-04/listening.json";
import week04Vocabulary from "./weeks/week-04/vocabulary.json";
import week04Writing from "./weeks/week-04/writing.json";

type ContentSourceSkill = "vocabulary" | "grammar" | "conversation" | "listening" | "writing";

type ContentPackItem = {
  id: string;
  titleArabic: string;
  titleEnglish: string;
  promptTemplateId: string;
  sourceUrls: string[];
  contentMarkdown: string;
};

type ContentPack = {
  week: number;
  skill: ContentSourceSkill;
  items: ContentPackItem[];
};

export type LocalContentPayload = ContentPackItem & {
  week: number;
  skill: SkillKey;
  sourceSkill: ContentSourceSkill;
};

const packs = [
  week01Vocabulary, week01Grammar, week01Conversation, week01Listening, week01Writing,
  week02Vocabulary, week02Grammar, week02Conversation, week02Listening, week02Writing,
  week03Vocabulary, week03Grammar, week03Conversation, week03Listening, week03Writing,
  week04Vocabulary, week04Grammar, week04Conversation, week04Listening, week04Writing,
] as unknown as ContentPack[];

function normalizedSkill(skill: ContentSourceSkill): SkillKey {
  return skill === "conversation" ? "speaking" : skill;
}

export const localContentPayloads: LocalContentPayload[] = packs.flatMap(pack =>
  pack.items.map(item => ({
    ...item,
    week: pack.week,
    skill: normalizedSkill(pack.skill),
    sourceSkill: pack.skill,
  })),
);

const payloadById = new Map(localContentPayloads.map(item => [item.id, item]));

export function getLocalContentPayload(contentId: string) {
  return payloadById.get(contentId) ?? null;
}
