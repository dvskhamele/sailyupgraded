import { z } from "zod";
import { getDatabaseUrlDiagnostics, prismadb } from "@/lib/prisma";
import { resolveSourcePlatformToLeadSourceId } from "@/lib/crm/lead-source-resolver";
import {
  paginationSchema,
  paginationArgs,
  listResponse,
  itemResponse,
  ilike,
  notFound,
  softDeleteData,
} from "../helpers";

export const crmLeadTools = [
  {
    name: "crm_list_leads",
    description: "List CRM leads assigned to the authenticated user",
    schema: z.object({ ...paginationSchema }),
    async handler(args: { limit: number; offset: number }, userId: string) {
      const where = { assigned_to: userId, deletedAt: null };
      const [data, total] = await Promise.all([
        prismadb.crm_Leads.findMany({
          where,
          ...paginationArgs(args),
          orderBy: { createdAt: "desc" },
        }),
        prismadb.crm_Leads.count({ where }),
      ]);
      return listResponse(data, total, args.offset);
    },
  },
  {
    name: "crm_get_lead",
    description: "Get a single CRM lead by ID",
    schema: z.object({ id: z.string().uuid() }),
    async handler(args: { id: string }, userId: string) {
      const lead = await prismadb.crm_Leads.findFirst({
        where: { id: args.id, assigned_to: userId, deletedAt: null },
      });
      if (!lead) notFound("Lead");
      return itemResponse(lead);
    },
  },
  {
    name: "crm_search_leads",
    description: "Search leads by name, company, or email (substring match)",
    schema: z.object({ query: z.string().min(1), ...paginationSchema }),
    async handler(
      args: { query: string; limit: number; offset: number },
      userId: string
    ) {
      const where = {
        assigned_to: userId,
        deletedAt: null,
        OR: [
          ilike("firstName", args.query),
          ilike("lastName", args.query),
          ilike("email", args.query),
          ilike("company", args.query),
        ],
      };
      const [data, total] = await Promise.all([
        prismadb.crm_Leads.findMany({
          where,
          ...paginationArgs(args),
          orderBy: { createdAt: "desc" },
        }),
        prismadb.crm_Leads.count({ where }),
      ]);
      return listResponse(data, total, args.offset);
    },
  },
  {
    name: "crm_create_lead",
    description: "Create a new CRM lead",
    schema: z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1),
      email: z.string().email().optional(),
      company: z.string().optional(),
      phone: z.string().optional(),
      jobTitle: z.string().optional(),
      sourcePlatform: z.string().optional(),
    }),
    async handler(
      args: {
        firstName?: string;
        lastName: string;
        email?: string;
        company?: string;
        phone?: string;
        jobTitle?: string;
        sourcePlatform?: string;
      },
      userId: string
    ) {
      const { lastName, firstName, sourcePlatform, ...rest } = args;

      // ── Auto-resolve lead_source_id from source_platform ──────────────
      const resolvedLeadSourceId = sourcePlatform
        ? await resolveSourcePlatformToLeadSourceId(sourcePlatform)
        : null;
      // ──────────────────────────────────────────────────────────────────

      const createPayload = {
        v: 0,
        lastName,
        firstName: firstName || "",
        ...rest,
        assigned_to: userId,
        createdBy: userId,
        ...(resolvedLeadSourceId ? { lead_source_id: resolvedLeadSourceId } : {}),
      };

      console.log("[LEAD CREATE DEBUG] Entry point", {
        path: "lib/mcp/tools/crm-leads.ts:crm_create_lead",
        database: getDatabaseUrlDiagnostics(),
      });
      console.log("[LEAD CREATE DEBUG] Incoming lead payload", args);
      console.log("[LEAD CREATE DEBUG] Prisma create payload", createPayload);
      console.log("[LEAD CREATE DEBUG] Executing prismadb.crm_Leads.create()");
      const lead = await prismadb.crm_Leads.create({
        data: createPayload,
      });
      console.log("[LEAD CREATE DEBUG] Create result", lead);
      console.log("[LEAD CREATE DEBUG] Created lead ID", { id: lead.id });

      const verificationLead = await prismadb.crm_Leads.findUnique({
        where: { id: lead.id },
      });
      console.log("[LEAD CREATE DEBUG] Verification query result", verificationLead);
      console.log("[LEAD CREATE DEBUG] Completed without transaction rollback", {
        id: lead.id,
        note: "crm_create_lead does not wrap crm_Leads.create() in a transaction",
      });
      return itemResponse(lead);
    },
  },
  {
    name: "crm_update_lead",
    description: "Update an existing CRM lead by ID",
    schema: z.object({
      id: z.string().uuid(),
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email().optional(),
      company: z.string().optional(),
      phone: z.string().optional(),
      jobTitle: z.string().optional(),
    }),
    async handler(
      args: {
        id: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        company?: string;
        phone?: string;
        jobTitle?: string;
      },
      userId: string
    ) {
      const existing = await prismadb.crm_Leads.findFirst({
        where: { id: args.id, assigned_to: userId, deletedAt: null },
      });
      if (!existing) notFound("Lead");
      const { id, ...updateData } = args;
      const lead = await prismadb.crm_Leads.update({
        where: { id },
        data: {
          ...updateData,
          updatedBy: userId,
          firstName: updateData.firstName || undefined,
        },
      });
      return itemResponse(lead);
    },
  },
  {
    name: "crm_delete_lead",
    description: "Soft-delete a CRM lead by ID (sets deletedAt timestamp)",
    schema: z.object({ id: z.string().uuid() }),
    async handler(args: { id: string }, userId: string) {
      const existing = await prismadb.crm_Leads.findFirst({
        where: { id: args.id, assigned_to: userId, deletedAt: null },
      });
      if (!existing) notFound("Lead");
      const lead = await prismadb.crm_Leads.update({
        where: { id: args.id },
        data: softDeleteData(userId),
      });
      return itemResponse({ id: lead.id, deletedAt: lead.deletedAt });
    },
  },
];
