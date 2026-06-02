CREATE TABLE `organizations` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `organizations_slug_key`(`slug`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `organization_members` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `role` ENUM('admin', 'member', 'viewer') NOT NULL DEFAULT 'member',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `organization_members_organizationId_userId_key`(`organizationId`, `userId`),
  INDEX `organization_members_organizationId_idx`(`organizationId`),
  INDEX `organization_members_userId_idx`(`userId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `organization_members`
  ADD CONSTRAINT `organization_members_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `organization_members`
  ADD CONSTRAINT `organization_members_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `Users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

