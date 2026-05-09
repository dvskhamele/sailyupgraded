import { z } from "zod";

// We're keeping a simple non-relational schema here.
// IRL, you will have a schema for your data models.
const dateLikeSchema = z.union([z.date(), z.string()]);

export const leadSchema = z.object({
  //TODO: fix all the types and nullable
  id: z.string(),
  createdAt: dateLikeSchema.optional().nullable(),
  updatedAt: dateLikeSchema.optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().min(1).max(100).optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  contact_type_id: z.string().optional().nullable(),
  contact_type: z.object({ name: z.string().optional().nullable() }).optional().nullable(),
  status: z.union([z.string(), z.boolean()]).optional().nullable(),
  lead_status: z.object({ name: z.string().optional().nullable() }).optional().nullable(),
  lead_source: z.object({ name: z.string().optional().nullable() }).optional().nullable(),
});

export type Lead = z.infer<typeof leadSchema>;
