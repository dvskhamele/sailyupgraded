import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function normalizeEmail(value: string) {
  return value.trim();
}

function normalizePhone(value: string) {
  return value.trim();
}

function getWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

type SharedProps = {
  value?: string | null;
  className?: string;
  fallback?: ReactNode;
  trailingIcon?: ReactNode;
};

export function EmailLink({
  value,
  className,
  fallback = "N/A",
  trailingIcon,
}: SharedProps) {
  if (!value?.trim()) {
    return <>{fallback}</>;
  }

  const email = normalizeEmail(value);

  return (
    <a
      href={`mailto:${email}`}
      className={cn(
        "inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary hover:underline",
        className
      )}
    >
      <span className="break-all">{email}</span>
      {trailingIcon}
    </a>
  );
}

export function WhatsAppLink({
  value,
  className,
  fallback = "N/A",
  trailingIcon,
}: SharedProps) {
  if (!value?.trim()) {
    return <>{fallback}</>;
  }

  const phone = normalizePhone(value);
  const whatsappNumber = getWhatsAppNumber(phone);

  if (!whatsappNumber) {
    return <span className={cn("text-sm text-muted-foreground", className)}>{phone}</span>;
  }

  return (
    <a
      href={`https://wa.me/${whatsappNumber}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary hover:underline",
        className
      )}
    >
      <span>{phone}</span>
      {trailingIcon}
    </a>
  );
}
