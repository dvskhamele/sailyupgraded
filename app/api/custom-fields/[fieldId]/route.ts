import { NextRequest, NextResponse } from "next/server";

import { prismadb } from "@/lib/prisma";

import { normalizeAppliesTo, normalizeOptions } from "../helpers";

type CustomFieldPayload = {
  name?: string;
  type?: string;
  applies_to?: unknown;
  options?: unknown;
};

type RouteContext = {
  params: Promise<{
    fieldId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { fieldId } = await context.params;
    const body = (await request.json()) as CustomFieldPayload;
    const name = body.name?.trim();
    const type = body.type?.trim();
    const appliesTo = normalizeAppliesTo(body.applies_to);
    const options = normalizeOptions(body.options);

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 },
      );
    }

    const field = await prismadb.custom_fields.update({
      where: { id: fieldId },
      data: {
        name,
        type,
        applies_to: appliesTo,
        options,
      },
    });

    return NextResponse.json(field);
  } catch (error) {
    console.log("[CUSTOM_FIELDS_PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update custom field" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
    const { fieldId } = await context.params;

    await prismadb.custom_fields.delete({
      where: { id: fieldId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("[CUSTOM_FIELDS_DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete custom field" },
      { status: 500 },
    );
  }
}
