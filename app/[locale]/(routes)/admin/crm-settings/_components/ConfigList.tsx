      "use client";

      import { useMemo, useState } from "react";
      import {
        DndContext,
        closestCenter,
        PointerSensor,
        useSensor,
        useSensors,
      } from "@dnd-kit/core";

      import {
        SortableContext,
        useSortable,
        verticalListSortingStrategy,
        arrayMove,
      } from "@dnd-kit/sortable";

      import { CSS } from "@dnd-kit/utilities";

      import { Button } from "@/components/ui/button";
      import { Badge } from "@/components/ui/badge";
      import { Pencil, Trash2, GripVertical } from "lucide-react";

      import { ConfigEditDialog } from "./ConfigEditDialog";
      import { ConfigDeleteDialog } from "./ConfigDeleteDialog";
      import { ConfigAddDialog } from "./ConfigAddDialog";
      import { useRouter } from "next/navigation";
      import { CrmConfigType, ConfigValue } from "../_actions/crm-settings";

      interface SortableItemProps {
        item: ConfigValue;
        index: number;
        total: number;
        onEdit: (item: ConfigValue) => void;
        onDelete: (item: ConfigValue) => void;
      }

      function SortableItem({
        item,
        index,
        total,
        onEdit,
        onDelete,
      }: SortableItemProps) {
        const isDragDisabled = index === 0 || index === total - 1 || item.isProtected;

        const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
          useSortable({
            id: item.id,
            disabled: isDragDisabled,
          });

        const style = {
          transform: CSS.Transform.toString(transform),
          transition,
          zIndex: isDragging ? 50 : 0,
          position: "relative" as const,
        };

        return (
          <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center justify-between px-4 py-3 border-b bg-white 
            ${isDragging ? "shadow-md rounded-md border" : ""} 
            ${isDragDisabled ? "bg-muted/30" : ""}`}
          >
            <div className="flex items-center gap-3">
              {!isDragDisabled ? (
                <div {...attributes} {...listeners} className="cursor-grab hover:text-primary transition">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
              ) : (
                <div className="w-4" />
              )}
              
              <span className="text-sm font-medium">{item.name}</span>

              {item.isProtected && <Badge variant="outline">System</Badge>}
              {(index === 0 || index === total - 1) && !item.isProtected && <Badge variant="outline" className="opacity-60">Position Fixed</Badge>}

              {item.usageCount !== undefined && item.usageCount > 0 && (
                <Badge variant="secondary">{item.usageCount} in use</Badge>
              )}
            </div>

            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => onEdit(item)}>
                <Pencil className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                disabled={item.isProtected === true}
                onClick={() => onDelete(item)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        );
      }

      interface ConfigListProps {
        configType: CrmConfigType;
        label: string;
        values: ConfigValue[];
      }

      export function ConfigList({ configType, label, values }: ConfigListProps) {
        const [optimisticItemOrder, setOptimisticItemOrder] = useState<string[] | null>(
          null
        );
        const [editItem, setEditItem] = useState<ConfigValue | null>(null);
        const [deleteItem, setDeleteItem] = useState<ConfigValue | null>(null);
        const router = useRouter();
        const items = useMemo(() => {
          if (!optimisticItemOrder) {
            return values;
          }

          const itemsById = new Map(values.map((item) => [item.id, item]));
          const orderedItems = optimisticItemOrder
            .map((id) => itemsById.get(id))
            .filter((item): item is ConfigValue => Boolean(item));
          const missingItems = values.filter(
            (item) => !optimisticItemOrder.includes(item.id)
          );

          return [...orderedItems, ...missingItems];
        }, [optimisticItemOrder, values]);

        const sensors = useSensors(useSensor(PointerSensor));

        const handleDragEnd = async (event: any) => {
          const { active, over } = event;
          if (!over || active.id === over.id) return;

          const oldIndex = items.findIndex((i) => i.id === active.id);
          const newIndex = items.findIndex((i) => i.id === over.id);

          // ❌ Prevent moving first/last or moving TO first/last
          if (
            oldIndex === 0 ||
            oldIndex === items.length - 1 ||
            newIndex === 0 ||
            newIndex === items.length - 1
          ) {
            return;
          }

          const newItems = arrayMove(items, oldIndex, newIndex);
          setOptimisticItemOrder(newItems.map((item) => item.id));

          // ✅ save to DB - sending ONLY array as requested
          try {
            await fetch(`/api/crm/leads/reorder?configType=${configType}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: process.env.NEXT_PUBLIC_TOKEN || "",
              },
              body: JSON.stringify(newItems),
            });
            router.refresh();
          } catch (error) {
            console.error("Failed to save reorder:", error);
            setOptimisticItemOrder(null);
          }
        };

        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{items.length} values</p>
              <ConfigAddDialog configType={configType} label={label} />
            </div>

            <DndContext
              id={`dnd-context-${configType}`}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="rounded-md border overflow-hidden">
                  {items.map((item, index) => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      index={index}
                      total={items.length}
                      onEdit={setEditItem}
                      onDelete={setDeleteItem}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {editItem && (
              <ConfigEditDialog
                configType={configType}
                id={editItem.id}
                currentName={editItem.name}
                open={!!editItem}
                onOpenChange={(v) => !v && setEditItem(null)}
              />
            )}

            {deleteItem && (
              <ConfigDeleteDialog
                configType={configType}
                item={deleteItem}
                allValues={items}
                open={!!deleteItem}
                onOpenChange={(v) => !v && setDeleteItem(null)}
              />
            )}
          </div>
        );
      }
