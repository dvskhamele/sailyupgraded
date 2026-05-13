import Container from "../components/ui/Container";
import { getActivities } from "@/actions/crm/activities/get-activities-by-entity";
import { ActivitiesView } from "@/components/crm/activities/ActivitiesView";

export default async function ActivitiesPage() {
  const activities = await getActivities();

  return (
    <Container
      title="Activities"
      description="View CRM activities across contacts, accounts, leads, opportunities, and contracts"
    >
      <div className="pt-4">
        <ActivitiesView initialData={activities} />
      </div>
    </Container>
  );
}
