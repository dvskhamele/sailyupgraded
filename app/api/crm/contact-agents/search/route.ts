import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";
import { extractAgentPhotoUrl } from "@/lib/crm/agent-photo";

const DEFAULT_TAKE = 50;

function numberParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getAgentDisplayName(agent: {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}) {
  return [agent.first_name, agent.last_name].filter(Boolean).join(" ").trim() || agent.email || "Unnamed agent";
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search")?.trim() ?? "";
  const skip = numberParam(searchParams.get("skip"), 0);
  const take = numberParam(searchParams.get("take"), DEFAULT_TAKE);

  const where = {
    deletedAt: null,
    role: "Agent",
    ...(await buildExistingDbContactVisibilityFilter(session.user)),
    ...(search
      ? {
          OR: [
            { first_name: { contains: search } },
            { last_name: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
            { serial: { contains: search } },
            { company: { contains: search } },
          ],
        }
      : {}),
  };

  const [agents, total] = await Promise.all([
    prismadb.crm_Contacts.findMany({
      where,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        serial: true,
        custom_fields_data: true,
      },
      orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
      skip,
      take,
    }),
    prismadb.crm_Contacts.count({ where }),
  ]);

  return NextResponse.json({
    agents: agents.map((agent) => {
      const photo = extractAgentPhotoUrl(agent);
      return {
        id: agent.id,
        name: getAgentDisplayName(agent),
        email: agent.email,
        serial: agent.serial,
        avatar: photo,
        photo: photo,
      };
    }),
    hasMore: skip + agents.length < total,
  });
}
