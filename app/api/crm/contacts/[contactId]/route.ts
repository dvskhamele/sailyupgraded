import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";

const FIELD_MAP: Record<string, string> = {
  position: "position",
  website: "website",
  social_linkedin: "social_linkedin",
  social_twitter: "social_twitter",
  social_facebook: "social_facebook",
  social_instagram: "social_instagram",
  description: "description",
  office_phone: "office_phone",
  mobile_phone: "mobile_phone",
};

interface RouteContext {
  params: Promise<{ contactId: string }> | { contactId: string };
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const resolvedParams = await Promise.resolve(context.params);
  const contactId = resolvedParams.contactId || (resolvedParams as any).id;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!contactId) {
    return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
  }

  const { enrichmentFields } = await request.json();
  if (!enrichmentFields || typeof enrichmentFields !== "object") {
    return NextResponse.json({ error: "enrichmentFields required" }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  for (const [key, value] of Object.entries(enrichmentFields)) {
    const column = FIELD_MAP[key];
    if (column) updates[column] = String(value);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const existing = await prismadb.crm_Contacts.findFirst({
    where: {
      id: contactId,
      deletedAt: null,
      ...(await buildExistingDbContactVisibilityFilter(session.user)),
    },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const contact = await prismadb.crm_Contacts.update({
    where: { id: contactId },
    data: { ...updates, updatedBy: session.user.id },
    select: { id: true },
  });

  return NextResponse.json({ success: true, id: contact.id });
}
