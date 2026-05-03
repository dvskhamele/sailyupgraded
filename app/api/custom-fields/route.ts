import { NextRequest, NextResponse } from "next/server";

import { prismadb } from "@/lib/prisma";

type CustomFieldPayload = {
  name?: string;
  type?: string;
  applies_to?: unknown;
  options?: unknown;
};

function normalizeOptions(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CustomFieldPayload;
    const name = body.name?.trim();
    const type = body.type?.trim();
    const appliesTo = Array.isArray(body.applies_to)
      ? body.applies_to.filter((value): value is string => typeof value === "string")
      : [];
    const options = normalizeOptions(body.options);

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 },
      );
    }

    const field = await prismadb.custom_fields.create({
      data: {
        name,
        type,
        applies_to: appliesTo,
        options,
      },
    });

    return NextResponse.json(field, { status: 201 });
  } catch (error) {
    console.log("[CUSTOM_FIELDS_POST]", error);
    return NextResponse.json(
      { error: "Failed to create custom field" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const fields = await prismadb.custom_fields.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(fields);
  } catch (error) {
    console.log("[CUSTOM_FIELDS_GET]", error);
    return NextResponse.json(
      { error: "Failed to load custom fields" },
      { status: 500 },
    );
  }
}
