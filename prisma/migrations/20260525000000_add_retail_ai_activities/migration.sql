CREATE TABLE IF NOT EXISTS `crm_RetailAIActivities` (
  `id` VARCHAR(191) NOT NULL,
  `type` ENUM('call', 'meeting', 'note', 'email') NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `date` DATETIME(3) NOT NULL,
  `duration` INTEGER NULL,
  `outcome` TEXT NULL,
  `status` ENUM('scheduled', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  `metadata` JSON NULL,
  `aiSource` VARCHAR(191) NULL,
  `aiInsights` TEXT NULL,
  `aiConfidenceScore` DECIMAL(5, 2) NULL,
  `aiMetadata` JSON NULL,
  `retailAIPayload` JSON NULL,
  `aiStatus` VARCHAR(191) NULL,
  `aiGeneratedSummary` TEXT NULL,
  `transcript` JSON NULL,
  `recordingUrl` TEXT NULL,
  `publicLogUrl` TEXT NULL,
  `conversationId` VARCHAR(191) NULL,
  `webhookReceivedAt` DATETIME(3) NULL,
  `sentiment` VARCHAR(191) NULL,
  `callSuccessful` BOOLEAN NULL,
  `createdBy` VARCHAR(191) NULL,
  `updatedBy` VARCHAR(191) NULL,
  `assignedTo` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NULL,
  `deletedAt` DATETIME(3) NULL,
  `deletedBy` VARCHAR(191) NULL,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `crm_RetailAIActivityLinks` (
  `id` VARCHAR(191) NOT NULL,
  `activityId` VARCHAR(191) NOT NULL,
  `entityType` VARCHAR(191) NOT NULL,
  `entityId` VARCHAR(191) NOT NULL,
  PRIMARY KEY (`id`)
);

CREATE INDEX IF NOT EXISTS `crm_RetailAIActivities_date_idx` ON `crm_RetailAIActivities`(`date`);
CREATE INDEX IF NOT EXISTS `crm_RetailAIActivities_type_idx` ON `crm_RetailAIActivities`(`type`);
CREATE INDEX IF NOT EXISTS `crm_RetailAIActivities_status_idx` ON `crm_RetailAIActivities`(`status`);
CREATE INDEX IF NOT EXISTS `crm_RetailAIActivities_aiStatus_idx` ON `crm_RetailAIActivities`(`aiStatus`);
CREATE INDEX IF NOT EXISTS `crm_RetailAIActivities_conversationId_idx` ON `crm_RetailAIActivities`(`conversationId`);
CREATE INDEX IF NOT EXISTS `crm_RetailAIActivities_assignedTo_idx` ON `crm_RetailAIActivities`(`assignedTo`);
CREATE INDEX IF NOT EXISTS `crm_RetailAIActivities_createdBy_idx` ON `crm_RetailAIActivities`(`createdBy`);
CREATE INDEX IF NOT EXISTS `crm_RetailAIActivities_createdAt_idx` ON `crm_RetailAIActivities`(`createdAt`);
CREATE INDEX IF NOT EXISTS `crm_RetailAIActivities_deletedAt_idx` ON `crm_RetailAIActivities`(`deletedAt`);
CREATE INDEX IF NOT EXISTS `crm_RetailAIActivities_deletedAt_date_id_idx` ON `crm_RetailAIActivities`(`deletedAt`, `date`, `id`);
CREATE INDEX IF NOT EXISTS `crm_RetailAIActivities_updatedBy_fkey` ON `crm_RetailAIActivities`(`updatedBy`);
CREATE INDEX IF NOT EXISTS `crm_RetailAIActivityLinks_activityId_idx` ON `crm_RetailAIActivityLinks`(`activityId`);
CREATE INDEX IF NOT EXISTS `crm_RetailAIActivityLinks_entityId_idx` ON `crm_RetailAIActivityLinks`(`entityId`);
CREATE INDEX IF NOT EXISTS `crm_RetailAIActivityLinks_entityType_entityId_idx` ON `crm_RetailAIActivityLinks`(`entityType`, `entityId`);
CREATE INDEX IF NOT EXISTS `crm_RetailAIActivityLinks_entityType_entityId_activityId_idx` ON `crm_RetailAIActivityLinks`(`entityType`, `entityId`, `activityId`);

ALTER TABLE `crm_RetailAIActivities`
  ADD CONSTRAINT `crm_RetailAIActivities_createdBy_fkey`
  FOREIGN KEY (`createdBy`) REFERENCES `Users`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE `crm_RetailAIActivities`
  ADD CONSTRAINT `crm_RetailAIActivities_updatedBy_fkey`
  FOREIGN KEY (`updatedBy`) REFERENCES `Users`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE `crm_RetailAIActivities`
  ADD CONSTRAINT `crm_RetailAIActivities_assignedTo_fkey`
  FOREIGN KEY (`assignedTo`) REFERENCES `Users`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE `crm_RetailAIActivityLinks`
  ADD CONSTRAINT `crm_RetailAIActivityLinks_activityId_fkey`
  FOREIGN KEY (`activityId`) REFERENCES `crm_RetailAIActivities`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;
