ALTER TABLE `vocabulary_cards` ADD `contentId` varchar(140);--> statement-breakpoint
CREATE INDEX `vocabulary_cards_user_content_idx` ON `vocabulary_cards` (`userId`,`contentId`);