"use server";

import { getTwilioClient, getTwilioPhoneNumber } from "@/lib/twilio";
import { prismadb } from "@/lib/prisma";

export async function sendSMS({
  to,
  message,
  opportunityId,
  contactId,
}: {
  to: string;
  message: string;
  opportunityId?: string;
  contactId?: string;
}) {
  const twilioClient = await getTwilioClient();
  const twilioPhoneNumber = await getTwilioPhoneNumber();

  if (!twilioClient || !twilioPhoneNumber) {
    return { error: "Twilio integration not configured" };
  }

  try {
    // 1. Create a log entry in the database
    const logEntry = await prismadb.crm_SMSLog.create({
      data: {
        from: twilioPhoneNumber,
        to,
        message,
        opportunityId,
        contactId,
        status: "pending",
      },
    });

    // 2. Send the SMS via Twilio
    const callbackUrl = process.env.NEXT_PUBLIC_APP_URL;
    const isLocal = callbackUrl?.includes("localhost") || !callbackUrl;

    const twilioResponse = await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to,
      ...(isLocal ? {} : { statusCallback: `${callbackUrl}/api/webhooks/twilio` }),
    });

    // 3. Update the log entry with Twilio SID and status
    await prismadb.crm_SMSLog.update({
      where: { id: logEntry.id },
      data: {
        twilioSid: twilioResponse.sid,
        status: twilioResponse.status,
      },
    });

    return { success: true, sid: twilioResponse.sid };
  } catch (error: any) {
    console.error("Error sending SMS:", error);
    return { error: error.message || "Failed to send SMS" };
  }
}
