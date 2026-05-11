"use client";

import { useEffect, useState } from "react";
import {
  formatLocalDateTime,
  formatUtcDateTime,
  getBrowserTimeZone,
  toUtcIsoString,
} from "@/lib/campaigns/scheduling";

type Props = {
  value: Date | string | null;
  emptyLabel?: string;
  className?: string;
};

export function ClientDateTime({ value, emptyLabel = "-", className }: Props) {
  const [timeZone, setTimeZone] = useState<string | null>(null);

  useEffect(() => {
    setTimeZone(getBrowserTimeZone());
  }, []);

  if (!value) {
    return <span className={className}>{emptyLabel}</span>;
  }

  const isoValue = toUtcIsoString(value);
  const label = timeZone
    ? formatLocalDateTime(isoValue, timeZone)
    : `${formatUtcDateTime(isoValue)} UTC`;

  return (
    <time className={className} dateTime={isoValue} suppressHydrationWarning>
      {label}
    </time>
  );
}
