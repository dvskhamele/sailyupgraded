"use client";

import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { columns } from "../products/table-components/columns";
import { ProductsDataTable } from "../products/table-components/data-table";
import CreateProductForm from "../products/_forms/create-product";
import { ImportProductsDialog } from "../products/components/ImportProductsDialog";

import { HelpModal } from "@/components/ui/help-modal";

import type { crm_ProductCategories } from "@prisma/client";

interface ProductsViewProps {
  data: any[];
  categories: crm_ProductCategories[];
  currencies: { code: string; name: string; symbol: string }[];
}

const ProductsView = ({ data, categories, currencies }: ProductsViewProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between">
          <CardTitle className="flex items-center gap-2">
            <Link href="/crm/products" className="hover:underline">
              Product Catalog
            </Link>
            <HelpModal module="products" />
          </CardTitle>

          <div className="flex space-x-2">
            <ImportProductsDialog />
            <CreateProductForm
              categories={categories}
              currencies={currencies}
            />
          </div>
        </div>
        <Separator />
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          "No products found. Create your first product to get started."
        ) : (
          <ProductsDataTable data={data} columns={columns} />
        )}
      </CardContent>
    </Card>
  );
};

export default ProductsView;
