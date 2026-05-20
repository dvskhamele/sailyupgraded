import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getSession } from "@/lib/auth-server";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";
import type { CustomFieldEntity } from "@/lib/custom-fields";
import { prismadb } from "@/lib/prisma";
import {
  deleteFileFromR2,
  getR2KeyFromPublicUrl,
} from "@/lib/r2";
import { isCustomFieldFileMetadata } from "@/lib/storage-validation";
import { releaseWorkspaceStorage } from "@/lib/workspace-storage";

type DeleteCustomFieldFilePayload = {
  entityType?: CustomFieldEntity;
  entityId?: string;
  fieldId?: string;
  file?: unknown;
};

function getCurrentCustomFieldValue(values: unknown, fieldId: string) {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return null;
  }

  return (values as Record<string, unknown>)[fieldId] ?? null;
}

function removeCustomFieldValue(values: unknown, fieldId: string) {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return null;
  }

  const nextValues = { ...(values as Record<string, unknown>) };
  delete nextValues[fieldId];

  return Object.keys(nextValues).length > 0
    ? (nextValues as Prisma.InputJsonObject)
    : null;
}

function fileMatchesCurrentValue(file: unknown, currentValue: unknown) {
  return (
    isCustomFieldFileMetadata(file) &&
    isCustomFieldFileMetadata(currentValue) &&
    file.url === currentValue.url &&
    file.name === currentValue.name &&
    file.size === currentValue.size &&
    file.type === currentValue.type
  );
}

async function getRecord(
  entityType: CustomFieldEntity,
  entityId: string,
  user: NonNullable<Awaited<ReturnType<typeof getSession>>>["user"],
) {
  if (entityType === "Contact") {
    return prismadb.crm_Contacts.findFirst({
      where: {
        id: entityId,
        deletedAt: null,
        ...(await buildExistingDbContactVisibilityFilter(user)),
      },
      select: { id: true, custom_fields_data: true },
    });
  }

  if (entityType === "Lead") {
    return prismadb.crm_Leads.findFirst({
      where: { id: entityId, deletedAt: null },
      select: { id: true, custom_fields_data: true },
    });
  }

  return prismadb.crm_Opportunities.findFirst({
    where: { id: entityId, deletedAt: null },
    select: { id: true, custom_fields_data: true },
  });
}

async function updateRecordCustomFields(
  entityType: CustomFieldEntity,
  entityId: string,
  customFieldsData: Prisma.InputJsonObject | null,
  userId: string,
) {
  const data = {
    custom_fields_data: customFieldsData ?? Prisma.JsonNull,
    updatedBy: userId,
  };

  if (entityType === "Contact") {
    return prismadb.crm_Contacts.update({
      where: { id: entityId },
      data,
      select: { id: true },
    });
  }

  if (entityType === "Lead") {
    return prismadb.crm_Leads.update({
      where: { id: entityId },
      data,
      select: { id: true },
    });
  }

  return prismadb.crm_Opportunities.update({
    where: { id: entityId },
    data,
    select: { id: true },
  });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | DeleteCustomFieldFilePayload
    | null;
  const entityType = payload?.entityType;
  const entityId = payload?.entityId;
  const fieldId = payload?.fieldId;
  const file = payload?.file;

  if (
    !entityId ||
    !fieldId ||
    (entityType !== "Contact" &&
      entityType !== "Lead" &&
      entityType !== "Opportunity")
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!isCustomFieldFileMetadata(file)) {
    return NextResponse.json({ error: "Invalid file metadata" }, { status: 400 });
  }

  const record = await getRecord(entityType, entityId, session.user);
  if (!record) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  const currentValue = getCurrentCustomFieldValue(
    record.custom_fields_data,
    fieldId,
  );
  if (!fileMatchesCurrentValue(file, currentValue)) {
    return NextResponse.json(
      { error: "File is no longer attached to this field" },
      { status: 409 },
    );
  }

  const key = getR2KeyFromPublicUrl(file.url);
  if (!key) {
    return NextResponse.json({ error: "Invalid file url" }, { status: 400 });
  }

  try {
    await deleteFileFromR2(key);
    await releaseWorkspaceStorage(file.size);
    await updateRecordCustomFields(
      entityType,
      entityId,
      removeCustomFieldValue(record.custom_fields_data, fieldId),
      session.user.id,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CUSTOM_FIELD_FILE_DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 },
    );
  }
}
