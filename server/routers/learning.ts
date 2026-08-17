import { z } from "zod";
import {
  completeDailyTask,
  ensureLearnerWorkspace,
  getTodayLocalContent,
  getDueCards,
  getLearningDashboard,
  getProgressReports,
  getRecentActivity,
  rateVocabularyCard,
  submitConversationEvaluation,
  submitDiagnosticAttempt,
  updateLearnerProfile,
  getReminderProfile,
  getLearnerNotifications,
  markLearnerNotificationRead,
  updateReminderPreferences,
} from "../db";
import { correctWritingWithConfiguredProvider, getCorrectionProviderStatus } from "../ai-correction";
import { createHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { reminderCron } from "../reminder-engine";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { protectedProcedure, router } from "../_core/trpc";

const skillSchema = z.enum(["vocabulary", "grammar", "listening", "speaking", "writing"]);

export const learningRouter = router({
  dashboard: router({
    get: protectedProcedure.query(({ ctx }) => getLearningDashboard(ctx.user.id)),
  }),
  content: router({
    today: protectedProcedure.query(({ ctx }) => getTodayLocalContent(ctx.user.id)),
  }),
  profile: router({
    get: protectedProcedure.query(({ ctx }) => ensureLearnerWorkspace(ctx.user.id)),
    update: protectedProcedure.input(z.object({
      dailyMinutes: z.number().int().min(10).max(180),
      studyMode: z.enum(["steady", "balanced", "intensive"]),
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
  writing: router({
    providerStatus: protectedProcedure.query(() => getCorrectionProviderStatus()),
    correct: protectedProcedure.input(z.object({ text: z.string().min(8).max(5000), context: z.string().min(2).max(1200) }))
      .mutation(({ input }) => correctWritingWithConfiguredProvider(input)),
  }),
  reminders: router({
    get: protectedProcedure.query(({ ctx }) => getReminderProfile(ctx.user.id)),
    update: protectedProcedure.input(z.object({ enabled: z.boolean(), hourUtc: z.number().int().min(0).max(23) })).mutation(async ({ ctx, input }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const current = await getReminderProfile(ctx.user.id);
      const cron = reminderCron(input.hourUtc);
      if (current.reminderScheduleTaskUid) {
        await updateHeartbeatJob(current.reminderScheduleTaskUid, { cron, path: "/api/scheduled/learning-reminder", description: "Daily learning reminder", enable: input.enabled }, sessionToken);
        return updateReminderPreferences(ctx.user.id, input);
      }
      if (!input.enabled) return updateReminderPreferences(ctx.user.id, input);
      const job = await createHeartbeatJob({ name: `learning-reminder-${ctx.user.id}`, cron, path: "/api/scheduled/learning-reminder", description: "Daily learning reminder" }, sessionToken);
      return updateReminderPreferences(ctx.user.id, { ...input, taskUid: job.taskUid });
    }),
  }),
  notifications: router({
    list: protectedProcedure.query(({ ctx }) => getLearnerNotifications(ctx.user.id)),
    markRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(({ ctx, input }) => markLearnerNotificationRead(ctx.user.id, input.notificationId)),
  }),
});
