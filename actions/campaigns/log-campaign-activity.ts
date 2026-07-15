"use server";

import { prismadb } from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";

export interface BulkEmailActivityInput {
  campaignId: string;
  userId?: string;
}

export interface BulkEmailActivityResult {
  activityId: string;
  successfulRecipients: number;
  failedRecipients: number;
  totalRecipients: number;
}

/**
 * Generates a readable summary description for the bulk email activity.
 * If more than 100 recipients, only first 100 are listed with a truncation note.
 * The complete list is stored in metadata.
 */
function generateDescription(
  campaignName: string,
  subject: string,
  totalRecipients: number,
  successfullySent: number,
  failed: number,
  recipients: Array<{ name?: string | null; email: string }>,
  failedRecipients: Array<{ email: string; reason?: string | null }>,
  extras?: {
    templateName?: string | null;
    filterDescription?: string | null;
    attachmentFilenames?: string[];
  }
): string {
  const lines: string[] = [];
  lines.push("Bulk Email Summary");
  lines.push("");
  lines.push(`Subject:`);
  lines.push(subject);
  lines.push("");
  lines.push(`Total Recipients:`);
  lines.push(String(totalRecipients));
  lines.push("");
  lines.push(`Successfully Sent:`);
  lines.push(String(successfullySent));
  lines.push("");
  lines.push(`Failed:`);
  lines.push(String(failed));
  lines.push("");

  if (extras?.filterDescription) {
    lines.push(`Filter:`);
    lines.push(extras.filterDescription);
    lines.push("");
  }

  if (extras?.templateName) {
    lines.push(`Template:`);
    lines.push(extras.templateName);
    lines.push("");
  }

  if (extras?.attachmentFilenames && extras.attachmentFilenames.length > 0) {
    lines.push(`Attachments:`);
    for (const filename of extras.attachmentFilenames) {
      lines.push(filename);
    }
    lines.push("");
  }

  // Recipients - max 100 in description
  const MAX_DISPLAY = 100;
  const displayRecipients = recipients.slice(0, MAX_DISPLAY);

  lines.push("Recipients:");
  lines.push("");
  for (const r of displayRecipients) {
    const name = r.name ? `${r.name} ` : "";
    lines.push(`• ${name}(${r.email})`);
  }

  if (recipients.length > MAX_DISPLAY) {
    const remaining = recipients.length - MAX_DISPLAY;
    lines.push("");
    lines.push(`...and ${remaining} more recipients.`);
  }

  // Failed recipients
  if (failedRecipients.length > 0) {
    lines.push("");
    lines.push("Failed Recipients:");
    lines.push("");
    for (const fr of failedRecipients) {
      lines.push(`• ${fr.email}`);
      if (fr.reason) {
        lines.push(`  Reason: ${fr.reason}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Creates a single Activity record for a completed bulk email campaign.
 * Creates the activity if any sends exist (regardless of current status).
 * Wraps activity creation in try/catch so failure never breaks the email sending process.
 *
 * Returns the created activity ID and send statistics, or null if no activity was created.
 */
export async function createBulkEmailActivity(
  input: BulkEmailActivityInput
): Promise<BulkEmailActivityResult | null> {
  const { campaignId } = input;

  console.log("[BULK EMAIL] Starting activity creation for campaign:", campaignId);

  // Step 1: Resolve userId
  let userId = input.userId;
  if (!userId) {
    try {
      const session = await getSession();
      if (session?.user?.id) {
        userId = session.user.id;
        console.log("[BULK EMAIL] Resolved userId from session:", userId);
      }
    } catch (sessionError) {
      console.warn("[BULK EMAIL] Failed to get session:", sessionError);
    }
  }

  try {
    // Fetch campaign with template info
    const campaign = await prismadb.crm_campaigns.findUnique({
      where: { id: campaignId },
      include: {
        template: { select: { name: true } },
      },
    });

    if (!campaign) {
      console.warn("[BULK EMAIL] Campaign not found:", campaignId);
      return null;
    }

    // Fall back to campaign creator if no userId from session
    if (!userId) {
      if (campaign.created_by) {
        userId = campaign.created_by;
        console.log("[BULK EMAIL] Resolved userId from campaign creator:", userId);
      } else {
        console.warn("[BULK EMAIL] No userId available (no session, no campaign creator)");
        return null;
      }
    }

    // Step 2: Verify user exists before setting foreign keys
    const userExists = await prismadb.users.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      console.error("[BULK EMAIL] User not found in database. userId:", userId);
      return null;
    }

    // Step 3: Fetch all sends for this campaign (regardless of status)
    console.log("[BULK EMAIL] Fetching sends for campaign:", campaignId);
    const sends = await prismadb.crm_campaign_sends.findMany({
      where: { campaign_id: campaignId },
      include: {
        target: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    if (sends.length === 0) {
      console.warn("[BULK EMAIL] No sends found for campaign:", campaignId);
      return null;
    }

    // Count by status (sends may still be "queued" if the log-activity event fires
    // before send-step functions complete - this is expected)
    const queued = sends.filter((s) => s.status === "queued").length;
    const sent = sends.filter((s) => s.status === "sent").length;
    const failed = sends.filter((s) => s.status === "failed").length;

    console.log("[BULK EMAIL] Send status breakdown:", { total: sends.length, queued, sent, failed });

    // Always create the activity if sends exist. The campaign was executed.
    // The send-step functions will update statuses asynchronously.
    // Even if all sends are still "queued", we record the activity now.

    // Build recipient list (deduplicate by email)
    const seenEmails = new Set<string>();
    const recipients: Array<{ id?: string; name?: string | null; email: string }> = [];
    const failedRecipients: Array<{ email: string; reason?: string | null }> = [];

    for (const s of sends) {
      const email = s.email || s.target?.email;
      if (!email) continue;

      // Count in-progress sends as future successes
      if ((s.status === "sent" || s.status === "queued") && !seenEmails.has(email)) {
        seenEmails.add(email);
        const name = s.target
          ? [s.target.first_name, s.target.last_name].filter(Boolean).join(" ")
          : null;
        recipients.push({ id: s.target?.id, name: name || null, email });
      }

      if (s.status === "failed") {
        failedRecipients.push({ email, reason: s.error_message });
      }
    }

    // Get subject from campaign steps
    const step0 = await prismadb.crm_campaign_steps.findFirst({
      where: { campaign_id: campaignId, order: 0 },
      select: { subject: true },
    });

    const subject = step0?.subject || campaign.name || "Bulk Email";

    // Build total counts for display
    const totalRecipients = sends.length;
    const successfulRecipients = sent + queued; // queued sends will be sent shortly
    const failedCount = failed;

    // Generate description
    const description = generateDescription(
      campaign.name || "Bulk Email",
      subject,
      totalRecipients,
      successfulRecipients,
      failedCount,
      recipients,
      failedRecipients,
      {
        templateName: campaign.template?.name || null,
      }
    );

    // Build metadata - REMOVE any undefined values to prevent JSON serialization issues
    const metadata = {
      source: "bulk-email",
      subject: subject ?? null,
      template: campaign.template?.name ?? null,
      totalRecipients,
      successfulRecipients,
      failedRecipients: failedCount,
      campaignId,
      campaignName: campaign.name ?? null,
      recipients: recipients.map((r) => ({
        id: r.id ?? null,
        name: r.name ?? null,
        email: r.email,
      })),
      failed: failedRecipients.map((fr) => ({
        email: fr.email,
        reason: fr.reason ?? null,
      })),
      queuedCount: queued,
      sentCount: sent,
      failedCount: failed,
    };

    console.log("[BULK EMAIL] Activity payload:", JSON.stringify({
      type: "email",
      title: "Bulk Email Sent",
      date: new Date().toISOString(),
      duration: 0,
      outcome: `Successfully sent ${successfulRecipients} emails.`,
      status: "completed",
      createdBy: userId,
      assignedTo: userId,
      metadataKeys: Object.keys(metadata),
    }, null, 2));

    // Step 4: Create the activity with validated field values
    // Validated against actual Prisma schema enums:
    //   crm_Activity_Type: call | meeting | note | email
    //   crm_Activity_Status: scheduled | completed | cancelled
    const activity = await prismadb.crm_Activities.create({
      data: {
        type: "email",
        title: "Bulk Email Sent",
        description: description,
        date: new Date(),
        duration: 0,
        outcome: `Successfully sent ${successfulRecipients} emails.`,
        status: "completed",
        createdBy: userId,
        assignedTo: userId,
        metadata: metadata,
      },
    });

    console.log("[BULK EMAIL] Activity created successfully with id:", activity.id);

    return {
      activityId: activity.id,
      successfulRecipients: successfulRecipients,
      failedRecipients: failedCount,
      totalRecipients: totalRecipients,
    };
  } catch (error) {
    // Failure while creating the Activity must NEVER fail the email sending process
    console.error("[BULK EMAIL] Activity creation failed:", error);
    if (error instanceof Error) {
      console.error("[BULK EMAIL] Error name:", error.name);
      console.error("[BULK EMAIL] Error message:", error.message);
      console.error("[BULK EMAIL] Error stack:", error.stack);
    }
    return null;
  }
}

/**
 * Legacy alias for backward compatibility.
 * Calls createBulkEmailActivity internally.
 */
export async function logCampaignActivity(
  input: BulkEmailActivityInput
): Promise<{ activityId: string } | null> {
  const result = await createBulkEmailActivity(input);
  if (!result) return null;
  return { activityId: result.activityId };
}