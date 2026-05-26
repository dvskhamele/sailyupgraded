import Container from "../components/ui/Container";
import { RetailAIActivities } from "@/components/crm/retail-ai-activities/RetailAIActivities";

export default async function RetailAIActivitiesPage() {
  return (
    <Container
      title="Retail AI Activities"
      description="View Retail AI activities across contacts, accounts, leads, opportunities, and contracts"
    >
      <div className="pt-4">
        <RetailAIActivities />
      </div>
    </Container>
  );
}
