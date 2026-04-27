import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { serializeDecimals } from "@/lib/serialize-decimals";

export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, stage } = await request.json();

    if (!id || !stage) {
      return NextResponse.json(
        { error: "Both id and stage are required" },
        { status: 400 },
      );
    }

    const updatedOpportunity = await prismadb.crm_Opportunities.update({
      where: { id },
      data: {
        assigned_sales_stage: { connect: { id: stage } },
        updatedBy: session.user.id,
        status: "ACTIVE",
      },
      include: {
        assigned_account: {
          select: {
            name: true,
          },
        },
        assigned_sales_stage: {
          select: {
            name: true,
          },
        },
        assigned_to_user: {
          select: {
            name: true,
          },
        },
      },
    });

    revalidatePath("/[locale]/(routes)/crm/opportunities", "page");
    revalidatePath("/[locale]/(routes)/crm/dashboard", "page");

    return NextResponse.json({
      data: serializeDecimals(updatedOpportunity),
    });
  } catch (error) {
    console.error("[api/opportunity/update-stage] failed:", error);

    return NextResponse.json(
      { error: "Failed to update opportunity stage" },
      { status: 500 },
    );
  }
}
