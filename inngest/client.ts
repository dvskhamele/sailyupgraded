import { Inngest } from "inngest";

const inngestId = process.env.INNGEST_ID || "nextcrm-local";
const inngestName = process.env.INNGEST_APP_NAME || "NextCRM Local";
const isInngestConfigured = Boolean(
  process.env.INNGEST_ID && process.env.INNGEST_APP_NAME
);

const client = new Inngest({
  id: inngestId,
  name: inngestName,
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
});

const originalSend = client.send.bind(client);

client.send = (async (...args: Parameters<typeof client.send>) => {
  if (!isInngestConfigured) {
    console.warn(
      "[Inngest] Skipping send because INNGEST_ID/INNGEST_APP_NAME are not configured."
    );
    return [];
  }

  return originalSend(...args);
}) as typeof client.send;

export const inngest = client;
export const inngestConfigured = isInngestConfigured;
