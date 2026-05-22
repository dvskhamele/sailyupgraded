import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { getRetellApiKey, listRetellAgents } from "@/lib/retell";

export async function GET() {
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

  try {
    const agents = await listRetellAgents(apiKey);
    const hydratedAgents = agents
      .filter((agent) => agent.agent_id)
      .map((agent) => ({
        id: agent.agent_id as string,
        version: agent.version,
        name: agent.agent_name ?? "Unnamed agent",
        isPublished: Boolean(agent.is_published),
      }));

    return NextResponse.json({ agents: hydratedAgents });
  } catch (error) {
    console.error("[RETELL_AGENTS_GET]", error);
    return NextResponse.json(
      { error: "Failed to load Retell agents" },
      { status: 500 },
    );
  }
}
