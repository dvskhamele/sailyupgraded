"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-server";
import { getDatabaseUrlDiagnostics, prismadb } from "@/lib/prisma";

function splitAgentName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { first_name: "", last_name: parts[0] ?? "" };
  }

  return {
    first_name: parts.slice(0, -1).join(" "),
    last_name: parts[parts.length - 1],
  };
}

function getAgentDisplayName(agent: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  return [agent.first_name, agent.last_name].filter(Boolean).join(" ").trim() || agent.email || "";
}

export async function createAgentOption(name: string) {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };
  console.log("[CONTACT CREATE DEBUG] Entry point", {
    path: "actions/crm/contacts/create-agent-option.ts:createAgentOption",
    database: getDatabaseUrlDiagnostics(),
  });
  console.log("[CONTACT CREATE DEBUG] Incoming payload", { name });

  const trimmedName = name.trim();
  if (!trimmedName) return { error: "Agent name is required" };

  const existingAgents = await prismadb.crm_Contacts.findMany({
    where: {
      deletedAt: null,
      role: "Agent",
      OR: [
        { first_name: { contains: trimmedName } },
        { last_name: { contains: trimmedName } },
        { email: { contains: trimmedName } },
      ],
    },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
    },
    take: 25,
  });

  const exactAgent = existingAgents.find(
    (agent) => getAgentDisplayName(agent).toLowerCase() === trimmedName.toLowerCase(),
  );

  if (exactAgent) {
    return {
      data: {
        id: exactAgent.id,
        name: getAgentDisplayName(exactAgent),
        email: exactAgent.email,
      },
    };
  }

  const { first_name, last_name } = splitAgentName(trimmedName);
  const createPayload = {
    v: 1,
    first_name: first_name || undefined,
    last_name,
    role: "Agent",
    status: true,
    createdBy: session.user.id,
    updatedBy: session.user.id,
    tags: [],
  };
  console.log("[CONTACT CREATE DEBUG] Prisma create payload", createPayload);
  console.log("[CONTACT CREATE DEBUG] Executing prismadb.crm_Contacts.create()");
  const createdAgent = await prismadb.crm_Contacts.create({
    data: createPayload,
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
    },
  });
  console.log("[CONTACT CREATE DEBUG] Create result", createdAgent);
  console.log("[CONTACT CREATE DEBUG] Created contact ID", { id: createdAgent.id });

  const verificationContact = await prismadb.crm_Contacts.findUnique({
    where: { id: createdAgent.id },
  });
  console.log("[CONTACT CREATE DEBUG] Verification query result", verificationContact);

  revalidatePath("/crm/contacts");

  return {
    data: {
      id: createdAgent.id,
      name: getAgentDisplayName(createdAgent),
      email: createdAgent.email,
    },
  };
}
