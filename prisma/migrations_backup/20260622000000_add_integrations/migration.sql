CREATE TABLE `Integration` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `provider` ENUM('TWILIO', 'RESEND', 'RETELL', 'R2', 'SMTP2GO') NOT NULL,
  `settings` JSON NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `Integration_userId_provider_key` (`userId`, `provider`),
  INDEX `Integration_provider_idx` (`provider`),
  INDEX `Integration_isActive_idx` (`isActive`),
  INDEX `Integration_userId_idx` (`userId`),
  PRIMARY KEY (`id`)
);

ALTER TABLE `Integration`
  ADD CONSTRAINT `Integration_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `Users`(`id`)
  ON DELETE CASCADE
  ON UPDATE CASCADE;
