"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductOption {
  id: string;
  name: string;
}

interface ProductDropdownProps {
  products: ProductOption[];
  placeholder?: string;
}

export function ProductDropdown({
  products,
  placeholder = "Select product",
}: ProductDropdownProps) {
  const [selectedProduct, setSelectedProduct] = useState("");

  return (
    <Select
      value={selectedProduct}
      onValueChange={setSelectedProduct}
      disabled={products.length === 0}
    >
      <SelectTrigger className="h-9 w-[220px]">
        <SelectValue
          placeholder={products.length === 0 ? "No products" : placeholder}
        />
      </SelectTrigger>
      <SelectContent>
        {products.map((product) => (
          <SelectItem key={product.id} value={product.id}>
            {product.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
