"use client";

import { useCallback } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useAutoSaveForm } from "@/hooks/use-auto-save-form";

type AutoSaveReactHookFormOptions<T extends FieldValues> = {
  key: string;
  form: UseFormReturn<T>;
  enabled?: boolean;
};

export function useAutoSaveReactHookForm<T extends FieldValues>({
  key,
  form,
  enabled = true,
}: AutoSaveReactHookFormOptions<T>) {
  const values = form.watch();
  const restoreValues = useCallback(
    (value: T | ((previous: T) => T)) => {
      const nextValues =
        typeof value === "function" ? value(form.getValues()) : value;

      form.reset(nextValues, {
        keepDefaultValues: true,
      });
    },
    [form],
  );

  return useAutoSaveForm({
    key,
    data: values,
    setData: restoreValues,
    enabled,
  });
}

export default useAutoSaveReactHookForm;
