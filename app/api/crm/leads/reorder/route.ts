import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { requireOrganizationId } from "@/lib/auth-server";

const configTypeSupportsOrder: Record<string, boolean> = {
  salesStage: true,
  leadStatus: true,
  leadSource: false,
  leadType: false,
  industry: true,
  contactType: false,
  opportunityType: true,
  leads: true,
};

export async function POST(req: Request) {
  try {
    await requireOrganizationId();
    const { searchParams } = new URL(req.url);
    const body = await req.json();
    
    // Support both old format (array only) and new format ({configType, items})
    const items = Array.isArray(body) ? body : body.items;
    
    // Priority: query param > body field > default to salesStage
    const configType = searchParams.get("configType") || (!Array.isArray(body) ? body.configType : "salesStage");

    if (!items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: "Invalid data format" },
        { status: 400 }
      );
    }

    if (!configTypeSupportsOrder[configType]) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const updatePromises: Prisma.PrismaPromise<unknown>[] = [];

    // Determine which model to update based on configType
    items.forEach((item: any, index: number) => {
      if (!item?.id) return;

      switch (configType) {
        case "salesStage":
          // Sales Stages map to crm_Opportunities_Sales_Stages
          updatePromises.push(prismadb.crm_Opportunities_Sales_Stages.update({
            where: { id: item.id },
            data: { order: index },
          }));
          return;
        case "leadStatus":
          // Lead Statuses map to crm_Lead_Statuses
          updatePromises.push(prismadb.crm_Lead_Statuses.update({
            where: { id: item.id },
            data: { order: index },
          }));
          return;
        case "leadSource":
        case "leadType":
          return;
        case "industry":
          updatePromises.push(prismadb.crm_Industry_Type.update({
            where: { id: item.id },
            data: { order: index },
          }));
          return;
        case "contactType":
          return;
        case "opportunityType":
          updatePromises.push(prismadb.crm_Opportunities_Type.update({
            where: { id: item.id },
            data: { order: index },
          }));
          return;
        case "leads":
          updatePromises.push(prismadb.crm_Leads.update({
            where: { id: item.id },
            data: { order: index },
          }));
          return;
        default:
          return;
      }
    });

    if (updatePromises.length > 0) {
      await prismadb.$transaction(updatePromises);
    }

    // Refresh appropriate tags
    // @ts-expect-error
    revalidateTag("crm-settings");
    // @ts-expect-error
    revalidateTag("leads");

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Reorder Error:", error);

    return NextResponse.json(
      { error: "Reorder failed" },
      { status: 500 }
    );
  }
}
