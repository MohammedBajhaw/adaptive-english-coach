CREATE TABLE `learner_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`kind` varchar(48) NOT NULL,
	`sourceDateKey` varchar(10) NOT NULL,
	`title` varchar(180) NOT NULL,
	`content` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `learner_notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `learner_notifications_user_kind_date_unique` UNIQUE(`userId`,`kind`,`sourceDateKey`)
);
--> statement-breakpoint
ALTER TABLE `learner_notifications` ADD CONSTRAINT `learner_notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `learner_notifications_user_created_idx` ON `learner_notifications` (`userId`,`createdAt`);