import { NextRequest, NextResponse } from "next/server";
import { getSession, requireOrganizationId } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { runWithOrganizationContext } from "@/lib/organization-context";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  const organizationId = await requireOrganizationId();

  const { id: targetId } = await params;
  const { name, email, phone, linkedinUrl } = await request.json() as {
    name?: string; email?: string; phone?: string; linkedinUrl?: string;
  };

  if (!name && !email) {
    return new NextResponse("name or email required", { status: 400 });
  }

  return await runWithOrganizationContext(organizationId, async () => {
    const contact = await prismadb.crm_Target_Contact.create({
      data: {
        organizationId,
        targetId,
        name: name ?? null,
        email: email ?? null,
        phone: phone || null,
        linkedinUrl: linkedinUrl || null,
        source: "manual",
        enrichStatus: "PENDING",
      },
    });

    return NextResponse.json(contact);
  });
}
