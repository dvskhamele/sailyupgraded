import type { ParsedRetailAICall, RetailAIPayload } from "./parser";

export type RetailAIActivityStatus = "scheduled" | "completed" | "cancelled";
export type RetailAIActivityType = "call" | "meeting" | "note" | "email";
export type RetailAIReviewStatus = "accepted" | "reviewed";

export type RetailAIActivityCreateInput = {
  type: RetailAIActivityType;
  title: string;
  description: string;
  date: Date;
  duration: number | null;
  outcome: string;
  status: RetailAIActivityStatus;
  metadata: Record<string, unknown>;
  aiSource: "Retell AI";
  aiInsights: string;
  aiConfidenceScore: number;
  aiMetadata: Record<string, unknown>;
  retailAIPayload: RetailAIPayload;
  aiStatus: RetailAIReviewStatus;
  aiGeneratedSummary: string;
  transcript: unknown;
  recordingUrl?: string | null;
  publicLogUrl?: string | null;
  conversationId: string;
  webhookReceivedAt: Date;
  sentiment?: string | null;
  callSuccessful: boolean;
  
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

  assignedTo?: string | null;
  links: Array<{ entityType: string; entityId: string }>;
};

export type RetailAIWebhookResult =
  | {
      status: "created";
      activityId: string;
      contactId?: string;
      parsed: ParsedRetailAICall;
    }
  | {
      status: "skipped";
      reason: string;
      activityId?: string;
      parsed?: ParsedRetailAICall;
    };
