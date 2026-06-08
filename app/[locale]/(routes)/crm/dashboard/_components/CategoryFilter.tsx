"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_CATEGORIES_VALUE } from "@/lib/opportunity-categories";
import {
  ALL_ASSIGNED_MEMBERS_VALUE,
  type OpportunityAssignedMemberOption,
} from "@/lib/opportunity-assigned-members";

interface CategoryFilterProps {
  categories: string[];
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
  assignedMembers: OpportunityAssignedMemberOption[];
  selectedAssignedMemberId: string;
  onAssignedMemberChange: (memberId: string) => void;
  onAddCategory?: (category: string) => Promise<boolean | void> | boolean | void;
  allowCreate?: boolean;
}

export function CategoryFilter({
  categories,
  selectedCategories,
  onCategoryChange,
  assignedMembers,
  selectedAssignedMemberId,
  onAssignedMemberChange,
  onAddCategory,
  allowCreate = true,
}: CategoryFilterProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleValueChange = (value: string) => {
    if (value === "__add_category__") {
      setIsAddDialogOpen(true);
      return;
    }

    if (value === ALL_CATEGORIES_VALUE) {
      onCategoryChange([]);
      return;
    }

    if (selectedCategories.includes(value)) {
      onCategoryChange(selectedCategories.filter((category) => category !== value));
      return;
    }

    onCategoryChange([...selectedCategories, value]);
  };

  const handleAddCategory = async () => {
    const normalizedCategory = newCategory.trim();
    if (!normalizedCategory || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      const wasAdded = await onAddCategory?.(normalizedCategory);
      if (wasAdded !== false) {
        setNewCategory("");
        setIsAddDialogOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="w-full flex flex-col gap-3">
        <div className="flex items-start gap-4">
          <div className="w-32 space-y-1">
            {/* <Label className="text-sm font-semibold text-slate-700">
              Assigned Member
            </Label> */}
            <Select
              value={selectedAssignedMemberId}
              onValueChange={onAssignedMemberChange}
            >
              <SelectTrigger className="h-9 border-slate-200 bg-white text-slate-700">
                <SelectValue placeholder="All Memberss" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_ASSIGNED_MEMBERS_VALUE}>
                  All Members
                </SelectItem>
                {assignedMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <div className="rounded-xl border border-slate-200 bg-slate-50">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  >
                    <span className="truncate">
                      {selectedCategories.length === 0
                        ? "All Products"
                        : `${selectedCategories.length} product${
                            selectedCategories.length > 1 ? "s" : ""
                          } selected`}
                    </span>

                    <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="start"
                  className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-80 overflow-y-auto"
                >
                  <DropdownMenuCheckboxItem
                    checked={selectedCategories.length === 0}
                    onCheckedChange={() =>
                      handleValueChange(ALL_CATEGORIES_VALUE)
                    }
                  >
                    All Products
                  </DropdownMenuCheckboxItem>

                  <DropdownMenuSeparator />

                  {categories.map((category) => (
                    <DropdownMenuCheckboxItem
                      key={category}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => handleValueChange(category)}
                    >
                      {category}
                    </DropdownMenuCheckboxItem>
                  ))}

                  {allowCreate && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleValueChange("__add_category__")}
                      >
                        + Add Products
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {selectedCategories.length > 0 && (
                <p className="mt-2 text-xs text-slate-600">
                  {selectedCategories.join(", ")}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={allowCreate && isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>
              Add a product chip and apply it immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-opportunity-category">Product name</Label>
              <Input
                id="new-opportunity-category"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                placeholder="Enter a product"
                maxLength={120}
                disabled={isSubmitting}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddCategory();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={handleAddCategory}
              disabled={isSubmitting || !newCategory.trim()}
            >
              {isSubmitting ? "Adding..." : "Add product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
