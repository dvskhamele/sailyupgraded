"use client";

import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ViewDetailsButtonProps {
  entityType: string;
  entityId?: string | number;
  detailRoute: string;
}

export const ViewDetailsButton = ({
  entityType,
  entityId,
  detailRoute,
}: ViewDetailsButtonProps) => {
  const router = useRouter();

  if (!entityId) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              router.push(detailRoute);
            }}
          >
            <Eye className="h-4 w-4" />
            <span className="sr-only">View Details</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>View Details</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
