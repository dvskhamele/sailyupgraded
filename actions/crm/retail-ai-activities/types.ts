import type {
  ActivityCursor,
  ActivityFilters,
  ActivityWithLinks,
} from "@/actions/crm/activities/get-activities-by-entity";

export type RetailAIActivityAIFields = {
  aiSource: string | null;
  aiInsights: string | null;
  aiConfidenceScore: number | string | null;
  aiMetadata: unknown;
  retailAIPayload: unknown;
  aiStatus: string | null;
  aiGeneratedSummary: string | null;
  transcript?: unknown;
  recordingUrl?: string | null;
  publicLogUrl?: string | null;
  conversationId?: string | null;
  webhookReceivedAt?: Date | string | null;
  sentiment?: string | null;
  callSuccessful?: boolean | null;

  // New Fields
  call_id?: string | null;
  customer_name?: string | null;
  phone_number?: string | null;
  email?: string | null;
  appointment_time?: Date | string | null;
  call_summary?: string | null;
  call_successful?: string | null;
  user_sentiment?: string | null;
  combined_cost?: number | string | null;
  call_duration?: number | null;

  // Additional Extraction Fields
  state?: string | null;
  location?: string | null;
  timezone?: string | null;
  insurance_interest?: string | null;
  smoker_status?: string | null;
  call_outcome?: string | null;
  consultation_type?: string | null;
};

export type RetailAIActivityWithLinks = ActivityWithLinks & RetailAIActivityAIFields;

export type RetailAIActivityCursor = ActivityCursor;
export type RetailAIActivityFilters = ActivityFilters;

export type RetailAIActivityInput = {
  type: "call" | "meeting" | "note" | "email";
  title?: string;
  description?: string;
  date?: Date;
  duration?: number;
  outcome?: string;
  status: "scheduled" | "completed" | "cancelled";
  metadata?: Record<string, unknown>;
  assignedTo?: string | null;
  links: Array<{ entityType: string; entityId: string }>;
  aiSource?: string | null;
  aiInsights?: string | null;
  aiConfidenceScore?: number | null;
  aiMetadata?: unknown;
  retailAIPayload?: unknown;
  aiStatus?: string | null;
  aiGeneratedSummary?: string | null;
  transcript?: unknown;
  recordingUrl?: string | null;
  publicLogUrl?: string | null;
  conversationId?: string | null;
  webhookReceivedAt?: Date | null;
  sentiment?: string | null;
  callSuccessful?: boolean | null;

  // New Fields
  call_id?: string | null;
  customer_name?: string | null;
  phone_number?: string | null;
  email?: string | null;
  appointment_time?: Date | null;
  call_summary?: string | null;
  call_successful?: string | null;
  user_sentiment?: string | null;
  combined_cost?: number | null;
  call_duration?: number | null;

  // Additional Extraction Fields
  state?: string | null;
  location?: string | null;
  timezone?: string | null;
  insurance_interest?: string | null;
  smoker_status?: string | null;
  call_outcome?: string | null;
  consultation_type?: string | null;
};

export type RetailAIActivityUpdateInput = Partial<RetailAIActivityInput> & {
  id: string;
};
