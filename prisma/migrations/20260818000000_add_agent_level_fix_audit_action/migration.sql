-- AlterEnum: add 'imported' to crm_AuditLog.action
-- The Prisma schema already defines this value but no migration ever applied it
-- to the database, causing "Data truncated for column 'action'" on every audit
-- log write with action = 'imported'.
ALTER TABLE `crm_AuditLog`
  MODIFY COLUMN `action`
    ENUM('created','updated','deleted','restored','relation_added','relation_removed','imported')
    NOT NULL;

-- Add agent_level column so that the Excel "Agent Level" header can be
-- persisted instead of being silently discarded.
ALTER TABLE `crm_Contacts`
  ADD COLUMN `agent_level` VARCHAR(191) NULL;
