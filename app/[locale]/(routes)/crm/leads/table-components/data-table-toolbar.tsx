"use client";

import { Cross2Icon } from "@radix-ui/react-icons";
import { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTableViewOptions } from "./data-table-view-options";

import { statuses } from "../table-data/data";
import { DataTableFacetedFilter } from "./data-table-faceted-filter";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  productOptions?: {
    label: string;
    value: string;
  }[];
}

export function DataTableToolbar<TData>({
  table,
  productOptions = [],
}: DataTableToolbarProps<TData>) {
  const globalFilter = (table.getState().globalFilter as string) ?? "";
  const isFiltered =
    table.getState().columnFilters.length > 0 || Boolean(globalFilter);

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 items-center space-x-2">
        <Input
          placeholder="Search leads by name, email, phone, company..."
          value={globalFilter}
          onChange={(event) => table.setGlobalFilter(event.target.value)}
          className="h-8 w-[200px] lg:w-[320px]"
        />
        {table.getColumn("status") && (
          <DataTableFacetedFilter
            column={table.getColumn("status")}
            title="Status"
            options={statuses}
          />
        )}
        {table.getColumn("products") && productOptions.length > 0 && (
          <DataTableFacetedFilter
            column={table.getColumn("products")}
            title="Products"
            options={productOptions}
          />
        )}
        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.resetColumnFilters();
              table.setGlobalFilter("");
            }}
            className="h-8 px-2 lg:px-3"
          >
            Reset
            <Cross2Icon className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
