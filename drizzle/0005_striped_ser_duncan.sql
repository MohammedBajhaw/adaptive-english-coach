CREATE TABLE `learner_content_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`contentId` varchar(140) NOT NULL,
	`skill` enum('vocabulary','grammar','listening','speaking','writing') NOT NULL,
	`status` enum('introduced','completed','mastered') NOT NULL DEFAULT 'introduced',
	`firstSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`nextReviewAt` timestamp,
	`completionCount` int NOT NULL DEFAULT 0,
	CONSTRAINT `learner_content_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `learner_content_progress_user_content_unique` UNIQUE(`userId`,`contentId`)
);
--> statement-breakpoint
ALTER TABLE `daily_tasks` ADD `contentId` varchar(140);--> statement-breakpoint
ALTER TABLE `learner_content_progress` ADD CONSTRAINT `learner_content_progress_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `learner_content_progress_user_skill_review_idx` ON `learner_content_progress` (`userId`,`skill`,`nextReviewAt`);