CREATE TABLE `businessSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`businessName` varchar(160) NOT NULL,
	`businessType` varchar(120) NOT NULL,
	`phone` varchar(40),
	`whatsappNumber` varchar(40),
	`email` varchar(320),
	`logoUrl` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `businessSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `business_settings_owner_idx` UNIQUE(`ownerId`)
);
--> statement-breakpoint
CREATE TABLE `campaignMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`sentCount` int NOT NULL DEFAULT 0,
	`deliveredCount` int NOT NULL DEFAULT 0,
	`readCount` int NOT NULL DEFAULT 0,
	`replyCount` int NOT NULL DEFAULT 0,
	`leadCount` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaignMetrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `campaign_metrics_campaign_idx` UNIQUE(`campaignId`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`offerId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`audienceSegment` enum('VIP','Frequent Buyer','Inactive','New') NOT NULL,
	`status` enum('Draft','Scheduled','Active','Complete') NOT NULL DEFAULT 'Draft',
	`scheduledAt` timestamp,
	`launchedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`fullName` varchar(160) NOT NULL,
	`email` varchar(320),
	`phone` varchar(40) NOT NULL,
	`segment` enum('VIP','Frequent Buyer','Inactive','New') NOT NULL DEFAULT 'New',
	`orderCount` int NOT NULL DEFAULT 0,
	`lifetimeSpendCents` int NOT NULL DEFAULT 0,
	`lastActiveAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`campaignId` int,
	`fullName` varchar(160) NOT NULL,
	`phone` varchar(40) NOT NULL,
	`source` varchar(180) NOT NULL,
	`status` enum('New','Contacted','Converted','Lost') NOT NULL DEFAULT 'New',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`type` varchar(80) NOT NULL,
	`imageUrl` text,
	`cta` varchar(120) NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`status` enum('Draft','Active','Expired') NOT NULL DEFAULT 'Draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `businessSettings` ADD CONSTRAINT `businessSettings_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaignMetrics` ADD CONSTRAINT `campaignMetrics_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_offerId_offers_id_fk` FOREIGN KEY (`offerId`) REFERENCES `offers`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_campaignId_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `offers` ADD CONSTRAINT `offers_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `campaigns_owner_status_idx` ON `campaigns` (`ownerId`,`status`);--> statement-breakpoint
CREATE INDEX `campaigns_offer_idx` ON `campaigns` (`offerId`);--> statement-breakpoint
CREATE INDEX `customers_owner_segment_idx` ON `customers` (`ownerId`,`segment`);--> statement-breakpoint
CREATE INDEX `leads_owner_status_idx` ON `leads` (`ownerId`,`status`);--> statement-breakpoint
CREATE INDEX `leads_campaign_idx` ON `leads` (`campaignId`);--> statement-breakpoint
CREATE INDEX `offers_owner_status_idx` ON `offers` (`ownerId`,`status`);