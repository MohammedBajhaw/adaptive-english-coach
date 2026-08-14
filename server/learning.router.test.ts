import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  completeDailyTask: vi.fn(),
  ensureLearnerWorkspace: vi.fn(),
  getDueCards: vi.fn(),
  getLearningDashboard: vi.fn(),
  getProgressReports: vi.fn(),
  getRecentActivity: vi.fn(),
  rateVocabularyCard: vi.fn(),
  submitConversationEvaluation: vi.fn(),
  submitDiagnosticAttempt: vi.fn(),
  updateLearnerProfile: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import { appRouter } from "./routers";

function createContext(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "learning-test-user",
      email: "test@example.com",
      name: "Learning Test",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("learning protected routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.submitConversationEvaluation.mockResolvedValue(78);
    dbMocks.rateVocabularyCard.mockResolvedValue({ nextStrength: 2, nextReviewAt: new Date() });
    dbMocks.getProgressReports.mockResolvedValue({ weekly: { snapshotCount: 2, skills: [] }, monthly: { snapshotCount: 4, skills: [] } });
  });

  it("passes a conversation evaluation through the authenticated server route", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.learning.conversation.submitScore({ scoreOutOfTen: 7.8, prompt: "daily mechatronics prompt" });

    expect(result).toBe(78);
    expect(dbMocks.submitConversationEvaluation).toHaveBeenCalledWith(42, { scoreOutOfTen: 7.8, prompt: "daily mechatronics prompt" });
  });

  it("passes the final card rating through the authenticated vocabulary route", async () => {
    const caller = appRouter.createCaller(createContext());
    await caller.learning.cards.rate({ cardId: 9, rating: "good" });

    expect(dbMocks.rateVocabularyCard).toHaveBeenCalledWith(42, 9, "good");
  });

  it("returns the authenticated learner’s aggregated reports through the reports route", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.learning.reports();

    expect(dbMocks.getProgressReports).toHaveBeenCalledWith(42);
    expect(result).toEqual({ weekly: { snapshotCount: 2, skills: [] }, monthly: { snapshotCount: 4, skills: [] } });
  });
});
