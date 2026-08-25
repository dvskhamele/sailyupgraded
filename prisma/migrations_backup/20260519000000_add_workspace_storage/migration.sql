CREATE TABLE `WorkspaceStorage` (
  `id` VARCHAR(191) NOT NULL DEFAULT 'default',
  `storageUsed` BIGINT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
);

INSERT INTO `WorkspaceStorage` (`id`, `storageUsed`, `updatedAt`)
VALUES ('default', 0, CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;
