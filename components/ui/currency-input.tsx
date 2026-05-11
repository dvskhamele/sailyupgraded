"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatCurrencyInputValue,
  normalizeCurrencyInput,
} from "@/lib/currency-input";

type CurrencyInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  value?: string | number | null;
  defaultValue?: string | number | null;
  onChange?: (value: string) => void;
  currencySymbol?: string;
};

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      className,
      value,
      defaultValue,
      onChange,
      onFocus,
      onBlur,
      currencySymbol = "$",
      ...props
    },
    ref
  ) => {
    const isControlled = value !== undefined;
    const initialValue = isControlled ? value : defaultValue;
    const [focused, setFocused] = React.useState(false);
    const [internalValue, setInternalValue] = React.useState(() =>
      formatCurrencyInputValue(initialValue)
    );
    const displayValue = isControlled
      ? focused
        ? normalizeCurrencyInput(value)
        : formatCurrencyInputValue(value)
      : internalValue;

    React.useEffect(() => {
      if (!isControlled || focused) return;
      setInternalValue(formatCurrencyInputValue(value));
    }, [focused, isControlled, value]);

    const setNextValue = (nextValue: string) => {
      const normalized = normalizeCurrencyInput(nextValue);
      if (!isControlled) {
        setInternalValue(normalized);
      }
      onChange?.(normalized);
    };

    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {currencySymbol}
        </span>
        <Input
          {...props}
          ref={ref}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={displayValue}
          onChange={(event) => setNextValue(event.target.value)}
          onFocus={(event) => {
            setFocused(true);
            if (!isControlled) {
              setInternalValue(normalizeCurrencyInput(event.currentTarget.value));
            }
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            const formatted = formatCurrencyInputValue(event.currentTarget.value);
            if (!isControlled) {
              setInternalValue(formatted);
            }
            onBlur?.(event);
          }}
          className={cn("pl-7", className)}
        />
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
