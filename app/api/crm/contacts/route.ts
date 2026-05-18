import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import {
  isPrismaAccessDeniedError,
  isTransientPrismaConnectionError,
  prismadb,
  withPrismaRetry,
} from "@/lib/prisma";
import { getCrmContactListSelect } from "@/lib/prisma-contact-select";
import { buildContactRoleFilter } from "@/lib/contact-options";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = request.nextUrl.searchParams.get("role");
  try {
    const contacts = await withPrismaRetry(async () => {
      const select = await getCrmContactListSelect();

      return prismadb.crm_Contacts.findMany({
        where: {
          deletedAt: null,
          ...buildContactRoleFilter(role),
          ...(await buildExistingDbContactVisibilityFilter(session.user)),
        },
        select,
      });
    });

    return NextResponse.json(contacts);
  } catch (error) {
    if (!isTransientPrismaConnectionError(error) && !isPrismaAccessDeniedError(error)) {
      throw error;
    }

    console.warn("[CRM contacts API] database unavailable; returning empty contact list.");
    return NextResponse.json([]);
  }
}
