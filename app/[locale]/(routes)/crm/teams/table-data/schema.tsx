import { z } from "zod";

export const TeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
  deletedAt: z.coerce.date().nullable().optional(),
  deletedBy: z.string().nullable().optional(),
  _count: z.object({
    members: z.number().optional(),
  }).optional(),
});

export type Team = z.infer<typeof TeamSchema>;
