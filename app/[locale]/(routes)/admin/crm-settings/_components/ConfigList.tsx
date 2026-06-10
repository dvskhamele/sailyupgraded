"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { ConfigEditDialog } from "./ConfigEditDialog";
import { ConfigDeleteDialog } from "./ConfigDeleteDialog";
import { ConfigAddDialog } from "./ConfigAddDialog";
import { SalesStagesSortableList } from "./SalesStagesSortableList";
import type { CrmConfigType, ConfigValue } from "../_actions/crm-settings";

interface ConfigListProps {
  configType: CrmConfigType;
  label: string;
  values: ConfigValue[];
}

export function ConfigList({ configType, label, values }: ConfigListProps) {
  const [editItem, setEditItem] = useState<ConfigValue | null>(null);
  const [deleteItem, setDeleteItem] = useState<ConfigValue | null>(null);

  const renderActions = (item: ConfigValue) => (
    <div className="flex shrink-0 gap-1">
      <Button
        size="icon"
        variant="ghost"
        onClick={() => setEditItem(item)}
        aria-label={`Edit ${item.name}`}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        disabled={item.isProtected === true}
        onClick={() => setDeleteItem(item)}
        aria-label={`Delete ${item.name}`}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{values.length} values</p>
        <ConfigAddDialog configType={configType} label={label} />
      </div>

      {configType === "salesStage" ? (
        <SalesStagesSortableList stages={values} renderActions={renderActions} />
      ) : (
        <div className="overflow-hidden rounded-md border">
          {values.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="truncate text-sm font-medium">{item.name}</span>
                {item.isProtected && <Badge variant="outline">System</Badge>}
                {item.usageCount > 0 && (
                  <Badge variant="secondary">{item.usageCount} in use</Badge>
                )}
              </div>
              {renderActions(item)}
            </div>
          ))}
        </div>
      )}

      {editItem && (
        <ConfigEditDialog
          configType={configType}
          id={editItem.id}
          currentName={editItem.name}
          currentCountInRevenue={editItem.countInRevenue}
          currentCountInPipeline={editItem.countInPipeline}
          open={!!editItem}
          onOpenChange={(open) => !open && setEditItem(null)}
        />
      )}

      {deleteItem && (
        <ConfigDeleteDialog
          configType={configType}
          item={deleteItem}
          allValues={values}
          open={!!deleteItem}
          onOpenChange={(open) => !open && setDeleteItem(null)}
        />
      )}
    </div>
  );
}
