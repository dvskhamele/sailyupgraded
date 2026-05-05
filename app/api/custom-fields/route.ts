import { NextRequest, NextResponse } from "next/server";

import { prismadb } from "@/lib/prisma";
import {
  buildAppliesToScopes,
  normalizeAppliesTo,
  normalizeContactRoleScope,
  normalizeOptions,
} from "./helpers";

type CustomFieldPayload = {
  name?: string;
  type?: string;
  applies_to?: unknown;
  options?: unknown;
  contact_role?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CustomFieldPayload;
    const name = body.name?.trim();
    const type = body.type?.trim();
    const appliesTo = normalizeAppliesTo(body.applies_to);
    const options = normalizeOptions(body.options);
    const contactRole = normalizeContactRoleScope(body.contact_role);

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
        applies_to: buildAppliesToScopes(appliesTo, contactRole),
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
