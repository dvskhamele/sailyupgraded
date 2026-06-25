import { NextResponse } from "next/server";

import {
  getConfiguredAgentId,
  getConfiguredRetellPhoneNumber,
  getRetellApiKey,
  getRetellRuntimeDiagnostics,
  getRetellWebhookConfig,
  listRetellAgents,
  listRetellPhoneNumbers,
  fingerprintSecret,
} from "@/lib/retell-server";

function maskPhone(value: string | null | undefined) {
  return fingerprintSecret(value ?? undefined);
}

export async function GET() {
  const { webhookUrl } = await getRetellWebhookConfig();
  const apiKey = await getRetellApiKey();
  const configuredAgentId = getConfiguredAgentId();
  const configuredPhone = await getConfiguredRetellPhoneNumber();
  let retellWorkspaceProbe:
    | {
        ok: true;
        agents: Array<{
          agentId: string;
          version: number | undefined;
          name: string | null;
          isPublished: boolean;
          webhookUrl: string | null;
        }>;
        selectedAgentId: string | null;
        phoneNumbers: Array<{
          phoneNumber: string;
          matchesConfiguredPhone: boolean;
          inboundAgentId: string | null;
          outboundAgentId: string | null;
        }>;
        configuredPhoneFound: boolean;
        configuredPhoneAttachedToSelectedAgent: boolean;
      }
    | {
        ok: false;
        error: string;
      }
    | null = null;

  if (apiKey) {
    try {
      const [agents, phoneNumbers] = await Promise.all([
        listRetellAgents(apiKey),
        listRetellPhoneNumbers(apiKey),
      ]);
      const selectedAgentId =
        configuredAgentId ||
        agents.find((agent) => agent.is_published && agent.agent_id)?.agent_id ||
        agents.find((agent) => agent.agent_id)?.agent_id ||
        null;
      const maskedPhoneNumbers = phoneNumbers.map((phoneNumber) => {
        const phoneValue = phoneNumber.phone_number ?? phoneNumber.number ?? "";

        return {
          phoneNumber: maskPhone(phoneValue),
          matchesConfiguredPhone: Boolean(
            configuredPhone && phoneValue === configuredPhone,
          ),
          inboundAgentId: phoneNumber.inbound_agent_id ?? null,
          outboundAgentId: phoneNumber.outbound_agent_id ?? null,
        };
      });
      const configuredPhoneRecord = maskedPhoneNumbers.find(
        (phoneNumber) => phoneNumber.matchesConfiguredPhone,
      );

      retellWorkspaceProbe = {
        ok: true,
        agents: agents
          .filter((agent) => agent.agent_id)
          .map((agent) => ({
            agentId: agent.agent_id as string,
            version: agent.version,
            name: agent.agent_name ?? null,
            isPublished: Boolean(agent.is_published),
            webhookUrl: agent.webhook_url ?? null,
          })),
        selectedAgentId,
        phoneNumbers: maskedPhoneNumbers,
        configuredPhoneFound: Boolean(configuredPhoneRecord),
        configuredPhoneAttachedToSelectedAgent: Boolean(
          selectedAgentId &&
            configuredPhoneRecord &&
            (configuredPhoneRecord.inboundAgentId === selectedAgentId ||
              configuredPhoneRecord.outboundAgentId === selectedAgentId),
        ),
      };
    } catch (error) {
      retellWorkspaceProbe = {
        ok: false,
        error: error instanceof Error ? error.message : "Retell probe failed",
      };
    }
  }

  return NextResponse.json({
    webhookUrl: webhookUrl || null,
    apiKey: fingerprintSecret(apiKey),
    phoneNumber: fingerprintSecret(configuredPhone),
    agentId: configuredAgentId || null,
    environment: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    productionModeActive: process.env.NODE_ENV === "production",
    diagnostics: await getRetellRuntimeDiagnostics(),
    retellWorkspaceProbe,
  }, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
