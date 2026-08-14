import { z } from "zod";
import {
  completeDailyTask,
  ensureLearnerWorkspace,
  getDueCards,
  getLearningDashboard,
  getProgressReports,
  getRecentActivity,
  rateVocabularyCard,
  submitConversationEvaluation,
  submitDiagnosticAttempt,
  updateLearnerProfile,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const skillSchema = z.enum(["vocabulary", "grammar", "listening", "speaking", "writing"]);

export const learningRouter = router({
  dashboard: router({
    get: protectedProcedure.query(({ ctx }) => getLearningDashboard(ctx.user.id)),
  }),
  profile: router({
    get: protectedProcedure.query(({ ctx }) => ensureLearnerWorkspace(ctx.user.id)),
    update: protectedProcedure.input(z.object({
      dailyMinutes: z.number().int().min(30).max(180),
      engineeringSpecialty: z.string().min(2).max(80),
      goalTracks: z.array(z.enum(["job_interviews", "daily_work", "general_communication"])).min(1).max(3),
      vocabularyWeight: z.number().int().min(5).max(70),
      grammarWeight: z.number().int().min(5).max(70),
      listeningWeight: z.number().int().min(5).max(70),
      speakingWeight: z.number().int().min(5).max(70),
      writingWeight: z.number().int().min(5).max(70),
    })).mutation(({ ctx, input }) => updateLearnerProfile(ctx.user.id, { ...input, goalTrack: input.goalTracks.join(",") })),
  }),
  diagnostic: router({
    submit: protectedProcedure.input(z.object({
      skill: skillSchema,
      evidenceType: z.string().min(2).max(40),
      prompt: z.string().min(2).max(1200),
      response: z.string().min(1).max(5000),
      score: z.number().min(0).max(100),
    })).mutation(({ ctx, input }) => submitDiagnosticAttempt(ctx.user.id, input)),
  }),
  conversation: router({
    submitScore: protectedProcedure.input(z.object({ scoreOutOfTen: z.number().min(0).max(10), prompt: z.string().min(2).max(1200) }))
      .mutation(({ ctx, input }) => submitConversationEvaluation(ctx.user.id, input)),
  }),
  tasks: router({
    complete: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), completed: z.boolean() }))
      .mutation(({ ctx, input }) => completeDailyTask(ctx.user.id, input.taskId, input.completed)),
  }),
  cards: router({
    due: protectedProcedure.query(({ ctx }) => getDueCards(ctx.user.id)),
    rate: protectedProcedure.input(z.object({ cardId: z.number().int().positive(), rating: z.enum(["again", "hard", "good", "easy"]) }))
      .mutation(({ ctx, input }) => rateVocabularyCard(ctx.user.id, input.cardId, input.rating)),
  }),
  activity: protectedProcedure.query(({ ctx }) => getRecentActivity(ctx.user.id)),
  reports: protectedProcedure.query(({ ctx }) => getProgressReports(ctx.user.id)),
});
