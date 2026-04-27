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
import {
  ADD_CATEGORY_VALUE,
  ALL_CATEGORIES_VALUE,
  normalizeCategoryName,
} from "@/lib/opportunity-categories";

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  onAddCategory: (category: string) => void;
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onCategoryChange,
  onAddCategory,
}: CategoryFilterProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const handleValueChange = (value: string) => {
    if (value === ADD_CATEGORY_VALUE) {
      setIsAddDialogOpen(true);
      return;
    }

    onCategoryChange(value);
  };

  const handleAddCategory = () => {
    const normalizedCategory = normalizeCategoryName(newCategory);
    if (!normalizedCategory) {
      return;
    }

    onAddCategory(normalizedCategory);
    setNewCategory("");
    setIsAddDialogOpen(false);
  };

  return (
    <>
      <div className="w-full flex flex-col gap-3">
        <Label className="text-sm font-semibold text-slate-700">Products</Label>

        <div
          role="group"
          aria-label="Filter opportunities by product category"
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
              selectedCategory === ALL_CATEGORIES_VALUE &&
                "bg-sky-600 text-white border-sky-600 shadow-md hover:bg-sky-600",
            )}
          >
            All Products
          </Button>

          {/* CATEGORY BUTTONS */}
          {categories.map((category) => {
            const isSelected = selectedCategory === category;

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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleValueChange(ADD_CATEGORY_VALUE)}
            className="rounded-full px-4 py-1.5 text-sm border-2 border-dashed border-sky-400 bg-sky-50 text-sky-700 transition-all duration-200 hover:bg-sky-100 hover:scale-105"
          >
            + Add Products
          </Button>
        </div>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>
              Create a custom opportunity category and apply it immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-opportunity-category">Category name</Label>
              <Input
                id="new-opportunity-category"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                placeholder="Enter a category"
                maxLength={120}
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
            >
              Add category
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
