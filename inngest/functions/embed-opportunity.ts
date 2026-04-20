import { inngest } from "@/inngest/client";
export const embedOpportunity = inngest.createFunction(
  { id: "embed-opportunity", name: "Embed Opportunity", triggers: [{ event: "crm/opportunity.saved" }] },
  async ({ event }) => {
    const { record_id } = event.data as { record_id: string };
    return { skipped: `semantic embeddings disabled for TiDB (${record_id})` };
  }
);
