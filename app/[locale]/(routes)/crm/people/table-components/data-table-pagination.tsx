import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
} from "@radix-ui/react-icons";
import { useEffect, useState } from "react";
import { Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  total: number | null;
  recordsLoaded: number;
}

export function DataTablePagination<TData>({
  table,
  total,
  recordsLoaded,
}: DataTablePaginationProps<TData>) {
  const pageSize = table.getState().pagination.pageSize;
  const [pageSizeInput, setPageSizeInput] = useState(String(pageSize));
  const [pageSizeError, setPageSizeError] = useState<string | null>(null);

  useEffect(() => {
    setPageSizeInput(String(pageSize));
  }, [pageSize]);

  const applyPageSize = () => {
    const trimmedValue = pageSizeInput.trim();
    if (!/^\d+$/.test(trimmedValue)) {
      setPageSizeError("Enter a positive whole number.");
      return;
    }

    const nextPageSize = Number(trimmedValue);
    if (!Number.isSafeInteger(nextPageSize) || nextPageSize < 1 || nextPageSize > 5000) {
      setPageSizeError("Enter a whole number from 1 to 5,000.");
      return;
    }

    setPageSizeError(null);
    if (nextPageSize !== pageSize) {
      // The controlled table pagination handler resets the server-side page to 1.
      table.setPageSize(nextPageSize);
    }
  };

  return (
    <div className="flex items-center justify-between px-2 py-4">
      <div className="flex-1 text-sm text-muted-foreground">
        {table.getSelectedRowModel().rows.length > 0 ? (
          <span>
            {table.getSelectedRowModel().rows.length} row(s) selected on this page
          </span>
        ) : (
          <span>{total === null ? `${recordsLoaded.toLocaleString()} records loaded` : `${Number(table.getRowCount()).toLocaleString()} total matching record(s)`}</span>
        )}
      </div>
      <div className="flex items-center space-x-6 lg:space-x-8">
        <form
          className="flex items-center space-x-2"
          onSubmit={(event) => {
            event.preventDefault();
            applyPageSize();
          }}
        >
          <label className="text-sm font-medium" htmlFor="people-rows-per-page">
            Rows per page
          </label>
          <Input
            id="people-rows-per-page"
            aria-describedby={pageSizeError ? "people-rows-per-page-error" : undefined}
            aria-invalid={Boolean(pageSizeError)}
            className="h-8 w-24"
            inputMode="numeric"
            min={1}
            max={5000}
            onChange={(event) => {
              setPageSizeInput(event.target.value);
              if (pageSizeError) setPageSizeError(null);
            }}
            pattern="[0-9]*"
            type="text"
            value={pageSizeInput}
          />
          <Button className="h-8" size="sm" type="submit">
            Apply
          </Button>
          {pageSizeError ? (
            <span className="text-xs text-destructive" id="people-rows-per-page-error" role="alert">
              {pageSizeError}
            </span>
          ) : null}
        </form>
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {total === null ? "unknown" : Math.max(table.getPageCount(), 1)}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to first page</span>
            <DoubleArrowLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={total === null || !table.getCanNextPage()}
          >
            <span className="sr-only">Go to last page</span>
            <DoubleArrowRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
