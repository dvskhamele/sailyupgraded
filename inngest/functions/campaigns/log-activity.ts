import { inngest } from "@/inngest/client";
import { createBulkEmailActivity } from "@/actions/campaigns/log-campaign-activity";

/**
 * Logs a single Activity record for a completed bulk email campaign.
 * This function is triggered after all sends have been dispatched.
 * It queries the current state of sends and creates ONE activity
 * summarizing the entire campaign.
 *
 * Activity is only created if at least one email was sent successfully.
 * Returns the created activity ID and send statistics.
 */
export const campaignLogActivity = inngest.createFunction(
  {
    id: "campaign-log-activity",
    name: "Campaign: Log Activity",
    triggers: [{ event: "campaigns/log-activity" }],
  },
  async ({ event, step }) => {
    const { campaignId, userId } = event.data as {
      campaignId: string;
      userId?: string;
    };

    const activity = await step.run("log-campaign-activity", async () => {
      return createBulkEmailActivity({ campaignId, userId });
    });

    return {
      logged: !!activity,
      activityId: activity?.activityId ?? null,
      successfulRecipients: activity?.successfulRecipients ?? 0,
      failedRecipients: activity?.failedRecipients ?? 0,
      totalRecipients: activity?.totalRecipients ?? 0,
    };
  }
);
