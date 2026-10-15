CREATE TABLE `customerImportRows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`importId` int NOT NULL,
	`rowNumber` int NOT NULL,
	`fullName` varchar(160) NOT NULL DEFAULT '',
	`email` varchar(320),
	`phone` varchar(40) NOT NULL DEFAULT '',
	`industry` varchar(120) NOT NULL DEFAULT 'Unspecified',
	`segment` enum('VIP','Frequent Buyer','Inactive','New') NOT NULL DEFAULT 'New',
	`rowStatus` enum('Imported','Skipped') NOT NULL,
	`skipReason` varchar(200),
	CONSTRAINT `customerImportRows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customerImports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`fileName` varchar(180) NOT NULL,
	`sourceUrl` text NOT NULL,
	`totalRows` int NOT NULL DEFAULT 0,
	`importedRows` int NOT NULL DEFAULT 0,
	`skippedRows` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerImports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`fullName` varchar(160) NOT NULL,
	`email` varchar(320),
	`phone` varchar(40),
	`jobTitle` varchar(120),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_profiles_owner_idx` UNIQUE(`ownerId`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `industry` varchar(120) DEFAULT 'Unspecified' NOT NULL;--> statement-breakpoint
ALTER TABLE `customerImportRows` ADD CONSTRAINT `customerImportRows_importId_customerImports_id_fk` FOREIGN KEY (`importId`) REFERENCES `customerImports`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customerImports` ADD CONSTRAINT `customerImports_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userProfiles` ADD CONSTRAINT `userProfiles_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customer_import_rows_import_idx` ON `customerImportRows` (`importId`,`rowNumber`);--> statement-breakpoint
CREATE INDEX `customer_imports_owner_created_idx` ON `customerImports` (`ownerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `customers_owner_industry_idx` ON `customers` (`ownerId`,`industry`);