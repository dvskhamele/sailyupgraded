"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface EnrichLeadButtonProps {
  leadId: string;
}

export function EnrichLeadButton({ leadId }: EnrichLeadButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleEnrich() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/enrich`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to enrich lead");
        return;
      }

      if (data.organizationUpdated || data.organizationCreated) {
        toast.success("Lead and company enriched successfully.");
      } else if (data.leadUpdated || data.successCount > 0) {
        toast.success("Lead enriched successfully.");
      } else {
        toast.info("No enrichment data found for this lead.");
      }

      router.refresh();
    } catch (error) {
      console.error("Lead enrichment error:", error);
      toast.error("Failed to connect to enrichment service. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleEnrich}
      disabled={loading}
      data-testid="lead-enrich-btn"
      title="Enrich Lead with External Service"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          Enriching...
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4 mr-1" />
          Enrich
        </>
      )}
    </Button>
  );
}
