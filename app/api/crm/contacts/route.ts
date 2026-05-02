import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { getCrmContactListSelect } from "@/lib/prisma-contact-select";
import { buildContactRoleFilter } from "@/lib/contact-options";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = request.nextUrl.searchParams.get("role");
  const select = await getCrmContactListSelect();

  const contacts = await prismadb.crm_Contacts.findMany({
    where: {
      deletedAt: null,
      ...buildContactRoleFilter(role),
    },
    select,
  });

  return NextResponse.json(contacts);
}
