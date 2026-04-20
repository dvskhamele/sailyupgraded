import { inngest } from "@/inngest/client";
export const embedAccount = inngest.createFunction(
  { id: "embed-account", name: "Embed Account", triggers: [{ event: "crm/account.saved" }] },
  async ({ event }) => {
    const { record_id } = event.data as { record_id: string };
    return { skipped: `semantic embeddings disabled for TiDB (${record_id})` };
  }
);
