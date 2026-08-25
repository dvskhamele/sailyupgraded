ALTER TABLE `crm_Opportunities_Sales_Stages`
  ADD COLUMN `position` INTEGER NOT NULL DEFAULT 0;

UPDATE `crm_Opportunities_Sales_Stages`
SET `position` = COALESCE(`order`, 0);

UPDATE `crm_Opportunities_Sales_Stages` AS stage
JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (ORDER BY COALESCE(`order`, 0), `name`, `id`) - 1 AS `next_position`
  FROM `crm_Opportunities_Sales_Stages`
  WHERE COALESCE(`order`, 0) <> -1
) AS ranked ON ranked.`id` = stage.`id`
SET stage.`position` = ranked.`next_position`;

UPDATE `crm_Opportunities_Sales_Stages`
SET `position` = -1
WHERE `order` = -1;
