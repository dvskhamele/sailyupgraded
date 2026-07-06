import { inngest } from "@/inngest/client";
import { prismadb } from "@/lib/prisma";
import { runWithOrganizationContext } from "@/lib/organization-context";
import type { EnrichmentField } from "@/lib/enrichment/types";

export const enrichContactsBulk = inngest.createFunction(
  {
    id: "enrich-contacts-bulk",
    name: "Enrich Contacts Bulk",
    triggers: [{ event: "enrich/contacts.bulk" }],
  },
  async ({ event, step }) => {
    const { contactIds, fields, triggeredBy } = event.data as {
      contactIds: string[];
      fields: EnrichmentField[];
      triggeredBy?: string;
    };

    if (contactIds.length === 0) {
      return { dispatched: 0 };
    }

    // Fetch a contact to get organizationId
    const contact = await step.run("fetch-contact", async () => {
      return prismadb.crm_Contacts.findUnique({
        where: { id: contactIds[0] },
        select: { organizationId: true },
      });
    });

    if (!contact || !contact.organizationId) {
      return { dispatched: 0, skipped: "no organization found" };
    }

    const organizationId = contact.organizationId;

    // Create one enrichment record per contact
    const records = await step.run("create-enrichment-records", async () => {
      return runWithOrganizationContext(organizationId, async () => {
        const created = await Promise.all(
          contactIds.map((contactId) =>
            prismadb.crm_Contact_Enrichment.create({
              data: {
                organizationId,
                contactId,
                status: "PENDING",
                fields: fields.map((f) => f.name),
                triggeredBy: triggeredBy ?? null,
              },
              select: { id: true, contactId: true },
            })
          )
        );
        return created;
      });
    });

    // Fan out: one event per contact
    await step.sendEvent(
      "fan-out-enrichments",
      records.map((r: { id: string; contactId: string }) => ({
        name: "enrich/contact.run",
        data: { contactId: r.contactId, enrichmentId: r.id, fields, triggeredBy },
      }))
    );

    return { dispatched: records.length };
  }
);
