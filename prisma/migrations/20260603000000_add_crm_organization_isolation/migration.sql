SET @legacy_org_id = 'legacy-crm-data';

INSERT INTO organizations (id, name, slug, createdAt, updatedAt)
VALUES (@legacy_org_id, 'Legacy CRM Data', 'legacy-crm-data', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE updatedAt = updatedAt; 

INSERT IGNORE INTO organization_members (id, organizationId, userId, role, createdAt)
SELECT UUID(), @legacy_org_id, id, CASE WHEN role = 'admin' THEN 'admin' ELSE 'member' END, CURRENT_TIMESTAMP(3)
FROM Users; 

ALTER TABLE `crm_Accounts` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_Accounts` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_Accounts` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_Accounts_organizationId_idx` ON `crm_Accounts`(`organizationId`);
ALTER TABLE `crm_Accounts` ADD CONSTRAINT `crm_Accounts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_Leads` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_Leads` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_Leads` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_Leads_organizationId_idx` ON `crm_Leads`(`organizationId`);
ALTER TABLE `crm_Leads` ADD CONSTRAINT `crm_Leads_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_Contact_Enrichment` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_Contact_Enrichment` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_Contact_Enrichment` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_Contact_Enrichment_organizationId_idx` ON `crm_Contact_Enrichment`(`organizationId`);
ALTER TABLE `crm_Contact_Enrichment` ADD CONSTRAINT `crm_Contact_Enrichment_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_Target_Enrichment` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_Target_Enrichment` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_Target_Enrichment` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_Target_Enrichment_organizationId_idx` ON `crm_Target_Enrichment`(`organizationId`);
ALTER TABLE `crm_Target_Enrichment` ADD CONSTRAINT `crm_Target_Enrichment_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_Target_Contact` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_Target_Contact` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_Target_Contact` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_Target_Contact_organizationId_idx` ON `crm_Target_Contact`(`organizationId`);
ALTER TABLE `crm_Target_Contact` ADD CONSTRAINT `crm_Target_Contact_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_Opportunities` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_Opportunities` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_Opportunities` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_Opportunities_organizationId_idx` ON `crm_Opportunities`(`organizationId`);
ALTER TABLE `crm_Opportunities` ADD CONSTRAINT `crm_Opportunities_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_LeadCallTracking` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_LeadCallTracking` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_LeadCallTracking` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_LeadCallTracking_organizationId_idx` ON `crm_LeadCallTracking`(`organizationId`);
ALTER TABLE `crm_LeadCallTracking` ADD CONSTRAINT `crm_LeadCallTracking_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_LeadCallWebhookEvent` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_LeadCallWebhookEvent` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_LeadCallWebhookEvent` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_LeadCallWebhookEvent_organizationId_idx` ON `crm_LeadCallWebhookEvent`(`organizationId`);
ALTER TABLE `crm_LeadCallWebhookEvent` ADD CONSTRAINT `crm_LeadCallWebhookEvent_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_campaigns` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_campaigns` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_campaigns` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_campaigns_organizationId_idx` ON `crm_campaigns`(`organizationId`);
ALTER TABLE `crm_campaigns` ADD CONSTRAINT `crm_campaigns_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_campaign_templates` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_campaign_templates` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_campaign_templates` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_campaign_templates_organizationId_idx` ON `crm_campaign_templates`(`organizationId`);
ALTER TABLE `crm_campaign_templates` ADD CONSTRAINT `crm_campaign_templates_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_campaign_steps` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_campaign_steps` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_campaign_steps` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_campaign_steps_organizationId_idx` ON `crm_campaign_steps`(`organizationId`);
ALTER TABLE `crm_campaign_steps` ADD CONSTRAINT `crm_campaign_steps_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_campaign_sends` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_campaign_sends` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_campaign_sends` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_campaign_sends_organizationId_idx` ON `crm_campaign_sends`(`organizationId`);
ALTER TABLE `crm_campaign_sends` ADD CONSTRAINT `crm_campaign_sends_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_Contacts` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_Contacts` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_Contacts` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_Contacts_organizationId_idx` ON `crm_Contacts`(`organizationId`);
ALTER TABLE `crm_Contacts` ADD CONSTRAINT `crm_Contacts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_Contracts` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_Contracts` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_Contracts` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_Contracts_organizationId_idx` ON `crm_Contracts`(`organizationId`);
ALTER TABLE `crm_Contracts` ADD CONSTRAINT `crm_Contracts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_SystemSettings` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_SystemSettings` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_SystemSettings` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_SystemSettings_organizationId_idx` ON `crm_SystemSettings`(`organizationId`);
ALTER TABLE `crm_SystemSettings` ADD CONSTRAINT `crm_SystemSettings_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_Activities` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_Activities` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_Activities` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_Activities_organizationId_idx` ON `crm_Activities`(`organizationId`);
ALTER TABLE `crm_Activities` ADD CONSTRAINT `crm_Activities_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_ActivityLinks` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_ActivityLinks` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_ActivityLinks` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_ActivityLinks_organizationId_idx` ON `crm_ActivityLinks`(`organizationId`);
ALTER TABLE `crm_ActivityLinks` ADD CONSTRAINT `crm_ActivityLinks_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_RetailAIActivities` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_RetailAIActivities` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_RetailAIActivities` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_RetailAIActivities_organizationId_idx` ON `crm_RetailAIActivities`(`organizationId`);
ALTER TABLE `crm_RetailAIActivities` ADD CONSTRAINT `crm_RetailAIActivities_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_RetailAIActivityLinks` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_RetailAIActivityLinks` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_RetailAIActivityLinks` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_RetailAIActivityLinks_organizationId_idx` ON `crm_RetailAIActivityLinks`(`organizationId`);
ALTER TABLE `crm_RetailAIActivityLinks` ADD CONSTRAINT `crm_RetailAIActivityLinks_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Boards` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `Boards` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `Boards` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `Boards_organizationId_idx` ON `Boards`(`organizationId`);
ALTER TABLE `Boards` ADD CONSTRAINT `Boards_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Documents` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `Documents` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `Documents` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `Documents_organizationId_idx` ON `Documents`(`organizationId`);
ALTER TABLE `Documents` ADD CONSTRAINT `Documents_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Documents_Types` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `Documents_Types` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `Documents_Types` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `Documents_Types_organizationId_idx` ON `Documents_Types`(`organizationId`);
ALTER TABLE `Documents_Types` ADD CONSTRAINT `Documents_Types_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Sections` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `Sections` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `Sections` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `Sections_organizationId_idx` ON `Sections`(`organizationId`);
ALTER TABLE `Sections` ADD CONSTRAINT `Sections_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Tasks` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `Tasks` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `Tasks` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `Tasks_organizationId_idx` ON `Tasks`(`organizationId`);
ALTER TABLE `Tasks` ADD CONSTRAINT `Tasks_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_Accounts_Tasks` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_Accounts_Tasks` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_Accounts_Tasks` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_Accounts_Tasks_organizationId_idx` ON `crm_Accounts_Tasks`(`organizationId`);
ALTER TABLE `crm_Accounts_Tasks` ADD CONSTRAINT `crm_Accounts_Tasks_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `tasksComments` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `tasksComments` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `tasksComments` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `tasksComments_organizationId_idx` ON `tasksComments`(`organizationId`);
ALTER TABLE `tasksComments` ADD CONSTRAINT `tasksComments_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_AuditLog` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_AuditLog` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_AuditLog` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_AuditLog_organizationId_idx` ON `crm_AuditLog`(`organizationId`);
ALTER TABLE `crm_AuditLog` ADD CONSTRAINT `crm_AuditLog_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_Report_Config` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_Report_Config` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_Report_Config` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_Report_Config_organizationId_idx` ON `crm_Report_Config`(`organizationId`);
ALTER TABLE `crm_Report_Config` ADD CONSTRAINT `crm_Report_Config_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_Report_Schedule` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_Report_Schedule` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_Report_Schedule` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_Report_Schedule_organizationId_idx` ON `crm_Report_Schedule`(`organizationId`);
ALTER TABLE `crm_Report_Schedule` ADD CONSTRAINT `crm_Report_Schedule_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DocumentsToOpportunities` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `DocumentsToOpportunities` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `DocumentsToOpportunities` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `DocumentsToOpportunities_organizationId_idx` ON `DocumentsToOpportunities`(`organizationId`);
ALTER TABLE `DocumentsToOpportunities` ADD CONSTRAINT `DocumentsToOpportunities_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DocumentsToContacts` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `DocumentsToContacts` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `DocumentsToContacts` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `DocumentsToContacts_organizationId_idx` ON `DocumentsToContacts`(`organizationId`);
ALTER TABLE `DocumentsToContacts` ADD CONSTRAINT `DocumentsToContacts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DocumentsToTasks` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `DocumentsToTasks` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `DocumentsToTasks` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `DocumentsToTasks_organizationId_idx` ON `DocumentsToTasks`(`organizationId`);
ALTER TABLE `DocumentsToTasks` ADD CONSTRAINT `DocumentsToTasks_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DocumentsToCrmAccountsTasks` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `DocumentsToCrmAccountsTasks` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `DocumentsToCrmAccountsTasks` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `DocumentsToCrmAccountsTasks_organizationId_idx` ON `DocumentsToCrmAccountsTasks`(`organizationId`);
ALTER TABLE `DocumentsToCrmAccountsTasks` ADD CONSTRAINT `DocumentsToCrmAccountsTasks_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DocumentsToLeads` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `DocumentsToLeads` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `DocumentsToLeads` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `DocumentsToLeads_organizationId_idx` ON `DocumentsToLeads`(`organizationId`);
ALTER TABLE `DocumentsToLeads` ADD CONSTRAINT `DocumentsToLeads_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `DocumentsToAccounts` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `DocumentsToAccounts` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `DocumentsToAccounts` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `DocumentsToAccounts_organizationId_idx` ON `DocumentsToAccounts`(`organizationId`);
ALTER TABLE `DocumentsToAccounts` ADD CONSTRAINT `DocumentsToAccounts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ContactsToOpportunities` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `ContactsToOpportunities` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `ContactsToOpportunities` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `ContactsToOpportunities_organizationId_idx` ON `ContactsToOpportunities`(`organizationId`);
ALTER TABLE `ContactsToOpportunities` ADD CONSTRAINT `ContactsToOpportunities_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_Targets` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_Targets` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_Targets` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_Targets_organizationId_idx` ON `crm_Targets`(`organizationId`);
ALTER TABLE `crm_Targets` ADD CONSTRAINT `crm_Targets_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_TargetLists` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_TargetLists` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_TargetLists` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_TargetLists_organizationId_idx` ON `crm_TargetLists`(`organizationId`);
ALTER TABLE `crm_TargetLists` ADD CONSTRAINT `crm_TargetLists_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `TargetsToTargetLists` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `TargetsToTargetLists` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `TargetsToTargetLists` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `TargetsToTargetLists_organizationId_idx` ON `TargetsToTargetLists`(`organizationId`);
ALTER TABLE `TargetsToTargetLists` ADD CONSTRAINT `TargetsToTargetLists_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EmailAccount` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `EmailAccount` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `EmailAccount` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `EmailAccount_organizationId_idx` ON `EmailAccount`(`organizationId`);
ALTER TABLE `EmailAccount` ADD CONSTRAINT `EmailAccount_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Email` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `Email` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `Email` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `Email_organizationId_idx` ON `Email`(`organizationId`);
ALTER TABLE `Email` ADD CONSTRAINT `Email_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EmailsToContacts` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `EmailsToContacts` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `EmailsToContacts` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `EmailsToContacts_organizationId_idx` ON `EmailsToContacts`(`organizationId`);
ALTER TABLE `EmailsToContacts` ADD CONSTRAINT `EmailsToContacts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `EmailsToAccounts` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `EmailsToAccounts` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `EmailsToAccounts` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `EmailsToAccounts_organizationId_idx` ON `EmailsToAccounts`(`organizationId`);
ALTER TABLE `EmailsToAccounts` ADD CONSTRAINT `EmailsToAccounts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_ProductCategories` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_ProductCategories` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_ProductCategories` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_ProductCategories_organizationId_idx` ON `crm_ProductCategories`(`organizationId`);
ALTER TABLE `crm_ProductCategories` ADD CONSTRAINT `crm_ProductCategories_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_Products` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_Products` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_Products` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_Products_organizationId_idx` ON `crm_Products`(`organizationId`);
ALTER TABLE `crm_Products` ADD CONSTRAINT `crm_Products_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_AccountProducts` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_AccountProducts` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_AccountProducts` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_AccountProducts_organizationId_idx` ON `crm_AccountProducts`(`organizationId`);
ALTER TABLE `crm_AccountProducts` ADD CONSTRAINT `crm_AccountProducts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_OpportunityLineItems` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_OpportunityLineItems` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_OpportunityLineItems` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_OpportunityLineItems_organizationId_idx` ON `crm_OpportunityLineItems`(`organizationId`);
ALTER TABLE `crm_OpportunityLineItems` ADD CONSTRAINT `crm_OpportunityLineItems_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_ContractLineItems` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_ContractLineItems` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_ContractLineItems` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_ContractLineItems_organizationId_idx` ON `crm_ContractLineItems`(`organizationId`);
ALTER TABLE `crm_ContractLineItems` ADD CONSTRAINT `crm_ContractLineItems_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Invoices` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `Invoices` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `Invoices` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `Invoices_organizationId_idx` ON `Invoices`(`organizationId`);
ALTER TABLE `Invoices` ADD CONSTRAINT `Invoices_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Invoice_LineItems` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `Invoice_LineItems` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `Invoice_LineItems` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `Invoice_LineItems_organizationId_idx` ON `Invoice_LineItems`(`organizationId`);
ALTER TABLE `Invoice_LineItems` ADD CONSTRAINT `Invoice_LineItems_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Invoice_Payments` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `Invoice_Payments` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `Invoice_Payments` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `Invoice_Payments_organizationId_idx` ON `Invoice_Payments`(`organizationId`);
ALTER TABLE `Invoice_Payments` ADD CONSTRAINT `Invoice_Payments_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Invoice_Attachments` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `Invoice_Attachments` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `Invoice_Attachments` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `Invoice_Attachments_organizationId_idx` ON `Invoice_Attachments`(`organizationId`);
ALTER TABLE `Invoice_Attachments` ADD CONSTRAINT `Invoice_Attachments_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Invoice_Activity` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `Invoice_Activity` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `Invoice_Activity` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `Invoice_Activity_organizationId_idx` ON `Invoice_Activity`(`organizationId`);
ALTER TABLE `Invoice_Activity` ADD CONSTRAINT `Invoice_Activity_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Invoice_TaxRates` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `Invoice_TaxRates` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `Invoice_TaxRates` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `Invoice_TaxRates_organizationId_idx` ON `Invoice_TaxRates`(`organizationId`);
ALTER TABLE `Invoice_TaxRates` ADD CONSTRAINT `Invoice_TaxRates_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Invoice_Series` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `Invoice_Series` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `Invoice_Series` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `Invoice_Series_organizationId_idx` ON `Invoice_Series`(`organizationId`);
ALTER TABLE `Invoice_Series` ADD CONSTRAINT `Invoice_Series_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Invoice_Settings` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `Invoice_Settings` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `Invoice_Settings` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `Invoice_Settings_organizationId_idx` ON `Invoice_Settings`(`organizationId`);
ALTER TABLE `Invoice_Settings` ADD CONSTRAINT `Invoice_Settings_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `crm_SMSLog` ADD COLUMN `organizationId` VARCHAR(191) NULL;
UPDATE `crm_SMSLog` SET `organizationId` = @legacy_org_id WHERE `organizationId` IS NULL;
ALTER TABLE `crm_SMSLog` MODIFY `organizationId` VARCHAR(191) NOT NULL;
CREATE INDEX `crm_SMSLog_organizationId_idx` ON `crm_SMSLog`(`organizationId`);
ALTER TABLE `crm_SMSLog` ADD CONSTRAINT `crm_SMSLog_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


