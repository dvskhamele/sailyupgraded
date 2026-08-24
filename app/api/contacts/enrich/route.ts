import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { bulkEnrichContacts } from "@/lib/contacts/bulk-enrichment-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let contactIds: string[] = [];

    if (Array.isArray(body.contactIds)) {
      contactIds = body.contactIds;
    } else if (Array.isArray(body.ids)) {
      contactIds = body.ids;
    } else if (Array.isArray(body.contacts)) {
      contactIds = body.contacts
        .map((c: any) => (typeof c === "string" ? c : c?.id))
        .filter(Boolean);
    }

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json(
        { error: "contactIds must be a non-empty array of contact IDs" },
        { status: 400 }
      );
    }

    const result = await bulkEnrichContacts(contactIds, session.user.id);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("[POST /api/contacts/enrich] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error while enriching contacts" },
      { status: 500 }
    );
  }
}
