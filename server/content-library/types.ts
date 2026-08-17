import type { SkillKey } from "../learning-engine";

export type LocalContentItem = {
  id: string;
  skill: SkillKey;
  week: number;
  unit: string;
  bodyFile: string;
  titleArabic: string;
  objectiveArabic: string;
  promptTemplateId: string;
  sourceUrls: string[];
  prerequisiteIds: string[];
  reviewAfterDays: number[];
};

export type ContentProgressState = {
  contentId: string;
  status: "introduced" | "completed" | "mastered";
  lastSeenAt: Date;
  nextReviewAt: Date | null;
};

export type ContentWeek = {
  week: number;
  themeArabic: string;
  themeEnglish: string;
  outcomesArabic: string[];
  itemIds: string[];
};
