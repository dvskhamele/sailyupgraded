import React from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type RightSheetProps = {
  open?: boolean;
  setOpen: (open: boolean) => void;
  position?: "left" | "right" | "top" | "bottom";
  trigger?: string;
  title: string;
  description: string;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
};

const FormSheetNoTrigger = ({
  open,
  setOpen,
  position,
  title,
  description,
  children,
  headerActions,
}: RightSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side={position || "right"}
        className="max-w-3xl overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>{title}</SheetTitle>
            <div className="flex items-center gap-1 mr-8">
              {headerActions}
            </div>
          </div>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FormSheetNoTrigger;
