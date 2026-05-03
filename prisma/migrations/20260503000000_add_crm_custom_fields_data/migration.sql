ALTER TABLE `crm_Contacts`
  ADD COLUMN `custom_fields_data` JSON NULL;

ALTER TABLE `crm_Leads`
  ADD COLUMN `custom_fields_data` JSON NULL;

ALTER TABLE `crm_Opportunities`
  ADD COLUMN `custom_fields_data` JSON NULL;
