"use client";

import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";

import { Checkbox } from "@/components/ui/checkbox";
import { EmailLink, WhatsAppLink } from "@/components/ui/contact-link";

import { Opportunity } from "../table-data/schema";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";
import moment from "moment";
import { formatAddress } from "@/lib/crm-address";
import { getReferenceId, normalizeContactRole } from "@/lib/contact-options";

type ConfigItem = { id: string; name: string };
type AccountItem = {
  id: string;
  name: string;
  accountProducts?: { product?: { id: string; name: string } | null }[];
};

export const createColumns = (
  contactTypes: ConfigItem[] = [],
  accounts: AccountItem[] = [],
  leadSources: ConfigItem[] = [],
  leadStatuses: ConfigItem[] = [],
  leadTypes: ConfigItem[] = [],
  products: ConfigItem[] = [],
  saleStages: ConfigItem[] = [],
): ColumnDef<Opportunity>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },





 
  {
    accessorKey: "first_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => <div className="">{row.getValue("first_name")}</div>,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "last_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sure name" />
    ),
    cell: ({ row }) => (
      <Link href={`/crm/contacts/${row.original.id}`} prefetch={false} data-testid="contact-row-name">
        <div className="">{row.getValue("last_name")}</div>
      </Link>
    ),
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "role",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({ row }) => (
      <div className="min-w-[110px]">
        {normalizeContactRole(row.getValue("role") as string | null | undefined)}
      </div>
    ),
    enableSorting: true,
    enableHiding: true,
  },
  {
    id: "referenceId",
    accessorFn: (row) => getReferenceId(row as any),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Reference ID" />
    ),
    cell: ({ row }) => (
      <div className="min-w-[120px]">{getReferenceId(row.original as any)}</div>
    ),
    enableSorting: true,
    enableHiding: true,
  },
   {
    accessorKey: "assigned_account",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Assigned company" />
    ),
    cell: ({ row }) => (
      <div className="min-w-[150px]">
        {(row.original as any).assigned_accounts?.name ?? "Unassigned"}
      </div>
    ),
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
        (row.original as any).contact_type?.name ??
        contactTypes.find((type) => type.id === (row.original as any).contact_type_id)?.name;

      return <div className="min-w-[150px]">{contactTypeName ?? "N/A"}</div>;
    },
    filterFn: (row, _id, value) => {
      const contactTypeName =
        (row.original as any).contact_type?.name ??
        contactTypes.find((type) => type.id === (row.original as any).contact_type_id)?.name;

      return value.includes(contactTypeName);
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="E-mail" />
    ),
    cell: ({ row }) => <EmailLink value={row.getValue("email") as string | null} />,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "mobile_phone",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Mobile" />
    ),
    cell: ({ row }) => (
      <WhatsAppLink value={row.getValue("mobile_phone") as string | null} />
    ),
    enableSorting: true,
    enableHiding: true,
  },
  {
    id: "address",
    accessorFn: (row) => formatAddress(row as any),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Address" />
    ),
    cell: ({ row }) => <div className="">{formatAddress(row.original as any) || "N/A"}</div>,
    enableSorting: true,
    enableHiding: true,
  },

  {
    accessorKey: "created_on",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date created" />
    ),
    cell: ({ row }) => (
      <div className="w-[80px]">
        {moment(row.getValue("created_on")).format("YY-MM-DD")}
      </div>
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
        {(row.getValue("assigned_to_user") as { name?: string } | null)?.name ??
          "Unassigned"}
      </div>
    ),
    enableSorting: true,
    enableHiding: true,
  },

  {
    id: "actions",
    cell: ({ row }) => (
      <DataTableRowActions
        row={row}
        contactTypes={contactTypes}
        accounts={accounts}
        leadSources={leadSources}
        leadStatuses={leadStatuses}
        leadTypes={leadTypes}
        products={products}
        saleStages={saleStages}
      />
    ),
  },
];
