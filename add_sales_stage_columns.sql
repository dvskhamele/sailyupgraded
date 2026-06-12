-- Add countInRevenue and countInPipeline columns to crm_Opportunities_Sales_Stages
ALTER TABLE `crm_Opportunities_Sales_Stages` 
ADD COLUMN IF NOT EXISTS `countInRevenue` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `crm_Opportunities_Sales_Stages` 
ADD COLUMN IF NOT EXISTS `countInPipeline` BOOLEAN NOT NULL DEFAULT true;

-- Also make sure position column is there (from recent migration)
ALTER TABLE `crm_Opportunities_Sales_Stages` 
ADD COLUMN IF NOT EXISTS `position` INTEGER NOT NULL DEFAULT 0;
