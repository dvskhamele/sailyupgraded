ALTER TABLE `crm_Activities`
  ADD COLUMN IF NOT EXISTS `assignedTo` VARCHAR(191) NULL;

CREATE INDEX IF NOT EXISTS `crm_Activities_assignedTo_idx` ON `crm_Activities`(`assignedTo`);

ALTER TABLE `crm_Activities`
  ADD CONSTRAINT `crm_Activities_assignedTo_fkey`
  FOREIGN KEY (`assignedTo`) REFERENCES `Users`(`id`)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
