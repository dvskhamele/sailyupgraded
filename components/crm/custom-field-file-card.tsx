"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2 } from "lucide-react";

import type { CustomFieldEntity, CustomFieldFileValue } from "@/lib/custom-fields";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CustomFieldFileCardProps = {
  entityType: CustomFieldEntity;
  entityId: string;
  fieldId: string;
  value: CustomFieldFileValue;
};

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size < 0) return "Unknown size";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatFileType(type: string) {
  return type.split("/").pop()?.toUpperCase() || type || "Unknown type";
}

export function CustomFieldFileCard({
  entityType,
  entityId,
  fieldId,
  value,
}: CustomFieldFileCardProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${value.name}?`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/custom-fields/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          fieldId,
          file: value,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete file");
      }

      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete file",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-md border bg-background px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <a
              href={value.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-sm font-medium text-blue-600 hover:underline"
              title={value.name}
            >
              {value.name}
            </a>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatFileType(value.type)} · {formatFileSize(value.size)}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("h-8 w-8 shrink-0", error && "border-destructive")}
          disabled={isDeleting}
          onClick={handleDelete}
          aria-label={`Delete ${value.name}`}
          title="Delete file"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
