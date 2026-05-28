import { getRetailAIActivities } from "@/actions/crm/retail-ai-activities/get-retail-ai-activities";
import { ActivitiesView } from "@/components/crm/activities/ActivitiesView";

export async function RetailAIActivities() {
  const activities = await getRetailAIActivities();

  return (
    <ActivitiesView
      initialData={activities}
      activityModule="retail-ai"
      title="AI Activities"
      description="Track AI activity workflows, reviews, and outcomes."
      createLabel="Log AI Activity"
    />
    
  );
}
