"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigList } from "./ConfigList";
import type { CrmConfigType, ConfigValue } from "../_actions/crm-settings";

type TabConfig = {
  key: CrmConfigType;
  label: string;
  values: ConfigValue[];
};

interface Props {
  tabs: TabConfig[];
}

import { updateSalesStagesForPipeline } from "../_actions/crm-settings";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function CrmSettingsTabs({ tabs }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleFixPipeline() {
    setLoading(true);
    try {
      await updateSalesStagesForPipeline();
      toast.success("Lost stages updated for pipeline reporting");
    } catch (err) {
      toast.error("Failed to update stages");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs defaultValue={tabs[0]?.key} className="w-full">
          <div className="flex items-center justify-between border-b pb-1 mb-4">
            <TabsList className="h-9">
              {tabs.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="text-xs">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleFixPipeline} 
              disabled={loading}
              className="h-8 gap-2 text-xs"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
              Fix Lost Stages Pipeline
            </Button>
          </div>
          {tabs.map((t) => (
            <TabsContent key={t.key} value={t.key} className="mt-0">
              <ConfigList configType={t.key} label={t.label} values={t.values} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
