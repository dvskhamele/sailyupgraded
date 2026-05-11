"use client";

import { Ref } from "react";
import { useFormStatus } from "react-dom";

import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { FormErrors } from "./form-errors";

interface FormCurrencyInputProps {
  id: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  errors?: Record<string, string[] | undefined>;
  className?: string;
  defaultValue?: string | number | null;
  onBlur?: () => void;
  ref?: Ref<HTMLInputElement>;
}

export const FormCurrencyInput = ({
  id,
  label,
  placeholder,
  required,
  disabled,
  errors,
  className,
  defaultValue = "",
  onBlur,
  ref,
}: FormCurrencyInputProps) => {
  const { pending } = useFormStatus();

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {label ? (
          <Label htmlFor={id} className="text-xs font-semibold text-neutral-700">
            {label}
          </Label>
        ) : null}
        <CurrencyInput
          onBlur={onBlur}
          defaultValue={defaultValue}
          ref={ref}
          required={required}
          name={id}
          id={id}
          placeholder={placeholder}
          disabled={pending || disabled}
          className={cn("text-sm px-2 py-1 h-7", className)}
          aria-describedby={`${id}-error`}
        />
      </div>
      <FormErrors id={id} errors={errors} />
    </div>
  );
};

FormCurrencyInput.displayName = "FormCurrencyInput";
