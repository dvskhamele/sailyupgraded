import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";
import {
  uploadAgentPhotoBuffer,
  validateAgentPhotoFile,
  MAX_AGENT_PHOTO_SIZE_BYTES,
} from "@/lib/crm/agent-photo-storage";
import { detectImageMimeType } from "@/lib/crm/excel-image-extractor";
import { Prisma } from "@prisma/client";

interface RouteContext {
  params: Promise<{ contactId: string }> | { contactId: string };
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await Promise.resolve(context.params);
  const contactId = resolvedParams.contactId || (resolvedParams as any).id;

  if (!contactId) {
    return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
  }

  try {
    // 1. Verify organization/tenant scoping and contact existence
    const visibilityFilter = await buildExistingDbContactVisibilityFilter(session.user);
    const contact = await prismadb.crm_Contacts.findFirst({
      where: {
        id: contactId,
        deletedAt: null,
        ...visibilityFilter,
      },
      select: {
        id: true,
        custom_fields_data: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found or you do not have permission to update it." },
        { status: 404 }
      );
    }

    // 2. Parse multipart/form-data
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Please select an image file." }, { status: 400 });
    }

    // 3. Client & server file size limit check
    if (file.size > MAX_AGENT_PHOTO_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Image is too large. Maximum size is 5MB." },
        { status: 400 }
      );
    }

    // 4. Validate image type and magic bytes
    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateAgentPhotoFile({
      name: file.name,
      size: file.size,
      type: file.type,
      buffer,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Please upload a valid image file." },
        { status: 400 }
      );
    }

    // 5. Upload buffer to storage (MinIO / R2)
    const mimeType = detectImageMimeType(buffer, file.name);
    const photoUrl = await uploadAgentPhotoBuffer(buffer, mimeType, file.name);

    if (!photoUrl) {
      return NextResponse.json(
        { error: "Failed to upload image. Please try again." },
        { status: 500 }
      );
    }

    // 6. Save photo reference to contact custom_fields_data
    const existingCustomFields =
      contact.custom_fields_data &&
      typeof contact.custom_fields_data === "object" &&
      !Array.isArray(contact.custom_fields_data)
        ? (contact.custom_fields_data as Record<string, unknown>)
        : {};

    const updatedCustomFields = {
      ...existingCustomFields,
      agent_photo: photoUrl,
      "Agent Photo": photoUrl,
    };

    await prismadb.crm_Contacts.update({
      where: { id: contactId },
      data: {
        custom_fields_data: updatedCustomFields as any,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      },
    });

    revalidatePath(`/crm/contacts/${contactId}`);
    revalidatePath("/crm/contacts");

    return NextResponse.json({
      success: true,
      photoUrl,
    });
  } catch (err: any) {
    console.error("[CONTACT_PHOTO_UPLOAD_API_ERROR]", err);
    return NextResponse.json(
      { error: err?.message || "Failed to upload contact photo." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await Promise.resolve(context.params);
  const contactId = resolvedParams.contactId || (resolvedParams as any).id;

  if (!contactId) {
    return NextResponse.json({ error: "Contact ID is required" }, { status: 400 });
  }

  try {
    const visibilityFilter = await buildExistingDbContactVisibilityFilter(session.user);
    const contact = await prismadb.crm_Contacts.findFirst({
      where: {
        id: contactId,
        deletedAt: null,
        ...visibilityFilter,
      },
      select: {
        id: true,
        custom_fields_data: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { error: "Contact not found or you do not have permission to update it." },
        { status: 404 }
      );
    }

    const existingCustomFields =
      contact.custom_fields_data &&
      typeof contact.custom_fields_data === "object" &&
      !Array.isArray(contact.custom_fields_data)
        ? (contact.custom_fields_data as Record<string, unknown>)
        : {};

    const updatedCustomFields = { ...existingCustomFields };
    delete updatedCustomFields.agent_photo;
    delete updatedCustomFields["Agent Photo"];
    delete updatedCustomFields["agent_photo"];
    delete updatedCustomFields["photo"];
    delete updatedCustomFields["avatar"];
    delete updatedCustomFields["image"];

    await prismadb.crm_Contacts.update({
      where: { id: contactId },
      data: {
        custom_fields_data: (Object.keys(updatedCustomFields).length > 0
          ? updatedCustomFields
          : Prisma.DbNull) as any,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      },
    });

    revalidatePath(`/crm/contacts/${contactId}`);
    revalidatePath("/crm/contacts");

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[CONTACT_PHOTO_DELETE_API_ERROR]", err);
    return NextResponse.json(
      { error: err?.message || "Failed to remove contact photo." },
      { status: 500 }
    );
  }
}
