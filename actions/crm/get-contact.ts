import { Prisma } from "@prisma/client";
import { prismadb, withPrismaRetry } from "@/lib/prisma";
import { getSession, requireOrganizationId } from "@/lib/auth-server";
import { getCrmContactDetailSelect } from "@/lib/prisma-contact-select";
import { getExistingDbColumnNames } from "@/lib/prisma-model-fields";
import { buildExistingDbContactVisibilityFilter } from "@/lib/crm/contact-visibility.server";
import { serializeDecimals } from "@/lib/serialize-decimals";
import { runWithOrganizationContext } from "@/lib/organization-context";

function quoteIdentifier(identifier: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid contact column name: ${identifier}`);
  }

  return `\`${identifier}\``;
}

function getContactModelColumnNames() {
  const model = Prisma.dmmf.datamodel.models.find((entry) => entry.name === "crm_Contacts");
  return new Set(
    model?.fields
      .filter((field) => field.kind === "scalar" || field.kind === "enum")
      .map((field) => field.dbName ?? field.name) ?? [],
  );
}

function formatImportedColumnLabel(column: string) {
  return column
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function getImportedContactColumnData(contactId: string, organizationId: string) {
  const knownColumns = getContactModelColumnNames();
  const columns = await getExistingDbColumnNames("crm_Contacts");
  const importedColumns = Array.from(columns)
    .filter((column) => !knownColumns.has(column));

  if (importedColumns.length === 0) {
    return [];
  }

  const selectedColumns = importedColumns.map(quoteIdentifier).join(", ");
  const rows = await prismadb.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT ${selectedColumns} FROM ${quoteIdentifier("crm_Contacts")} WHERE ${quoteIdentifier("id")} = ? AND ${quoteIdentifier("organizationId")} = ? LIMIT 1`,
    contactId,
    organizationId,
  );
  const row = rows[0] ?? {};

  return importedColumns.flatMap((column) => {
    const value = row[column];
    if (value == null) return [];

    const text = String(value).trim();
    if (!text) return [];

    return [{
      column,
      label: formatImportedColumnLabel(column),
      value: text,
    }];
  });
}

export const getContact = async (contactId: string) => {
  const organizationId = await requireOrganizationId();
  return withPrismaRetry(async () => {
    return runWithOrganizationContext(organizationId, async () => {
      const session = await getSession();
      if (!session?.user.organizationId) return null;

      const select = await getCrmContactDetailSelect();
      const data = await prismadb.crm_Contacts.findFirst({
        where: {
          id: contactId,
          organizationId,
          deletedAt: null,
          ...(await buildExistingDbContactVisibilityFilter(session?.user)),
        },
        select,
      });

      if (!data) {
        return data;
      }

      const importedColumns = await getImportedContactColumnData(contactId, session.user.organizationId);

      return serializeDecimals({
        ...data,
        imported_columns_data: importedColumns,
      });
    });
  });
};
