"use client";

import { useState } from "react";

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
import { cn } from "@/lib/utils";
import { ALL_CATEGORIES_VALUE } from "@/lib/opportunity-categories";

interface CategoryFilterProps {
  categories: string[];
  selectedCategories: string[];
  onCategoryChange: (categories: string[]) => void;
  onAddCategory?: (category: string) => Promise<boolean | void> | boolean | void;
  allowCreate?: boolean;
}

export function CategoryFilter({
  categories,
  selectedCategories,
  onCategoryChange,
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
        <Label className="text-sm font-semibold text-slate-700">Products</Label>

        <div
          role="group"
          aria-label="Filter opportunities by product"
          className="flex flex-wrap gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200"
        >
          {/* ALL BUTTON */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleValueChange(ALL_CATEGORIES_VALUE)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition-all duration-200 border shadow-sm hover:shadow-md",
              "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
              selectedCategories.length === 0 &&
                "bg-sky-600 text-white border-sky-600 shadow-md hover:bg-sky-600",
            )}
          >
            All Products
          </Button>

          {/* CATEGORY BUTTONS */}
          {categories.map((category) => {
            const isSelected = selectedCategories.includes(category);

            return (
              <Button
                key={category}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleValueChange(category)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm transition-all duration-200 border shadow-sm hover:shadow-md",
                  "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                  isSelected &&
                    "bg-sky-600 text-white border-sky-600 shadow-md hover:bg-sky-600 scale-105",
                )}
              >
                {category}
              </Button>
            );
          })}

          {/* ADD BUTTON */}
          {allowCreate ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleValueChange("__add_category__")}
              className="rounded-full px-4 py-1.5 text-sm border-2 border-dashed border-sky-400 bg-sky-50 text-sky-700 transition-all duration-200 hover:bg-sky-100 hover:scale-105"
            >
              + Add Products
            </Button>
          ) : null}
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
