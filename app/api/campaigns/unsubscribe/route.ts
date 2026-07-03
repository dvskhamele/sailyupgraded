import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { setOrganizationContext } from "@/lib/organization-context";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse("Invalid unsubscribe link.", { status: 400 });
  }

  const sendRows = await prismadb.$queryRaw<
    Array<{ id: string; organizationId: string; unsubscribed_at: Date | null }>
  >`
    SELECT id, organizationId, unsubscribed_at
    FROM crm_campaign_sends
    WHERE unsubscribe_token = ${token}
    LIMIT 1
  `;
  const send = sendRows[0];

  if (!send) {
    return new NextResponse("Unsubscribe link not found.", { status: 404 });
  }

  setOrganizationContext(send.organizationId);

  if (!send.unsubscribed_at) {
    await prismadb.crm_campaign_sends.update({
      where: { id: send.id },
      data: { unsubscribed_at: new Date() },
    });
  }

  return new NextResponse(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:40px">
      <h2>You have been unsubscribed.</h2>
      <p>You will no longer receive emails from this campaign.</p>
    </body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
