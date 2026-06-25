import "server-only";
import twilio from "twilio";
import { getTwilioIntegration } from "./integrations/twilio";

export async function getTwilioClient(teamId?: string) {
  const integration = await getTwilioIntegration(teamId);

  if (!integration) {
    console.warn("Twilio integration not configured");
    return null;
  }

  return twilio(integration.accountSid, integration.authToken);
}

export async function getTwilioPhoneNumber(teamId?: string) {
  const integration = await getTwilioIntegration(teamId);

  if (!integration) {
    return null;
  }

  return integration.phoneNumber;
}
