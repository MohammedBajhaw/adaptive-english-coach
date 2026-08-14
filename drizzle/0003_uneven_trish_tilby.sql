ALTER TABLE `learner_profiles` ADD `reminderEnabled` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `learner_profiles` ADD `reminderHourUtc` int DEFAULT 17 NOT NULL;--> statement-breakpoint
ALTER TABLE `learner_profiles` ADD `reminderScheduleTaskUid` varchar(65);--> statement-breakpoint
ALTER TABLE `learner_profiles` ADD `lastReminderDateKey` varchar(10);--> statement-breakpoint
CREATE INDEX `learner_profiles_reminder_task_idx` ON `learner_profiles` (`reminderScheduleTaskUid`);