import { getActivitiesByEntity } from "@/actions/crm/activities/get-activities-by-entity";
import { ActivitiesView } from "@/components/crm/activities/ActivitiesView";
import type {
  ActivityCursor,
  ActivityWithLinks,
} from "@/actions/crm/activities/get-activities-by-entity";

interface Props {
  contactId: string;
  initialData?: { data: ActivityWithLinks[]; nextCursor: ActivityCursor | null };
}

export async function ActivitiesSection({ contactId, initialData }: Props) {
  const data = initialData ?? await getActivitiesByEntity("contact", contactId);
  return (
    <ActivitiesView entityType="contact" entityId={contactId} initialData={data} />
  );
}
