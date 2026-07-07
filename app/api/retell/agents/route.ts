import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { getRetellApiKey, listRetellAgents } from "@/lib/retell-server";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = await getRetellApiKey();
    if (!apiKey) {
      return NextResponse.json({
        agents: [],
        error: "Retell integration is not configured",
      });
    }

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
      {
        agents: [],
        error: "Retell integration is not configured or needs to be reconnected",
      },
      { status: 200 }
    );
  }
}
