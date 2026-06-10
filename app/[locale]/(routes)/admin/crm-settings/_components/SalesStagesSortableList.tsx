"use client";

import { useMemo, useState, useId, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useHydrated } from "@/hooks/use-hydrated";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  reorderSalesStages,
  type ConfigValue,
  type ReorderSalesStageInput,
} from "../_actions/crm-settings";

type SalesStagesSortableListProps = {
  stages: ConfigValue[];
  renderActions: (stage: ConfigValue) => ReactNode;
};

type SalesStageRowProps = {
  stage: ConfigValue;
  canReorder: boolean;
  actions: ReactNode;
};

function isRegularStage(stage: ConfigValue) {
  return (stage.position ?? 0) >= 0;
}

function SortableSalesStageRow({
  stage,
  canReorder,
  actions,
}: SalesStageRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: stage.id,
    disabled: !canReorder,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center justify-between gap-3 border-b bg-background px-4 py-3 transition-all last:border-b-0 hover:bg-muted/50",
        isDragging && "scale-[1.01] opacity-50 shadow-lg"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className={cn(
            "flex h-9 w-9 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            canReorder
              ? "cursor-grab hover:bg-muted hover:text-foreground active:cursor-grabbing"
              : "cursor-not-allowed opacity-40"
          )}
          aria-label={`Drag ${stage.name}`}
          disabled={!canReorder}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{stage.name}</span>
          {stage.isProtected && <Badge variant="outline">System</Badge>}
          {stage.countInRevenue && (
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              Revenue
            </Badge>
          )}
          {stage.countInPipeline && (
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
              Pipeline
            </Badge>
          )}
          {stage.usageCount > 0 && (
            <Badge variant="secondary">{stage.usageCount} in use</Badge>
          )}
        </div>
      </div>

      {actions}
    </div>
  );
}

export function SalesStagesSortableList({
  stages,
  renderActions,
}: SalesStagesSortableListProps) {
  const isHydrated = useHydrated();
  const id = useId();
  const router = useRouter();
  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const items = useMemo(() => {
    if (!orderedIds) return stages;

    const stagesById = new Map(stages.map((stage) => [stage.id, stage]));
    const orderedStages = orderedIds
      .map((stageId) => stagesById.get(stageId))
      .filter((stage): stage is ConfigValue => Boolean(stage));

    if (orderedStages.length !== stages.length) {
      return stages;
    }

    return orderedStages;
  }, [orderedIds, stages]);
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const activeStage = items[oldIndex];
    const targetStage = items[newIndex];
    if (!isRegularStage(activeStage) || !isRegularStage(targetStage)) return;

    const previousOrderedIds = orderedIds;
    const nextItems = arrayMove(items, oldIndex, newIndex);
    const regularIds = nextItems.filter(isRegularStage).map((stage) => stage.id);
    const nextItemsWithPositions = nextItems.map((stage) => {
      const position = regularIds.indexOf(stage.id);
      return position === -1 ? stage : { ...stage, position };
    });
    const payload: ReorderSalesStageInput[] = regularIds.map((id, position) => ({
      id,
      position,
    }));

    setOrderedIds(nextItemsWithPositions.map((stage) => stage.id));

    try {
      await reorderSalesStages(payload);
      toast.success("Sales stages reordered successfully");
      router.refresh();
    } catch (error) {
      setOrderedIds(previousOrderedIds);
      toast.error("Failed to save stage order");
      console.error("[REORDER_SALES_STAGES]", error);
    }
  }

  if (!isHydrated) return null;

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="overflow-hidden rounded-md border" role="list">
          {items.map((stage) => (
            <SortableSalesStageRow
              key={stage.id}
              stage={stage}
              canReorder={isRegularStage(stage)}
              actions={renderActions(stage)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
