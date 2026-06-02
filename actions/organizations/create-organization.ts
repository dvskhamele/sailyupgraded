"use server";

import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-server";
import { setOrganizationContext } from "@/lib/organization-context";
import { findCurrentOrganizationForUser } from "@/lib/organization-queries";
import { prismadb } from "@/lib/prisma";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function createUniqueSlug(name: string) {
  const baseSlug = slugify(name) || "organization";
  let slug = baseSlug;
  let suffix = 1;

  while (await prismadb.organization.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  return slug;
}

export async function createOrganization(formData: FormData) {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const existingOrganization = await findCurrentOrganizationForUser(
    session.user.id,
  );

  if (existingOrganization) {
    redirect("/crm/dashboard");
  }

  const name = String(formData.get("name") ?? "").trim();

  if (name.length < 2) {
    throw new Error("Organization name must be at least 2 characters.");
  }

  const slug = await createUniqueSlug(name);

  const organizationId = await prismadb.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name,
        slug,
      },
    });

    await tx.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: session.user.id,
        role: "admin",
      },
    });

    return organization.id;
  });

  setOrganizationContext(organizationId);

  redirect("/crm/dashboard");
}
