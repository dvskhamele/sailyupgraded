"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SimilarRecordsDrawer } from "@/components/crm/similar-records-drawer";

type EntityType = "account" | "contact" | "lead" | "opportunity";

interface FindSimilarButtonProps {
  entityType: EntityType;
  recordId: string;
  locale: string;
}

export function FindSimilarButton({ entityType, recordId, locale }: FindSimilarButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Find Similar
      </Button>
      <SimilarRecordsDrawer
        entityType={entityType}
        recordId={recordId}
        locale={locale}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
