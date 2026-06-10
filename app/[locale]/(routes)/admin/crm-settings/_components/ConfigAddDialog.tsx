"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { createConfigValue, type CrmConfigType } from "../_actions/crm-settings";
import { toast } from "sonner";
import { useAutoSaveForm } from "@/hooks/use-auto-save-form";

interface Props {
  configType: CrmConfigType;
  label: string;
}

export function ConfigAddDialog({ configType, label }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [countInRevenue, setCountInRevenue] = useState(false);
  const [loading, setLoading] = useState(false);
  const { clearDraft } = useAutoSaveForm({
    key: `crm-config-${configType}-add-draft`,
    data: { name, countInRevenue },
    setData: (value) => {
      const next = typeof value === "function" ? value({ name, countInRevenue }) : value;
      setName(next.name ?? "");
      setCountInRevenue(next.countInRevenue ?? false);
    },
    enabled: open,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await createConfigValue(configType, name, countInRevenue);
      clearDraft();
      toast.success(`${label} added`);
      setName("");
      setCountInRevenue(false);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to add");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Add {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {label}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          </div>
          {configType === "salesStage" && (
            <div className="flex items-center space-x-2 rounded-md border p-3">
              <Checkbox 
                id="revenue" 
                checked={countInRevenue} 
                onCheckedChange={(val) => setCountInRevenue(!!val)} 
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="revenue"
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
            {loading ? "Adding…" : "Add"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
