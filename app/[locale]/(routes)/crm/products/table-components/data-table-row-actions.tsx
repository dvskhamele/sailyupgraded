"use client";

import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { Row } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { productsSchema } from "../table-data/schema";
import { useRouter } from "next/navigation";
import AlertModal from "@/components/modals/alert-modal";
import { useState } from "react";
import { toast } from "sonner";

import { deleteProduct } from "@/actions/crm/products/delete-product";
import { stopRowNavigation } from "../../components/table-row-navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import UpdateProductForm from "../_forms/update-product";
import { ViewDetailsButton } from "@/components/crm/common/ViewDetailsButton";

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const router = useRouter();
  const product = productsSchema.parse(row.original);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);

  const onDelete = async () => {
    setLoading(true);
    try {
      await deleteProduct(product.id);
      toast.success("Product has been deleted");
    } catch (error) {
      toast.error(
        "Something went wrong while deleting product. Please try again."
      );
    } finally {
      setLoading(false);
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <>
      <AlertModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
        loading={loading}
      />

      <Sheet open={updateOpen} onOpenChange={setUpdateOpen}>
        <SheetContent
          className="w-full md:max-w-[771px] overflow-y-auto"
          onClick={stopRowNavigation}
          onKeyDown={stopRowNavigation}
        >
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Update Product - {product.name}</SheetTitle>
              <div className="flex items-center gap-1 mr-8">
                <ViewDetailsButton
                  entityType="product"
                  entityId={product.id}
                  detailRoute={`/crm/products/${product.id}`}
                />
              </div>
            </div>
            <SheetDescription>Update product details</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {/* 
              Note: UpdateProductForm usually expects categories and currencies. 
              In this context we might need to pass them if available or the form needs to handle it.
            */}
            <UpdateProductForm
              product={product as any}
              categories={[]} // This might need actual data if available in props
              onOpen={updateOpen}
              setOpen={setUpdateOpen}
            />
          </div>
        </SheetContent>
      </Sheet>

      <div data-row-action onClick={stopRowNavigation} onKeyDown={stopRowNavigation}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
            onClick={stopRowNavigation}
          >
            <DotsHorizontalIcon className="h-4 w-4" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[160px]" onClick={stopRowNavigation}>
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              setUpdateOpen(true);
            }}
          >
            Update
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(event) => {
              event.stopPropagation();
              router.push(`/crm/products/${product.id}`);
            }}
          >
            View Details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}>
            Delete
            <DropdownMenuShortcut>⌘⌫</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </>
  );
}
