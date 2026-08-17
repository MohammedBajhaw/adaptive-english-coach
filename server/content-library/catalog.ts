import type { SkillKey } from "../learning-engine";
import { eightWeekContentRoadmap } from "./manifest";
import { localContentPayloads } from "./library";
import type { ContentProgressState, LocalContentItem } from "./types";

const skillNames: Record<SkillKey, string> = {
  vocabulary: "مفردات", grammar: "قواعد", listening: "استماع", speaking: "محادثة", writing: "كتابة",
};

const sourceUrls: Record<SkillKey, string[]> = {
  vocabulary: ["https://wiregrass.libguides.com/c.php?g=1176915&p=8603499"],
  grammar: ["https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference"],
  listening: ["https://learnenglish.britishcouncil.org/free-resources/listening/b1"],
  speaking: ["https://moduldb.htwsaar.de/cgi-bin/moduldb-c?bkeys=mst4&ckeys=m3MST2.EN2&lang=en"],
  writing: ["https://moduldb.htwsaar.de/cgi-bin/moduldb-c?bkeys=mst4&ckeys=m3MST2.EN2&lang=en"],
};

const roadmapByWeek = new Map(eightWeekContentRoadmap.map(week => [week.week, week]));

export const localContentCatalog: LocalContentItem[] = localContentPayloads.map(item => {
  const roadmap = roadmapByWeek.get(item.week);
  const [, , unit] = item.id.split(".");
  return {
    id: item.id,
    skill: item.skill,
    week: item.week,
    unit: unit ?? "d01",
    bodyFile: `content-library/weeks/week-${String(item.week).padStart(2, "0")}/${item.sourceSkill}.json`,
    titleArabic: item.titleArabic || `${skillNames[item.skill]} · ${roadmap?.themeArabic ?? "محتوى محلي"}`,
    objectiveArabic: roadmap?.outcomesArabic.join(" · ") ?? "تدريب عملي موجّه لمهندس ميكاترونيك.",
    promptTemplateId: item.promptTemplateId,
    sourceUrls: item.sourceUrls.length ? item.sourceUrls : sourceUrls[item.skill],
    prerequisiteIds: [],
    reviewAfterDays: [1, 4, 10, 24],
  };
});

export function selectNextLocalContent(input: {
  skill: SkillKey;
  progress: ContentProgressState[];
  excludeContentIds?: string[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const excluded = new Set(input.excludeContentIds ?? []);
  const eligible = localContentCatalog.filter(item => item.skill === input.skill && !excluded.has(item.id));
  const progressById = new Map(input.progress.map(item => [item.contentId, item]));
  const dueReview = eligible
    .filter(item => {
      const state = progressById.get(item.id);
      return state?.nextReviewAt && state.nextReviewAt <= now;
    })
    .sort((left, right) => (progressById.get(left.id)?.nextReviewAt?.getTime() ?? 0) - (progressById.get(right.id)?.nextReviewAt?.getTime() ?? 0));
  if (dueReview[0]) return { item: dueReview[0], mode: "review" as const };
  const active = eligible.find(item => {
    const state = progressById.get(item.id);
    return state?.status === "introduced" && !state.nextReviewAt;
  });
  if (active) return { item: active, mode: "continue" as const };
  const unseen = eligible.find(item => !progressById.has(item.id));
  if (unseen) return { item: unseen, mode: "new" as const };
  const oldest = eligible.sort((left, right) => (progressById.get(left.id)?.lastSeenAt.getTime() ?? 0) - (progressById.get(right.id)?.lastSeenAt.getTime() ?? 0))[0];
  return oldest ? { item: oldest, mode: "reinforce" as const } : null;
}

export function contentCoverage(progress: ContentProgressState[]) {
  return {
    introduced: progress.filter(item => item.status === "introduced").length,
    completed: progress.filter(item => item.status === "completed").length,
    mastered: progress.filter(item => item.status === "mastered").length,
    dueForReview: progress.filter(item => item.nextReviewAt && item.nextReviewAt <= new Date()).length,
  };
}
