import { inngest } from "@/inngest/client";
export const embedContact = inngest.createFunction(
  { id: "embed-contact", name: "Embed Contact", triggers: [{ event: "crm/contact.saved" }] },
  async ({ event }) => {
    const { record_id } = event.data as { record_id: string };
    return { skipped: `semantic embeddings disabled for TiDB (${record_id})` };
  }
);
