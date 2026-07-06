import { inngest } from "@/inngest/client";
import { prismadb } from "@/lib/prisma";
import { runWithOrganizationContext } from "@/lib/organization-context";
import type { EnrichmentField } from "@/lib/enrichment/types";

export const enrichTargetsBulk = inngest.createFunction(
  {
    id: "enrich-targets-bulk",
    name: "Enrich Targets Bulk",
    triggers: [{ event: "enrich/targets.bulk" }],
  },
  async ({ event, step }) => {
    const { targetIds, fields, triggeredBy } = event.data as {
      targetIds: string[];
      fields: EnrichmentField[];
      triggeredBy?: string;
    };

    if (targetIds.length === 0) {
      return { dispatched: 0 };
    }

    // Fetch a target to get organizationId
    const target = await step.run("fetch-target", async () => {
      return prismadb.crm_Targets.findUnique({
        where: { id: targetIds[0] },
        select: { organizationId: true },
      });
    });

    if (!target || !target.organizationId) {
      return { dispatched: 0, skipped: "no organization found" };
    }

    const organizationId = target.organizationId;

    const records = await step.run("create-enrichment-records", async () => {
      return runWithOrganizationContext(organizationId, async () => {
        const created = await Promise.all(
          targetIds.map((targetId) =>
            prismadb.crm_Target_Enrichment.create({
              data: {
                organizationId,
                targetId,
                status: "PENDING",
                fields: fields.map((f) => f.name),
                triggeredBy: triggeredBy ?? null,
              },
              select: { id: true, targetId: true },
            })
          )
        );
        return created;
      });
    });

    await step.sendEvent(
      "fan-out-target-enrichments",
      records.map((r: { id: string; targetId: string }) => ({
        name: "enrich/target.run",
        data: { targetId: r.targetId, enrichmentId: r.id, fields, triggeredBy },
      }))
    );

    return { dispatched: records.length };
  }
);
