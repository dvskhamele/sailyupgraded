import { NextRequest, NextResponse } from "next/server";
import { deleteRetailAIActivity } from "@/actions/crm/retail-ai-activities/delete-retail-ai-activity";
import { updateRetailAIActivity } from "@/actions/crm/retail-ai-activities/update-retail-ai-activity";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const result = await updateRetailAIActivity({
    id,
    ...body,
    date: body.date ? new Date(body.date) : undefined,
  });

  if (result.error) {
    const status = result.error === "Unauthorized" ? 401 : result.error.includes("not found") ? 404 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const result = await deleteRetailAIActivity(id);

  if (result.error) {
    return NextResponse.json(result, { status: result.error === "Unauthorized" ? 401 : 400 });
  }

  return NextResponse.json(result);
}
