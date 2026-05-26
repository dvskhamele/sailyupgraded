import { inngest } from "../../client";
import { createRetailAIActivityFromWebhook } from "@/lib/retail-ai/service";

export const retailAIWebhookHandler = inngest.createFunction(
  {
    id: "retail-ai-webhook-handler",
    name: "Retail AI Webhook Handler",
    triggers: [{ event: "retail-ai/webhook.received" }],
  },
  async ({ event, step }) => {
    const data = event.data as { payload: unknown; receivedAt?: string };
    return step.run("create-retail-ai-activity", async () =>
      createRetailAIActivityFromWebhook(data.payload, {
        receivedAt: data.receivedAt
          ? new Date(data.receivedAt)
          : new Date(),
      }),
    );
  },
);
