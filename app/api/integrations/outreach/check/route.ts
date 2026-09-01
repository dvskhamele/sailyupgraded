import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

/**
 * POST /api/integrations/outreach/check
 *
 * "Which of these people have already been reached out to?"
 *
 * The browser extensions call this while COLLECTING, before anybody is
 * messaged, so an already-worked profile is dropped and a fresh one collected
 * in its place rather than burning one of the requested slots.
 *
 * This deployment is single-tenant, so the check is across all leads. The
 * SailySaaS deployment has the same route scoped to the caller's organisation,
 * because there a lead worked by one organisation must not block a different
 * one from approaching the same person.
 *
 * Request:  { platform: "linkedin"|"instagram"|"facebook", handles: [...] }
 * Response: { success: true, contacted: [...] }
 *
 * Fails open — an empty list on any problem — so a lookup failure can never
 * stop a campaign, only lose deduplication for that run.
 */

const MAX_HANDLES = 200;

const PLATFORM_COLUMN: Record<string, "social_linkedin" | "social_instagram" | "social_facebook"> = {
  linkedin: "social_linkedin",
  instagram: "social_instagram",
  facebook: "social_facebook",
};

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("content-type") !== "application/json") {
      return NextResponse.json(
        { success: false, error: "Content-Type must be application/json" },
        { status: 400 },
      );
    }

    const token = req.headers.get("authorization");
    if (!token || !process.env.NEXTCRM_TOKEN || token.trim() !== process.env.NEXTCRM_TOKEN.trim()) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const platform = String(body?.platform || "").toLowerCase();
    const column = PLATFORM_COLUMN[platform];

    if (!column) {
      return NextResponse.json(
        { success: false, error: "platform must be linkedin, instagram or facebook" },
        { status: 400 },
      );
    }

    const handles: string[] = Array.isArray(body?.handles)
      ? body.handles
          .map((h: unknown) => String(h || "").trim().toLowerCase())
          .filter(Boolean)
          .slice(0, MAX_HANDLES)
      : [];

    if (handles.length === 0) {
      return NextResponse.json({ success: true, contacted: [] });
    }

    // Stored values are full profile URLs, so the handle is matched as a
    // substring. `username` is checked too, because the Instagram import
    // writes the bare handle there.
    const leads = await prismadb.crm_Leads.findMany({
      where: {
        OR: handles.flatMap((handle) => [
          { [column]: { contains: handle } } as any,
          { username: handle },
        ]),
      },
      select: {
        username: true,
        social_linkedin: true,
        social_instagram: true,
        social_facebook: true,
      },
    });

    const haystack = leads
      .map((lead) =>
        [lead.username, lead.social_linkedin, lead.social_instagram, lead.social_facebook]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      )
      .join("\n");

    const contacted = handles.filter((handle) => haystack.includes(handle));

    console.log("[OUTREACH_CHECK]", {
      platform,
      asked: handles.length,
      alreadyContacted: contacted.length,
    });

    return NextResponse.json({ success: true, contacted });
  } catch (error: any) {
    console.error("[OUTREACH_CHECK] failed:", error?.message);
    return NextResponse.json({ success: true, contacted: [], error: error?.message });
  }
}
