import { LayoutGrid } from "lucide-react";

import { prismadb } from "@/lib/prisma";
import {
  filterCustomFieldsForEntity,
  type CustomFieldEntity,
} from "@/lib/custom-fields";
import { cn } from "@/lib/utils";

type CustomFieldsDisplayProps = {
  entityType: CustomFieldEntity;
  values: unknown;
  contactRole?: string | null;
  className?: string;
};

function getCustomFieldValue(values: unknown, fieldId: string) {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return null;
  }

  const value = (values as Record<string, unknown>)[fieldId];
  if (value == null) return null;

  const text = String(value).trim();
  return text || null;
}

export async function CustomFieldsDisplay({
  entityType,
  values,
  contactRole,
  className,
}: CustomFieldsDisplayProps) {
  const customFields = await prismadb.custom_fields.findMany({
    orderBy: { createdAt: "asc" },
  });
  const displayFields = filterCustomFieldsForEntity(
    customFields,
    entityType,
    contactRole,
  ).map((field) => ({
    field,
    value: getCustomFieldValue(values, field.id),
  }));

  if (displayFields.length === 0) {
    return null;
  }

  return (
    <div className={cn("col-span-full border-t pt-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <LayoutGrid className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Custom Fields</h3>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {displayFields.map(({ field, value }) => (
          <div
            key={field.id}
            className="rounded-md border bg-muted/20 px-3 py-2"
          >
            <p className="text-sm font-medium leading-none">{field.name}</p>
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {value ?? "Not set"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
