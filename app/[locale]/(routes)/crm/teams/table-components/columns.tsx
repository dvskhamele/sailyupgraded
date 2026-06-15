"use client";

import { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "./data-table-column-header";
import { DataTableRowActions } from "./data-table-row-actions";
import moment from "moment";
import Link from "next/link";

import type { Team } from "../table-data/schema";

export const columns: ColumnDef<Team>[] = [
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => (
      <div className="">
        {moment(row.getValue("createdAt")).format("YY/MM/DD-HH:mm")}
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <Link href={`/crm/teams/${row.original?.id}`} data-testid="team-row-name">
        <div className="w-[250px]">{row.original.name}</div>
      </Link>
    ),
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "description",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
    cell: ({ row }) => (
      <div className="w-[300px] truncate">{row.original.description}</div>
    ),
    enableSorting: false,
    enableHiding: true,
  },
  {
    accessorKey: "_count.members",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Members" />
    ),
    cell: ({ row }) => (
      <div className="">{row.original._count?.members || 0}</div>
    ),
    enableSorting: false,
    enableHiding: true,
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
