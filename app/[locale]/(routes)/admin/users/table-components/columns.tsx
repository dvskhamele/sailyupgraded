"use client";

import moment from "moment";
import { useEffect, useState } from "react";

import { ColumnDef } from "@tanstack/react-table";

import { statuses } from "../table-data/data";
import { AdminUser } from "../table-data/schema";
import { DataTableRowActions } from "./data-table-row-actions";
import { DataTableColumnHeader } from "./data-table-column-header";
import { formatDistanceToNowStrict } from "date-fns";

function LastLoginCell({ value }: { value: Date | string | null | undefined }) {
  const [relativeDate, setRelativeDate] = useState("");

  useEffect(() => {
    if (!value) {
      setRelativeDate("Never");
      return;
    }

    setRelativeDate(
      formatDistanceToNowStrict(new Date(value), {
        addSuffix: true,
      })
    );
  }, [value]);

  return <div className="min-w-[150px]">{relativeDate}</div>;
}

export const columns: ColumnDef<AdminUser>[] = [
  /*   {
    accessorKey: "id",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="id" />
    ),
    cell: ({ row }) => <div className="">{row.getValue("id")}</div>,
    enableSorting: false,
    enableHiding: false,
  }, */
  {
    accessorKey: "created_on",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date created" />
    ),
    cell: ({ row }) => (
      <div className="w-[130px]">
        {moment(row.getValue("created_on")).format("YYYY/MM/DD-HH:mm")}
      </div>
    ),
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "lastLoginAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last login" />
    ),
    cell: ({ row }) => <LastLoginCell value={row.original.lastLoginAt} />,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),

    cell: ({ row }) => <div className="">{row.getValue("name")}</div>,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="E-mail" />
    ),

    cell: ({ row }) => <div className="">{row.getValue("email")}</div>,
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "role",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),

    cell: ({ row }) => (
      <div className="">{row.original.role ?? "member"}</div>
    ),
    enableSorting: true,
    enableHiding: true,
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },

  {
    accessorKey: "userStatus",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = statuses.find(
        (status) => status.value === row.getValue("userStatus")
      );

      if (!status) {
        return null;
      }

      return (
        <div className="flex items-center">
          {status.icon && (
            <status.icon className="mr-2 h-4 w-4 text-muted-foreground" />
          )}
          <span>{status.label}</span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "userLanguage",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Language" />
    ),

    cell: ({ row }) => <div className="">{row.getValue("userLanguage")}</div>,
    enableSorting: true,
    enableHiding: true,
  },
  {
    id: "actions",
    cell: ({ row }) => <DataTableRowActions row={row} />,
  },
];
