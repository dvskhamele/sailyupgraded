import "server-only";
import { Resend } from "resend";
import { getResendIntegration } from "./integrations/resend";

export default async function resendHelper(teamId?: string) {
  const integration = await getResendIntegration(teamId);

  if (!integration) {
    console.warn("Resend integration not configured");
    return null;
  }

  return new Resend(integration.apiKey);
}

export async function getResendEmailFrom(teamId?: string) {
  const integration = await getResendIntegration(teamId);
  if (!integration) return null;
  return integration.emailFrom;
}
