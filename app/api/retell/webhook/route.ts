import { NextResponse } from "next/server";

import { prismadb } from "@/lib/prisma";

type RetellWebhookPayload = {
  event?: string;
  call?: RetellWebhookCall;
};

type RetellWebhookCall = {
  call_id?: string;
  agent_id?: string;
  agent_version?: number;
  call_status?: string;
  to_number?: string;
  metadata?: Record<string, unknown>;
  start_timestamp?: number;
  end_timestamp?: number;
  duration_ms?: number;
  disconnection_reason?: string;
  transcript?: string;
  transcript_object?: unknown;
  recording_url?: string;
  call_analysis?: {
    call_summary?: string;
    summary?: string;
    custom_analysis_data?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

const handledEvents = new Set([
  "call_started",
  "call_ended",
  "call_analyzed",
  "voicemail_reached",
  "dial_no_answer",
  "user_hangup",
  "agent_hangup",
]);

function dateFromRetellTimestamp(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value)
    : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function statusForEvent(event: string, call: RetellWebhookCall) {
  const reason = stringValue(call.disconnection_reason);

  if (event === "call_started") {
    return "active";
  }

  if (event === "call_analyzed") {
    return "ended";
  }

  if (event === "voicemail_reached" || reason === "voicemail_reached") {
    return "voicemail";
  }

  if (event === "dial_no_answer" || reason === "dial_no_answer") {
    return "failed";
  }

  if (event === "user_hangup" || event === "agent_hangup") {
    return "ended";
  }

  return call.call_status ?? "ended";
}

function durationSeconds(call: RetellWebhookCall) {
  if (typeof call.duration_ms === "number") {
    return Math.round(call.duration_ms / 1000);
  }

  if (
    typeof call.start_timestamp === "number" &&
    typeof call.end_timestamp === "number"
  ) {
    return Math.max(
      0,
      Math.round((call.end_timestamp - call.start_timestamp) / 1000),
    );
  }

  return undefined;
}

function getSummary(call: RetellWebhookCall) {
  return (
    stringValue(call.call_analysis?.call_summary) ??
    stringValue(call.call_analysis?.summary)
  );
}

function getCustomAnalysisValue(
  customData: Record<string, unknown> | undefined,
  keys: string[],
) {
  for (const key of keys) {
    const value = stringValue(customData?.[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

export async function POST(request: Request) {
  let payload: RetellWebhookPayload;

  try {
    payload = JSON.parse(await request.text()) as RetellWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const event = stringValue(payload.event);
  const call = payload.call;
  const callId = stringValue(call?.call_id);

  if (!event || !call || !callId) {
    return NextResponse.json(
      { error: "Retell webhook event and call.call_id are required" },
      { status: 400 },
    );
  }

  if (!handledEvents.has(event)) {
    await prismadb.crm_LeadCallWebhookEvent.create({
      data: {
        callId,
        event,
        payload: payload as any,
      },
    });

    return new NextResponse(null, { status: 204 });
  }

  const metadata = call.metadata ?? {};
  const customAnalysisData = call.call_analysis?.custom_analysis_data;
  const opportunityId = stringValue(metadata.opportunity_id);
  const memberId = stringValue(metadata.member_id);
  const email = stringValue(metadata.member_email);
  const startedAt = dateFromRetellTimestamp(call.start_timestamp);
  const endedAt = dateFromRetellTimestamp(call.end_timestamp);
  const transcript =
    stringValue(call.transcript) ??
    (call.transcript_object ? JSON.stringify(call.transcript_object) : undefined);
  const appointmentStatus =
    getCustomAnalysisValue(customAnalysisData, [
      "appointment_status",
      "appointmentStatus",
      "appointment",
    ]) ?? "none";
  const qualificationStatus =
    getCustomAnalysisValue(customAnalysisData, [
      "qualification_status",
      "qualificationStatus",
      "qualified",
      "lead_status",
    ]) ?? "unknown";

  try {
    await prismadb.$transaction([
      prismadb.crm_LeadCallWebhookEvent.create({
        data: {
          callId,
          event,
          payload: payload as any,
        },
      }),
      prismadb.crm_LeadCallTracking.upsert({
        where: { callId },
        create: {
          callId,
          opportunityId: opportunityId ?? "unknown",
          memberId,
          phone: call.to_number ?? "",
          email,
          agentId: call.agent_id,
          agentVersion: call.agent_version,
          callStatus: statusForEvent(event, call),
          callDisposition: call.disconnection_reason,
          transcript,
          summary: getSummary(call),
          appointmentStatus,
          qualificationStatus,
          duration: durationSeconds(call),
          recordingUrl: call.recording_url,
          startedAt,
          endedAt,
          metadata: metadata as any,
          analysis: call.call_analysis as any,
          lastWebhookEvent: event,
        },
        update: {
          memberId,
          phone: call.to_number,
          email,
          agentId: call.agent_id,
          agentVersion: call.agent_version,
          callStatus: statusForEvent(event, call),
          callDisposition: call.disconnection_reason,
          transcript,
          summary: getSummary(call),
          appointmentStatus,
          qualificationStatus,
          duration: durationSeconds(call),
          recordingUrl: call.recording_url,
          startedAt,
          endedAt,
          metadata: metadata as any,
          analysis: call.call_analysis as any,
          lastWebhookEvent: event,
        },
      }),
    ]);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[RETELL_WEBHOOK_POST]", error);
    return NextResponse.json(
      { error: "Failed to persist Retell webhook" },
      { status: 500 },
    );
  }
}
