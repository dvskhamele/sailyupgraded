import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { revalidateTag } from "next/cache";

export async function POST(req: Request) {
  try {
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

    // Determine which model to update based on configType
    const updatePromises = items.map((item: any, index: number) => {
      if (!item?.id) return null;

      switch (configType) {
        case "salesStage":
          // Sales Stages map to crm_Opportunities_Sales_Stages
          return prismadb.crm_Opportunities_Sales_Stages.update({
            where: { id: item.id },
            data: { order: index },
          });
        case "leadStatus":
          // Lead Statuses map to crm_Lead_Statuses
          return prismadb.crm_Lead_Statuses.update({
            where: { id: item.id },
            data: { order: index },
          });
        case "leadSource":
          return prismadb.crm_Lead_Sources.update({
            where: { id: item.id },
            data: { order: index },
          });
        case "leadType":
          return prismadb.crm_Lead_Types.update({
            where: { id: item.id },
            data: { order: index },
          });
        case "industry":
          return prismadb.crm_Industry_Type.update({
            where: { id: item.id },
            data: { order: index },
          });
        case "contactType":
          return prismadb.crm_Contact_Types.update({
            where: { id: item.id },
            data: { order: index },
          });
        case "opportunityType":
          return prismadb.crm_Opportunities_Type.update({
            where: { id: item.id },
            data: { order: index },
          });
        case "leads":
          return prismadb.crm_Leads.update({
            where: { id: item.id },
            data: { order: index },
          });
        default:
          return null;
      }
    }).filter(Boolean);

    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
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
