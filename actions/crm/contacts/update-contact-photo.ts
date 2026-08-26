"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-server";
import { prismadb } from "@/lib/prisma";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";
import {
  uploadAgentPhotoBuffer,
  validateAgentPhotoFile,
} from "@/lib/crm/agent-photo-storage";
import { detectImageMimeType } from "@/lib/crm/excel-image-extractor";
import { Prisma } from "@prisma/client";

export async function updateContactPhoto(
  contactId: string,
  formData: FormData,
) {
  const session = await getSession();
  if (!session) {
    return { error: "Unauthorized" };
  }

  if (!contactId) {
    return { error: "Contact ID is required" };
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { error: "Please select an image file." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const validation = validateAgentPhotoFile({
    name: file.name,
    size: file.size,
    type: file.type,
    buffer,
  });

  if (!validation.valid) {
    return { error: validation.error || "Please upload a valid image file." };
  }

  const mimeType = detectImageMimeType(buffer, file.name);

  let photoUrl: string;
  try {
    photoUrl = await uploadAgentPhotoBuffer(buffer, mimeType, file.name);
    if (!photoUrl) {
      return { error: "Failed to upload image. Please try again." };
    }
  } catch (err: any) {
    console.error("[UPDATE_CONTACT_PHOTO_UPLOAD_ERROR]", err);
    return { error: err?.message || "Failed to upload image." };
  }

  try {
    const contact = await prismadb.crm_Contacts.findFirst({
      where: {
        id: contactId,
        deletedAt: null,
        ...(await buildExistingDbContactVisibilityFilter(session.user)),
      },
      select: {
        id: true,
        custom_fields_data: true,
      },
    });

    if (!contact) {
      return { error: "Contact not found" };
    }

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
        custom_fields_data: updatedCustomFields,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      },
    });

    revalidatePath(`/crm/contacts/${contactId}`);
    revalidatePath("/crm/contacts");

    return { success: true, photoUrl };
  } catch (err: any) {
    console.error("[UPDATE_CONTACT_PHOTO_DB_ERROR]", err);
    return { error: "Failed to save photo to contact record." };
  }
}

export async function removeContactPhoto(contactId: string) {
  const session = await getSession();
  if (!session) {
    return { error: "Unauthorized" };
  }

  if (!contactId) {
    return { error: "Contact ID is required" };
  }

  try {
    const contact = await prismadb.crm_Contacts.findFirst({
      where: {
        id: contactId,
        deletedAt: null,
        ...(await buildExistingDbContactVisibilityFilter(session.user)),
      },
      select: {
        id: true,
        custom_fields_data: true,
      },
    });

    if (!contact) {
      return { error: "Contact not found" };
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

    return { success: true };
  } catch (err: any) {
    console.error("[REMOVE_CONTACT_PHOTO_ERROR]", err);
    return { error: "Failed to remove photo." };
  }
}
