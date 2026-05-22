import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import {
  getRetellAgentScript,
  getRetellApiKey,
  listRetellAgents,
} from "@/lib/retell";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = getRetellApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Retell API key is not configured" },
      { status: 400 },
    );
  }

  const { agentId } = await params;

  try {
    const agents = await listRetellAgents(apiKey);
    const agent = agents.find((item) => item.agent_id === agentId);

    if (!agent) {
      return NextResponse.json(
        { error: "Retell agent not found" },
        { status: 404 },
      );
    }

    const script = await getRetellAgentScript(apiKey, agent.response_engine);
    return NextResponse.json({ script });
  } catch (error) {
    console.error("[RETELL_AGENT_SCRIPT_GET]", error);
    return NextResponse.json(
      { error: "Failed to load Retell agent script" },
      { status: 500 },
    );
  }
}
