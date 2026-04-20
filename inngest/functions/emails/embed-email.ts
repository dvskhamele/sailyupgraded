import { inngest } from "@/inngest/client";
export const embedEmail = inngest.createFunction(
  {
    id: "email-embed-email",
    name: "Email: Embed Email",
    concurrency: { limit: 10 },
    triggers: [{ event: "email/embed-email" }],
  },
  async ({ event }: { event: { data: { emailId: string } } }) => {
    const { emailId } = event.data;
    return { skipped: `semantic embeddings disabled for TiDB (${emailId})` };
  }
);
