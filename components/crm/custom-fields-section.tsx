"use client";

import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type {
  CustomFieldDefinition,
  CustomFieldEntity,
  NormalizedCustomFieldDefinition,
} from "@/lib/custom-fields";
import { filterCustomFieldsForEntity } from "@/lib/custom-fields";

import { Input } from "@/components/ui/input";
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
  const [fields, setFields] = useState<NormalizedCustomFieldDefinition[]>([]);

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

        setFields(filterCustomFieldsForEntity(payload, entityType, contactRole));
      } catch (error) {
        console.error("[CUSTOM_FIELDS_SECTION]", error);
      }
    };

    void loadCustomFields();

    return () => {
      isMounted = false;
    };
  }, [contactRole, entityType]);

  if (fields.length === 0) {
    return null;
  }

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
