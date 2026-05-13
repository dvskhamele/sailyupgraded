"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmailLink, WhatsAppLink } from "@/components/ui/contact-link";

import { statuses } from "../table-data/data";
import { Lead } from "../table-data/schema";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";
import moment from "moment";
import { formatAddress } from "@/lib/crm-address";

type ConfigItem = { id: string; name: string };
type AccountItem = {
  id: string;
  name: string;
  accountProducts?: { product?: { id: string; name: string } | null }[];
};
type ProductItem = { id: string; name: string };

export const createColumns = (
  contactTypes: ConfigItem[],
  leadSources: ConfigItem[],
  leadStatuses: ConfigItem[],
  leadTypes: ConfigItem[],
  accounts: AccountItem[] = [],
  products: ProductItem[] = [],
): ColumnDef<Lead>[] => [


    {
    accessorKey: "firstName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),

    cell: ({ row }) => (
      <Link href={`/crm/leads/${row.original.id}`} data-testid="lead-row-name">
        <div>
          {[row.original.firstName, row.original.lastName].filter(Boolean).join(" ")}
        </div>
      </Link>
    ),
    enableSorting: false,
    enableHiding: true,
  },
   {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="E-mail" />
    ),

    cell: ({ row }) => (
      <EmailLink
        value={row.getValue("email") as string | null}
        className="w-[150px]"
      />
    ),
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "phone",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Phone" />
    ),

    cell: ({ row }) => (
      <WhatsAppLink
        value={row.getValue("phone") as string | null}
        className="w-[150px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "assigned_to_user",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Assigned to" />
    ),

    cell: ({ row }) => (
      <div className="w-[150px]">
        {
          //@ts-ignore
          //TODO: fix this
          row.getValue("assigned_to_user")?.name ?? "Unassigned"
        }
      </div>
    ),
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "company",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Company" />
    ),

    cell: ({ row }) => (
      <div className="">
        {
          //@ts-ignore
          //TODO: fix this
          row.getValue("company") ?? "Unassigned"
        }
      </div>
    ),
    enableSorting: false,
    enableHiding: true,
  },

 
  {
    id: "address",
    accessorFn: (row) => formatAddress(row as any),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Address" />
    ),
    cell: ({ row }) => <div className="w-[150px]">{formatAddress(row.original as any) || "N/A"}</div>,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.original.lead_status?.name || row.original.status || row.getValue("status");
      if (!status) return null;
      return (
        <div className="flex w-[100px] items-center">
          <Badge variant="outline">{status}</Badge>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      const status = row.original.lead_status?.name || row.original.status || row.getValue(id);
      return value.includes(status);
    },
  },
  {
    id: "products",
    accessorFn: (row) => {
      return ((row as any).assigned_accounts?.accountProducts ?? [])
        .map((item: any) => item.product?.id)
        .filter(Boolean);
    },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Products" />
    ),
    cell: ({ row }) => {
      const productNames = ((row.original as any).assigned_accounts?.accountProducts ?? [])
        .map((item: any) => item.product?.name)
        .filter(Boolean);
      return <div className="w-[180px]">{productNames.join(", ") || "N/A"}</div>;
    },
    filterFn: (row, _id, value) => {
      const selectedProductIds = value as string[];
      const rowProductIds = ((row.original as any).assigned_accounts?.accountProducts ?? [])
        .map((item: any) => item.product?.id)
        .filter(Boolean);
      return selectedProductIds.some((productId) => rowProductIds.includes(productId));
    },
    enableSorting: false,
    enableHiding: true,
  },
  {
    accessorKey: "contact_type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Contact type" />
    ),
    cell: ({ row }) => {
      const contactTypeName =
        row.original.contact_type?.name ??
        contactTypes.find((type) => type.id === row.original.contact_type_id)?.name;

      return <div className="w-[130px]">{contactTypeName ?? "N/A"}</div>;
    },
    filterFn: (row, _id, value) => {
      const contactTypeName =
        row.original.contact_type?.name ??
        contactTypes.find((type) => type.id === row.original.contact_type_id)?.name;

      return value.includes(contactTypeName);
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "lead_source",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Source" />
    ),
    cell: ({ row }) => {
      const source = row.original.lead_source?.name || "Unknown";
      return <div className="w-[100px]">{source}</div>;
    },
  },

    {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Expected close" />
    ),
    cell: ({ row }) => (
      <div className="w-[80px]">
        {moment(row.getValue("createdAt")).format("YY-MM-DD")}
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last update" />
    ),
    cell: ({ row }) => (
      <div className="w-[80px]">
        {moment(row.getValue("updatedAt")).format("YY-MM-DD")}
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },

  {
    id: "actions",
    cell: ({ row }) => (
      <DataTableRowActions
        row={row}
        accounts={accounts}
        contactTypes={contactTypes}
        leadSources={leadSources}
        leadStatuses={leadStatuses}
        leadTypes={leadTypes}
        products={products}
      />
    ),
  },
];
