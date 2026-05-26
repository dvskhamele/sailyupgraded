-- Delete duplicate Retail AI activities, keeping only the most recent one for each call_id
DELETE FROM crm_RetailAIActivityLinks 
WHERE activityId IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY call_id ORDER BY createdAt DESC) as row_num
        FROM crm_RetailAIActivities
        WHERE call_id IS NOT NULL
    ) as ranked
    WHERE row_num > 1
);

DELETE FROM crm_RetailAIActivities 
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY call_id ORDER BY createdAt DESC) as row_num
        FROM crm_RetailAIActivities
        WHERE call_id IS NOT NULL
    ) as ranked
    WHERE row_num > 1
);
