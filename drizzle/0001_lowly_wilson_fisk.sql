CREATE TABLE `card_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cardId` int NOT NULL,
	`rating` enum('again','hard','good','easy') NOT NULL,
	`strengthAfter` int NOT NULL,
	`reviewedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `card_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dateKey` varchar(10) NOT NULL,
	`taskKey` varchar(48) NOT NULL,
	`skill` enum('vocabulary','grammar','listening','speaking','writing') NOT NULL,
	`title` varchar(180) NOT NULL,
	`instructions` text NOT NULL,
	`minutes` int NOT NULL,
	`status` enum('pending','completed') NOT NULL DEFAULT 'pending',
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_tasks_user_date_task_unique` UNIQUE(`userId`,`dateKey`,`taskKey`)
);
--> statement-breakpoint
CREATE TABLE `diagnostic_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`skill` enum('vocabulary','grammar','listening','speaking','writing') NOT NULL,
	`evidenceType` varchar(40) NOT NULL,
	`prompt` text NOT NULL,
	`response` text NOT NULL,
	`score` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `diagnostic_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `learner_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dailyMinutes` int NOT NULL DEFAULT 50,
	`engineeringSpecialty` varchar(80) NOT NULL DEFAULT 'general',
	`startingBand` varchar(16) NOT NULL DEFAULT 'A2/B1',
	`vocabularyWeight` int NOT NULL DEFAULT 25,
	`grammarWeight` int NOT NULL DEFAULT 20,
	`listeningWeight` int NOT NULL DEFAULT 15,
	`speakingWeight` int NOT NULL DEFAULT 25,
	`writingWeight` int NOT NULL DEFAULT 15,
	`calibrationConfidence` int NOT NULL DEFAULT 15,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `learner_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `learner_profiles_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `skill_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dateKey` varchar(10) NOT NULL,
	`vocabularyScore` int NOT NULL,
	`grammarScore` int NOT NULL,
	`listeningScore` int NOT NULL,
	`speakingScore` int NOT NULL,
	`writingScore` int NOT NULL,
	`aggregateScore` int NOT NULL,
	`practicalBand` varchar(32) NOT NULL,
	`evidenceCount` int NOT NULL DEFAULT 0,
	`summary` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `skill_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vocabulary_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`term` varchar(160) NOT NULL,
	`arabicMeaning` text NOT NULL,
	`partOfSpeech` varchar(48) NOT NULL,
	`ipa` varchar(120) NOT NULL,
	`engineeringDomain` varchar(80) NOT NULL,
	`examples` json NOT NULL,
	`reviewStrength` int NOT NULL DEFAULT 0,
	`reviewCount` int NOT NULL DEFAULT 0,
	`nextReviewAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vocabulary_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `card_reviews` ADD CONSTRAINT `card_reviews_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `card_reviews` ADD CONSTRAINT `card_reviews_cardId_vocabulary_cards_id_fk` FOREIGN KEY (`cardId`) REFERENCES `vocabulary_cards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `daily_tasks` ADD CONSTRAINT `daily_tasks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `diagnostic_attempts` ADD CONSTRAINT `diagnostic_attempts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `learner_profiles` ADD CONSTRAINT `learner_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `skill_snapshots` ADD CONSTRAINT `skill_snapshots_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vocabulary_cards` ADD CONSTRAINT `vocabulary_cards_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `card_reviews_user_card_idx` ON `card_reviews` (`userId`,`cardId`);--> statement-breakpoint
CREATE INDEX `daily_tasks_user_date_idx` ON `daily_tasks` (`userId`,`dateKey`);--> statement-breakpoint
CREATE INDEX `diagnostic_attempts_user_skill_idx` ON `diagnostic_attempts` (`userId`,`skill`);--> statement-breakpoint
CREATE INDEX `skill_snapshots_user_date_idx` ON `skill_snapshots` (`userId`,`dateKey`);--> statement-breakpoint
CREATE INDEX `vocabulary_cards_user_due_idx` ON `vocabulary_cards` (`userId`,`nextReviewAt`);