"use client";

import { useEffect, useMemo, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type {
  CustomFieldFileValue,
  CustomFieldDefinition,
  CustomFieldEntity,
  NormalizedCustomFieldDefinition,
} from "@/lib/custom-fields";
import { filterCustomFieldsForEntity } from "@/lib/custom-fields";
import { validateCustomFieldFile } from "@/lib/storage-validation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function isFileMetadata(value: unknown): value is CustomFieldFileValue {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as CustomFieldFileValue).url === "string" &&
    typeof (value as CustomFieldFileValue).name === "string" &&
    typeof (value as CustomFieldFileValue).size === "number" &&
    typeof (value as CustomFieldFileValue).type === "string"
  );
}

type CustomFieldsSectionProps = {
  entityType: CustomFieldEntity;
  form: UseFormReturn<any>;
  disabled?: boolean;
  contactRole?: string | null;
};

export function CustomFieldsSection({
  entityType,
  form,
  disabled = false,
  contactRole,
}: CustomFieldsSectionProps) {
  const [allFields, setAllFields] = useState<CustomFieldDefinition[]>([]);
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const fields = useMemo(
    () => filterCustomFieldsForEntity(allFields, entityType, contactRole),
    [allFields, contactRole, entityType],
  );

  useEffect(() => {
    let isMounted = true;

    const loadCustomFields = async () => {
      try {
        const response = await fetch("/api/custom-fields");
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as CustomFieldDefinition[];
        if (!isMounted) {
          return;
        }

        setAllFields(payload);
      } catch (error) {
        console.error("[CUSTOM_FIELDS_SECTION]", error);
      }
    };

    void loadCustomFields();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const visibleFieldIds = new Set(fields.map((field) => field.id));
    const currentValues = form.getValues("custom_fields_data");

    if (!currentValues || typeof currentValues !== "object" || Array.isArray(currentValues)) {
      return;
    }

    const nextValues = Object.fromEntries(
      Object.entries(currentValues).filter(([fieldId]) => visibleFieldIds.has(fieldId)),
    );

    if (Object.keys(nextValues).length !== Object.keys(currentValues).length) {
      form.setValue("custom_fields_data", nextValues, {
        shouldDirty: true,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [fields, form]);

  if (fields.length === 0) {
    return null;
  }

  const uploadCustomFieldFile = async (
    customField: NormalizedCustomFieldDefinition,
    file: File,
    onChange: (value: CustomFieldFileValue | undefined) => void,
  ) => {
    const validationError = validateCustomFieldFile(file);
    if (validationError) {
      setFileErrors((current) => ({
        ...current,
        [customField.id]: validationError,
      }));
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploadingFieldId(customField.id);
    setFileErrors((current) => {
      const { [customField.id]: _removed, ...next } = current;
      return next;
    });

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to upload file");
      }

      onChange(payload as CustomFieldFileValue);
    } catch (error) {
      setFileErrors((current) => ({
        ...current,
        [customField.id]:
          error instanceof Error ? error.message : "Failed to upload file",
      }));
      onChange(undefined);
    } finally {
      setUploadingFieldId(null);
    }
  };

  const deleteCustomFieldFile = async (
    customField: NormalizedCustomFieldDefinition,
    value: CustomFieldFileValue,
    onChange: (value: undefined) => void,
  ) => {
    setUploadingFieldId(customField.id);
    setFileErrors((current) => {
      const { [customField.id]: _removed, ...next } = current;
      return next;
    });

    try {
      const response = await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to delete file");
      }

      onChange(undefined);
    } catch (error) {
      setFileErrors((current) => ({
        ...current,
        [customField.id]:
          error instanceof Error ? error.message : "Failed to delete file",
      }));
    } finally {
      setUploadingFieldId(null);
    }
  };

  return (
    <div className="">
      {/* <div>
        <h3 className="text-base font-semibold">Custom Fields</h3>
        <p className="text-sm text-muted-foreground">
          Admin-defined fields for this form.
        </p>
      </div> */}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map((customField) => (
          <FormField
            key={customField.id}
            control={form.control}
            name={`custom_fields_data.${customField.id}`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{customField.name}</FormLabel>
                {customField.type === "select" ? (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                    disabled={disabled}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${customField.name}`} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Array.isArray(customField.options)
                        ? customField.options
                        : []
                      ).map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : customField.type === "file" ? (
                  <FormControl>
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.docx"
                        disabled={disabled || uploadingFieldId === customField.id}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          if (file) {
                            void uploadCustomFieldFile(
                              customField,
                              file,
                              field.onChange,
                            );
                          }
                        }}
                      />
                      {isFileMetadata(field.value) ? (
                        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                          <a
                            href={field.value.url}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 truncate text-blue-600 hover:underline"
                          >
                            {field.value.name}
                          </a>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={disabled || uploadingFieldId === customField.id}
                            onClick={() =>
                              void deleteCustomFieldFile(
                                customField,
                                field.value,
                                field.onChange,
                              )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ) : null}
                      {uploadingFieldId === customField.id ? (
                        <p className="text-sm text-muted-foreground">
                          Uploading...
                        </p>
                      ) : null}
                      {fileErrors[customField.id] ? (
                        <p className="text-sm font-medium text-destructive">
                          {fileErrors[customField.id]}
                        </p>
                      ) : null}
                    </div>
                  </FormControl>
                ) : (
                  <FormControl>
                    <Input
                      type={customField.type === "number" ? "number" : customField.type === "date" ? "date" : "text"}
                      disabled={disabled}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
      </div>
    </div>
  );
}
