"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { ThumbsDown } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  type crm_Opportunities,
  type crm_Opportunities_Sales_Stages,
} from "@prisma/client";

import { DotsHorizontalIcon, PlusCircledIcon } from "@radix-ui/react-icons";
import { FaBraille } from "react-icons/fa";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardFooter, CardTitle } from "@/components/ui/card";

import { NewOpportunityForm } from "../../opportunities/components/NewOpportunityForm";
import { UpdateOpportunityForm } from "../../opportunities/components/UpdateOpportunityForm";
import { setInactiveOpportunity } from "@/actions/crm/opportunity/dashboard/set-inactive";
import { updateOpportunity } from "@/actions/crm/opportunities/update-opportunity";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useHydrated } from "@/hooks/use-hydrated";
import { CategoryFilter } from "./CategoryFilter";
import {
  ALL_CATEGORIES_VALUE,
  DEFAULT_OPPORTUNITY_CATEGORIES,
  extractOpportunityCategories,
  filterOpportunitiesByCategory,
  mergeCategoryLists,
} from "@/lib/opportunity-categories";

interface CRMKanbanProps {
  salesStages: crm_Opportunities_Sales_Stages[];
  opportunities: crm_Opportunities[];
  crmData: any;
}

type Column = crm_Opportunities_Sales_Stages & {
  opportunities: crm_Opportunities[];
};

const LOST_DROP_ID = "lost-column";

function getOpportunityAmount(opportunity: crm_Opportunities) {
  const amount = (opportunity as any).amount ?? opportunity.budget ?? 0;
  return Number(amount) || 0;
}

function StageStats({ opportunities }: { opportunities: crm_Opportunities[] }) {
  const totalCards = opportunities.length;
  const totalRevenue = opportunities.reduce(
    (sum, opportunity) => sum + getOpportunityAmount(opportunity),
    0,
  );

  return (
    <div className="flex items-center px-1 py-2 justify-between mb-2 bg-white border rounded shadow-sm">
   
      <div className="flex flex-col gap-1">
        <div
          className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded-full"
        >
         {totalRevenue.toLocaleString("en-IN")}
        </div>
      </div>
      <div className="h-6 w-px bg-gray-200 mx-3" />

      <div className="flex flex-col items-end gap-1">
        <div
          className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 rounded-full"
        >
          {totalCards}
        </div>
      </div>
    </div>
  );
}

function initColumns(
  opps: crm_Opportunities[],
  stages: crm_Opportunities_Sales_Stages[],
  selectedCategory: string,
): Column[] {
  const filteredOpportunities = filterOpportunitiesByCategory(
    opps,
    selectedCategory,
  );

  return stages.map((stage) => ({
    ...stage,
    opportunities: filteredOpportunities.filter(
      (o: any) => o.sales_stage === stage.id && o.status === "ACTIVE",
    ),
  }));
}

function getLostOpportunities(
  opps: crm_Opportunities[],
  selectedCategory: string,
) {
  return filterOpportunitiesByCategory(opps, selectedCategory).filter(
    (o: any) => o.status === "INACTIVE",
  );
}

function getOpportunityDisplayName(opportunity: crm_Opportunities) {
  return (
    (opportunity as any).clientName?.trim() ||
    (opportunity as any).assigned_to_user?.name ||
    ""
  );
}

// Draggable Opportunity Card
function OpportunityCard({
  opportunity,
  router,
  onThumbsDown,
  onOpenEdit,
  stage,
  salesStages,
}: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: opportunity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="my-2 w-full cursor-grab active:cursor-grabbing"
      onClick={() => onOpenEdit(opportunity)}
    >
      <CardTitle className="p-2 text-sm">
        <div className="flex justify-between p-2">
          <span className="font-bold">{opportunity.name}</span>
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <DotsHorizontalIcon
                  className="w-4 h-4 text-slate-600"
                  onClick={(event) => event.stopPropagation()}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[160px]">
                <DropdownMenuItem onClick={() => onOpenEdit(opportunity)}>
                  Update
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardTitle>
      <CardContent className="text-xs text-muted-foreground">
        <div className="flex flex-col space-y-1">
          <div className="overflow-hidden">
            <HoverCard>
              <HoverCardTrigger>
                {opportunity.description?.substring(0, 200)}
              </HoverCardTrigger>
              <HoverCardContent className="overflow-hidden">
                {opportunity.description}
              </HoverCardContent>
            </HoverCard>
          </div>
          <div className="space-x-1">
            <span>Amount:</span>
            <span>{opportunity.budget?.toString()}</span>
          </div>
          <div className="space-x-1">
            <span>Expected closing:</span>
            <span
              className={
                opportunity.close_date &&
                new Date(opportunity.close_date) < new Date()
                  ? "text-red-500"
                  : ""
              }
            >
              {format(
                opportunity.close_date
                  ? new Date(opportunity.close_date)
                  : new Date(),
                "dd/MM/yyyy",
              )}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="w-6 h-6">
            <AvatarImage
              src={
                opportunity.assigned_to_user?.avatar
                  ? opportunity.assigned_to_user.avatar
                  : `${process.env.NEXT_PUBLIC_APP_URL}/images/nouser.png`
              }
            />
          </Avatar>
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {getOpportunityDisplayName(opportunity)}
          </span>
        </div>
        <div className="flex space-x-2">
          {stage.probability !==
            Math.max(
              ...salesStages.map((s: any) => Number(s.probability || 0)),
            ) && (
            <ThumbsDown
              className="w-4 h-4 text-red-500"
              onClick={(event) => {
                event.stopPropagation();
                onThumbsDown(opportunity.id);
              }}
            />
          )}
        </div>
      </CardFooter>
    </Card>
  );
}

function OpportunityCardStatic({
  opportunity,
  onOpenEdit,
  stage,
  salesStages,
}: any) {
  return (
    <Card
      className="my-2 w-full cursor-pointer"
      onClick={() => onOpenEdit(opportunity)}
    >
      <CardTitle className="p-2 text-sm">
        <div className="flex justify-between p-2">
          <span className="font-bold">{opportunity.name}</span>
          <div>
            {stage.probability !==
              Math.max(
                ...salesStages.map((s: any) => Number(s.probability || 0)),
              ) && <ThumbsDown className="w-4 h-4 text-red-500" />}
          </div>
        </div>
      </CardTitle>
      <CardContent className="text-xs text-muted-foreground">
        <div className="flex flex-col space-y-1">
          <div className="overflow-hidden">
            <HoverCard>
              <HoverCardTrigger>
                {opportunity.description?.substring(0, 200)}
              </HoverCardTrigger>
              <HoverCardContent className="overflow-hidden">
                {opportunity.description}
              </HoverCardContent>
            </HoverCard>
          </div>
          <div className="space-x-1">
            <span>Amount:</span>
            <span>{opportunity.budget?.toString()}</span>
          </div>
          <div className="space-x-1">
            <span>Expected closing:</span>
            <span
              className={
                opportunity.close_date &&
                new Date(opportunity.close_date) < new Date()
                  ? "text-red-500"
                  : ""
              }
            >
              {format(
                opportunity.close_date
                  ? new Date(opportunity.close_date)
                  : new Date(),
                "dd/MM/yyyy",
              )}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="w-6 h-6">
            <AvatarImage
              src={
                opportunity.assigned_to_user?.avatar
                  ? opportunity.assigned_to_user.avatar
                  : `${process.env.NEXT_PUBLIC_APP_URL}/images/nouser.png`
              }
            />
          </Avatar>
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {getOpportunityDisplayName(opportunity)}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}

// Droppable zone inside each column — same pattern as DroppableColumn in Kanban.tsx
function DroppableStage({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="min-h-[50px]">
      {children}
    </div>
  );
}

const CRMKanban = ({
  salesStages,
  opportunities: data,
  crmData,
}: CRMKanbanProps) => {
  const router = useRouter();

  const [selectedStage, setSelectedStage] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState(ALL_CATEGORIES_VALUE);
  const dynamicCategories = useMemo(
    () => mergeCategoryLists(extractOpportunityCategories(data)),
    [data],
  );
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const categoryList = useMemo(
    () =>
      mergeCategoryLists(
        DEFAULT_OPPORTUNITY_CATEGORIES,
        dynamicCategories,
        customCategories,
      ),
    [customCategories, dynamicCategories],
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] =
    useState<crm_Opportunities | null>(null);
  const isHydrated = useHydrated();

  const serverDataRef = useRef(data);
  const [columns, setColumns] = useState<Column[]>(() =>
    initColumns(data, salesStages, selectedCategory),
  );
  const [lostCards, setLostCards] = useState<crm_Opportunities[]>(() =>
    getLostOpportunities(data, selectedCategory),
  );
  const columnsRef = useRef<Column[]>(columns);

  const [activeOpportunity, setActiveOpportunity] =
    useState<crm_Opportunities | null>(null);
  const origStageIdRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    console.log("[CRMKanban] opportunities prop:", {
      total: data?.length ?? 0,
      salesStages: salesStages?.length ?? 0,
      sample: data?.slice?.(0, 3),
    });
  }, [data, salesStages]);

  const {
    accounts,
    contacts,
    saleTypes,
    saleStages,
    campaigns,
    currencies,
    lostStage,
  } = crmData;

  const openEditOpportunity = (opportunity: crm_Opportunities) => {
    setEditingOpportunity(opportunity);
    setIsEditOpen(true);
  };

  const handleAddCategory = (category: string) => {
    setCustomCategories((currentCategories) =>
      mergeCategoryLists(currentCategories, [category]),
    );
    setSelectedCategory(category);
  };

  // Sync from server (e.g. after onThumbsDown router.refresh()) — only when not dragging
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  useEffect(() => {
    if (serverDataRef.current !== data && !isDraggingRef.current) {
      serverDataRef.current = data;
      setColumns(initColumns(data, salesStages, selectedCategory));
      setLostCards(getLostOpportunities(data, selectedCategory));
    }
  }, [data, salesStages, selectedCategory]);

  useEffect(() => {
    if (!isDraggingRef.current) {
      const nextColumns = initColumns(data, salesStages, selectedCategory);
      columnsRef.current = nextColumns;
      setColumns(nextColumns);
      setLostCards(getLostOpportunities(data, selectedCategory));
    }
  }, [data, salesStages, selectedCategory]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    isDraggingRef.current = true;
    const { active } = event;
    const activeId = active.id as string;
    for (const col of columnsRef.current) {
      const opp = col.opportunities.find((o) => o.id === activeId);
      if (opp) {
        setActiveOpportunity(opp);
        origStageIdRef.current = col.id;
        break;
      }
    }

    if (!origStageIdRef.current) {
      const lostOpp = lostCards.find((o) => o.id === activeId);
      if (lostOpp) {
        setActiveOpportunity(lostOpp);
        origStageIdRef.current = LOST_DROP_ID;
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    if (activeId === overId) return;
    if (overId === LOST_DROP_ID) return;

    const current = columnsRef.current;

    // Find source column and opportunity index
    let fromColIdx = -1,
      fromOppIdx = -1;
    for (let i = 0; i < current.length; i++) {
      const idx = current[i].opportunities.findIndex((o) => o.id === activeId);
      if (idx !== -1) {
        fromColIdx = i;
        fromOppIdx = idx;
        break;
      }
    }

    const fromLostIdx = lostCards.findIndex((o) => o.id === activeId);
    const fromLost = fromColIdx === -1 && fromLostIdx !== -1;
    if (fromColIdx === -1 && !fromLost) return;

    // Determine destination — overId is either a stage ID or an opportunity ID
    let toColIdx = current.findIndex((c) => c.id === overId);
    let toOppIdx = 0;
    const isOverColumn = toColIdx !== -1;

    if (!isOverColumn) {
      for (let i = 0; i < current.length; i++) {
        const idx = current[i].opportunities.findIndex((o) => o.id === overId);
        if (idx !== -1) {
          toColIdx = i;
          toOppIdx = idx;
          break;
        }
      }
    } else {
      toOppIdx = current[toColIdx].opportunities.length;
    }

    if (toColIdx === -1) return;
    if (fromColIdx === toColIdx) return;

    const newColumns = current.map((c) => ({
      ...c,
      opportunities: [...c.opportunities],
    }));
    let movedOpp: crm_Opportunities;
    if (fromLost) {
      movedOpp = {
        ...lostCards[fromLostIdx],
        status: "ACTIVE",
        sales_stage: newColumns[toColIdx].id,
      } as crm_Opportunities;
      const nextLost = [...lostCards];
      nextLost.splice(fromLostIdx, 1);
      setLostCards(nextLost);
    } else {
      [movedOpp] = newColumns[fromColIdx].opportunities.splice(fromOppIdx, 1);
      (movedOpp as any).sales_stage = newColumns[toColIdx].id;
      (movedOpp as any).status = "ACTIVE";
    }
    newColumns[toColIdx].opportunities.splice(toOppIdx, 0, movedOpp);
    columnsRef.current = newColumns;
    setColumns(newColumns);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    isDraggingRef.current = false;
    const { active, over } = event;
    setActiveOpportunity(null);

    const activeId = active.id as string;
    const overId = over?.id as string | undefined;
    const current = columnsRef.current;

    if (overId === LOST_DROP_ID) {
      try {
        await setInactiveOpportunity(activeId);
        toast.success("Opportunity has been set to inactive");
      } catch (error) {
        console.log(error);
        toast.error("Something went wrong");
      } finally {
        router.refresh();
      }
      return;
    }

    // Find where the opportunity ended up after handleDragOver moves
    let curColIdx = -1;
    for (let i = 0; i < current.length; i++) {
      if (current[i].opportunities.find((o) => o.id === activeId)) {
        curColIdx = i;
        break;
      }
    }
    if (curColIdx === -1) return;

    const curStageId = current[curColIdx].id;
    const wasCrossStageMove =
      origStageIdRef.current !== null && origStageIdRef.current !== curStageId;

    if (!wasCrossStageMove) return;

    try {
      const result = await updateOpportunity({
        id: activeId,
        sales_stage: curStageId,
      });
      if (result?.error) {
        toast.error(result.error);
        columnsRef.current = initColumns(data, salesStages, selectedCategory);
        setColumns(initColumns(data, salesStages, selectedCategory));
        setLostCards(getLostOpportunities(data, selectedCategory));
      } else {
        toast.success("Opportunity stage changed");
      }
    } catch (error) {
      console.log(error);
      toast.error(
        error instanceof Error ? error.message : "Something went wrong",
      );
      columnsRef.current = initColumns(data, salesStages, selectedCategory);
      setColumns(initColumns(data, salesStages, selectedCategory));
      setLostCards(getLostOpportunities(data, selectedCategory));
    }
  };

  const onThumbsDown = async (opportunityId: string) => {
    try {
      await setInactiveOpportunity(opportunityId);
      toast.success("Opportunity has been set to inactive");
    } catch (error) {
      console.log(error);
    } finally {
      router.refresh();
    }
  };

  // Lost opportunities come from server data (updated via router.refresh on thumbsDown)
  const lostOpportunities = lostCards;

  return (
    <>
      <div className="mb-4">
        <CategoryFilter
          categories={categoryList}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          onAddCategory={handleAddCategory}
        />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={() => setIsDialogOpen(false)}>
        <DialogContent className="min-w-[1000px] py-10 overflow-auto">
          <DialogTitle className="sr-only">Create opportunity</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new opportunity in the selected sales stage.
          </DialogDescription>
          <NewOpportunityForm
            accounts={accounts}
            contacts={contacts}
            salesType={saleTypes}
            saleStages={saleStages}
            campaigns={campaigns}
            currencies={(currencies ?? []).map((c: any) => ({
              code: c.code,
              name: c.name,
              symbol: c.symbol,
            }))}
            categoryOptions={categoryList}
            selectedCategory={
              selectedCategory === ALL_CATEGORIES_VALUE
                ? undefined
                : selectedCategory
            }
            selectedStage={selectedStage}
            onDialogClose={() => setIsDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
        <SheetContent className="w-full md:max-w-[771px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Update Opportunity
              {editingOpportunity?.name ? ` - ${editingOpportunity.name}` : ""}
            </SheetTitle>
            <SheetDescription>Update opportunity details</SheetDescription>
          </SheetHeader>
          {editingOpportunity ? (
            <div className="mt-6 space-y-4">
              <UpdateOpportunityForm
                initialData={editingOpportunity}
                setOpen={setIsEditOpen}
                saleTypes={saleTypes}
                saleStages={saleStages}
                campaigns={campaigns}
                currencies={(currencies ?? []).map((c: any) => ({
                  code: c.code,
                  name: c.name,
                  symbol: c.symbol,
                }))}
                categoryOptions={categoryList}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {!isHydrated ? (
        <div className="flex w-full h-full overflow-x-auto h-[500px] gap-4 px-2 pb-2">
          {columns.map((col) => (
            <Card
              key={col.id}
              className="flex flex-col w-full min-w-[300px] max-w-[320px] bg-background border rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
            >
              {/* Header */}
              <CardTitle className="flex items-center justify-between px-4 py-3 border-b">
                <span className="text-sm font-semibold text-foreground">
                  {col.name}
                </span>

                <PlusCircledIcon
                  className="w-5 h-5 cursor-pointer text-muted-foreground hover:text-primary transition"
                  onClick={() => {
                    setSelectedStage(col.id);
                    setIsDialogOpen(true);
                  }}
                />
              </CardTitle>

              {/* Content */}
              <CardContent className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
                <StageStats opportunities={col.opportunities} />
                <div className="min-h-[50px] space-y-2">
                  {col.opportunities.map((opportunity) => (
                    <OpportunityCardStatic
                      key={opportunity.id}
                      opportunity={opportunity}
                      onOpenEdit={openEditOpportunity}
                      stage={col}
                      salesStages={salesStages}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Lost Column */}
          <Card className="flex flex-col w-full min-w-[300px] max-w-[320px] bg-background border rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
            <CardTitle className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-semibold text-red-500">
                {lostStage?.name ?? "Lost"}
              </span>
            </CardTitle>

            <CardContent className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
              <StageStats opportunities={lostOpportunities} />
              <div className="min-h-[50px] space-y-2">
                {lostOpportunities.map((opportunity: any) => (
                  <OpportunityCardStatic
                    key={opportunity.id}
                    opportunity={opportunity}
                    onOpenEdit={openEditOpportunity}
                    stage={{ probability: null }}
                    salesStages={salesStages}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <DndContext
          id="crm-dashboard-kanban"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex w-full h-full overflow-x-auto">
            {columns.map((col) => (
              <Card
                key={col.id}
                className="mx-1 w-full min-w-[300px] overflow-hidden pb-10"
              >
                <CardTitle className="flex gap-2 p-3 justify-between">
                  <span className="text-sm  font-bold">{col.name}</span>
                  <div className="flex">
                    <FaBraille className="mr-[10px] w-5 h-5 cursor-pointer" />
                    <PlusCircledIcon
                      className="w-5 h-5 cursor-pointer"
                      onClick={() => {
                        setSelectedStage(col.id);
                        setIsDialogOpen(true);
                      }}
                    />{" "}
                  </div>
                </CardTitle>
                <CardContent className="w-full h-full overflow-y-auto">
                  <StageStats opportunities={col.opportunities} />
                  <SortableContext
                    items={col.opportunities.map((o) => o.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <DroppableStage id={col.id}>
                      {col.opportunities.map((opportunity) => (
                        <OpportunityCard
                          key={opportunity.id}
                          opportunity={opportunity}
                          router={router}
                          onThumbsDown={onThumbsDown}
                          onOpenEdit={openEditOpportunity}
                          stage={col}
                          salesStages={salesStages}
                        />
                      ))}
                    </DroppableStage>
                  </SortableContext>
                </CardContent>
              </Card>
            ))}

            {/* Lost Opportunities Column */}
            <Card className="mx-1 w-full min-w-[300px] overflow-hidden pb-10">
              <CardTitle className="flex gap-2 p-3 justify-between">
                <span className="text-sm font-bold">
                  {lostStage?.name ?? "Lost"}
                </span>
              </CardTitle>
              <CardContent className="w-full h-full overflow-y-scroll space-y-2">
                <StageStats opportunities={lostOpportunities} />
                <DroppableStage id={LOST_DROP_ID}>
                  <SortableContext
                    items={lostOpportunities.map((o) => o.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {lostOpportunities.map((opportunity: any) => (
                      <OpportunityCard
                        key={opportunity.id}
                        opportunity={opportunity}
                        router={router}
                        onThumbsDown={onThumbsDown}
                        onOpenEdit={openEditOpportunity}
                        stage={{ probability: null }}
                        salesStages={salesStages}
                      />
                    ))}
                  </SortableContext>
                </DroppableStage>
              </CardContent>
            </Card>
          </div>

          <DragOverlay>
            {activeOpportunity ? (
              <Card className="my-2 w-[280px] opacity-80 bg-white shadow-lg">
                <CardTitle className="p-2 text-sm">
                  <div className="flex justify-between p-2">
                    <span className="font-bold">{activeOpportunity.name}</span>
                  </div>
                </CardTitle>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </>
  );
};

export default CRMKanban;
