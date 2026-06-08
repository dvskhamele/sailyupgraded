import { z } from "zod";

const decimalLikeSchema = z.custom<{ toString(): string }>(
  (value) =>
    value !== null &&
    value !== undefined &&
    typeof value === "object" &&
    "toString" in value &&
    typeof value.toString === "function",
);

const currencyAmountSchema = z.union([
  z.number(),
  z.bigint(),
  z.string(),
  decimalLikeSchema,
]);

// We're keeping a simple non-relational schema here.
// IRL, you will have a schema for your data models.
export const opportunitySchema = z.object({
  //TODO: fix all the types and nullable
  id: z.string(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  next_step: z.string().nullable(),
  close_date: z.union([z.date(), z.string(), z.null()]).nullable().transform((val) => {
    if (!val) return null;
    return val instanceof Date ? val : new Date(val);
  }),
  status: z.string().nullable(),
  budget: currencyAmountSchema.nullable(),
  expected_revenue: currencyAmountSchema.nullable(),
  currency: z.string().nullable().optional(),
  assigned_to: z.string().nullable().optional(),
  assigned_account: z.object({
    name: z.string().nullable().optional(),
  }).optional().nullable(),
  assigned_sales_stage: z.object({
    name: z.string().nullable().optional(),
  }).optional().nullable(),
  assigned_to_user: z.object({
    name: z.string().nullable().optional(),
  }).optional().nullable(),
});

export type Opportunity = z.infer<typeof opportunitySchema>;
