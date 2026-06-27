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

  try {
    while (await prismadb.Organization.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }
  } catch (e) {
    // If Organization table doesn't exist, just return slug
    console.warn("[createUniqueSlug] Error checking slug uniqueness:", e);
  }

  return slug;
}

export async function createOrganization(formData: FormData) {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  let existingOrganization = null;
  try {
    existingOrganization = await findCurrentOrganizationForUser(
      session.user.id,
    );
  } catch (e) {
    console.warn("[createOrganization] Error finding existing org:", e);
  }

  if (existingOrganization) {
    redirect("/crm/dashboard");
  }

  const name = String(formData.get("name") ?? "").trim();

  if (name.length < 2) {
    throw new Error("Organization name must be at least 2 characters.");
  }

  const slug = await createUniqueSlug(name);

  let organizationId: string;
  try {
    organizationId = await prismadb.$transaction(async (tx) => {
      const organization = await tx.Organization.create({
        data: {
          name,
          slug,
        },
      });

      await tx.OrganizationMember.create({
        data: {
          organizationId: organization.id,
          userId: session.user.id,
          role: "admin",
        },
      });

      return organization.id;
    });
  } catch (e) {
    console.warn("[createOrganization] Creating org failed, trying to create tables first...", e);
    // Try to create the tables manually
    const createTablesSql = `
      CREATE TABLE IF NOT EXISTS \`organizations\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`name\` VARCHAR(191) NOT NULL,
        \`slug\` VARCHAR(191) NOT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL,
        UNIQUE INDEX \`organizations_slug_key\`(\`slug\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
      
      CREATE TABLE IF NOT EXISTS \`organization_members\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`organizationId\` VARCHAR(191) NOT NULL,
        \`userId\` VARCHAR(191) NOT NULL,
        \`role\` ENUM('admin', 'member', 'viewer') NOT NULL DEFAULT 'member',
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE INDEX \`organization_members_organizationId_userId_key\`(\`organizationId\`, \`userId\`),
        INDEX \`organization_members_organizationId_idx\`(\`organizationId\`),
        INDEX \`organization_members_userId_idx\`(\`userId\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `;

    await prismadb.$executeRawUnsafe(createTablesSql);

    // Retry transaction
    organizationId = await prismadb.$transaction(async (tx) => {
      const organization = await tx.Organization.create({
        data: {
          name,
          slug,
        },
      });

      await tx.OrganizationMember.create({
        data: {
          organizationId: organization.id,
          userId: session.user.id,
          role: "admin",
        },
      });

      return organization.id;
    });
  }

  setOrganizationContext(organizationId);

  redirect("/crm/dashboard");
}
