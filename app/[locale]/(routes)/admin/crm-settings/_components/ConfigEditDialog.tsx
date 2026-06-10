"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { updateConfigValue, type CrmConfigType } from "../_actions/crm-settings";
import { toast } from "sonner";
import { useAutoSaveForm } from "@/hooks/use-auto-save-form";

interface Props {
  configType: CrmConfigType;
  id: string;
  currentName: string;
  currentCountInRevenue?: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ConfigEditDialog({ configType, id, currentName, currentCountInRevenue, open, onOpenChange }: Props) {
  const [name, setName] = useState(currentName);
  const [countInRevenue, setCountInRevenue] = useState(currentCountInRevenue ?? false);
  const [loading, setLoading] = useState(false);
  const { clearDraft } = useAutoSaveForm({
    key: `crm-config-${configType}-${id}-edit-draft`,
    data: { name, countInRevenue },
    setData: (value) => {
      const next = typeof value === "function" ? value({ name, countInRevenue }) : value;
      setName(next.name ?? currentName);
      setCountInRevenue(next.countInRevenue ?? (currentCountInRevenue ?? false));
    },
    enabled: open,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await updateConfigValue(configType, id, name, countInRevenue);
      clearDraft();
      toast.success("Updated");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Value</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          </div>
          {configType === "salesStage" && (
            <div className="flex items-center space-x-2 rounded-md border p-3">
              <Checkbox 
                id="edit-revenue" 
                checked={countInRevenue} 
                onCheckedChange={(val) => setCountInRevenue(!!val)} 
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="edit-revenue"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Include in Revenue
                </label>
                <p className="text-xs text-muted-foreground">
                  Include this stage in revenue reports and dashboards.
                </p>
              </div>
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saving…" : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
