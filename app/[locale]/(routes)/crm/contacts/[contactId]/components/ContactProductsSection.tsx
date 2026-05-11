import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyDisplay } from "@/lib/currency-input";

type ContactProduct = {
  id: string;
  quantity: number;
  custom_price: unknown;
  currency: string;
  status: string;
  start_date: string | Date;
  end_date: string | Date | null;
  notes: string | null;
  account: { id: string; name: string } | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    type: string;
    unit_price: unknown;
    currency: string;
  } | null;
};

const statusClass: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-red-100 text-red-800",
  EXPIRED: "bg-gray-100 text-gray-800",
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "-";
  return new Date(value).toISOString().slice(0, 10);
}

export function ContactProductsSection({ products }: { products: ContactProduct[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Products</CardTitle>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No products are linked through this contact's client accounts.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((item) => {
                  const amount = item.custom_price ?? item.product?.unit_price;
                  const currency = item.currency || item.product?.currency || "USD";

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.product ? (
                          <Link
                            href={`/crm/products/${item.product.id}`}
                            className="font-medium hover:underline"
                          >
                            {item.product.name}
                          </Link>
                        ) : (
                          "Unknown product"
                        )}
                        {item.product?.sku && (
                          <p className="text-xs text-muted-foreground">{item.product.sku}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.account ? (
                          <Link href={`/crm/accounts/${item.account.id}`} className="hover:underline">
                            {item.account.name}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusClass[item.status] ?? ""} variant="outline">
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{formatCurrencyDisplay(amount, currency, "-")}</TableCell>
                      <TableCell>{formatDate(item.start_date)}</TableCell>
                      <TableCell>{formatDate(item.end_date)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
