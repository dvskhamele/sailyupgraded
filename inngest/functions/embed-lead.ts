import { inngest } from "@/inngest/client";
export const embedLead = inngest.createFunction(
  { id: "embed-lead", name: "Embed Lead", triggers: [{ event: "crm/lead.saved" }] },
  async ({ event }) => {
    const { record_id } = event.data as { record_id: string };
    return { skipped: `semantic embeddings disabled for TiDB (${record_id})` };
  }
);
