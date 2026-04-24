"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      <div className="flex w-full flex-col gap-2 sm:max-w-md">
        <Label htmlFor="crm-category-filter">Category</Label>
        <Select value={selectedCategory} onValueChange={handleValueChange}>
          <SelectTrigger id="crm-category-filter" className="w-full">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CATEGORIES_VALUE}>All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
            <SelectItem value={ADD_CATEGORY_VALUE}>+ Add Category</SelectItem>
          </SelectContent>
        </Select>
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
            <Button type="button" className="w-full" onClick={handleAddCategory}>
              Add category
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
