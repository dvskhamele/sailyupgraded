"use client";

import { ColumnDef } from "@tanstack/react-table";
import {
  Building2,
  User,
  ExternalLink,
  MoreHorizontal,
  Eye,
  Copy,
  Linkedin,
  Globe,
} from "lucide-react";
import moment from "moment";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmailLink, WhatsAppLink } from "@/components/ui/contact-link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumnHeader } from "./data-table-column-header";
import type { PeopleRecord } from "@/types/people";
import { toast } from "sonner";

interface ColumnsOptions {
  onViewRecord?: (record: PeopleRecord) => void;
}

export const createColumns = ({
  onViewRecord,
}: ColumnsOptions = {}): ColumnDef<PeopleRecord>[] => [
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
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => {
      const type = row.getValue("type") as string;
      const isAccount = type === "Account";
      return (
        <Badge
          variant={isAccount ? "default" : "secondary"}
          className={
            isAccount
              ? "bg-blue-600/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 font-medium shrink-0"
              : "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 font-medium shrink-0"
          }
        >
          {isAccount ? (
            <Building2 className="mr-1 h-3 w-3" />
          ) : (
            <User className="mr-1 h-3 w-3" />
          )}
          {type}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      if (!value || (Array.isArray(value) && value.length === 0)) return true;
      if (Array.isArray(value)) {
        return value.includes(row.getValue(id));
      }
      return row.getValue(id) === value;
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const name = row.original.name;
      return (
        <button
          type="button"
          onClick={() => onViewRecord?.(row.original)}
          className="text-left font-medium hover:underline hover:text-primary transition-colors cursor-pointer block max-w-[220px] truncate"
        >
          {name}
        </button>
      );
    },
    enableSorting: true,
    enableHiding: false,
  },
  {
    accessorKey: "company",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Company / Account" />
    ),
    cell: ({ row }) => {
      const company = row.getValue("company") as string;
      if (!company) return <span className="text-muted-foreground">—</span>;
      return <div className="max-w-[180px] truncate">{company}</div>;
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "jobTitle",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title / Role" />
    ),
    cell: ({ row }) => {
      const jobTitle = row.getValue("jobTitle") as string;
      if (!jobTitle) return <span className="text-muted-foreground">—</span>;
      return <div className="max-w-[180px] truncate text-muted-foreground">{jobTitle}</div>;
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="E-mail" />
    ),
    cell: ({ row }) => {
      const email = row.getValue("email") as string;
      if (!email) return <span className="text-muted-foreground">—</span>;
      return <EmailLink value={email} className="max-w-[180px]" fallback="—" />;
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "phone",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Phone" />
    ),
    cell: ({ row }) => {
      const phone = (row.getValue("phone") as string) || row.original.phone || row.original.mobilePhone || row.original.officePhone;
      if (!phone) return <span className="text-muted-foreground">—</span>;
      return <WhatsAppLink value={phone} className="max-w-[140px]" fallback="—" />;
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "city",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="City" />
    ),
    cell: ({ row }) => {
      const city = row.getValue("city") as string;
      if (!city) return <span className="text-muted-foreground">—</span>;
      return <div className="max-w-[130px] truncate text-muted-foreground">{city}</div>;
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "country",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Country" />
    ),
    cell: ({ row }) => {
      const country = row.getValue("country") as string;
      if (!country) return <span className="text-muted-foreground">—</span>;
      return <div className="max-w-[130px] truncate">{country}</div>;
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "socialLinkedin",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="LinkedIn" />
    ),
    cell: ({ row }) => {
      const url = row.getValue("socialLinkedin") as string;
      if (!url) return <span className="text-muted-foreground">—</span>;
      const fullUrl = url.startsWith("http") ? url : `https://${url}`;
      return (
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[#0A66C2] hover:opacity-80 inline-flex items-center gap-1 text-xs"
        >
          <Linkedin className="h-3.5 w-3.5" />
          <span>Profile</span>
        </a>
      );
    },
    enableSorting: false,
    enableHiding: true,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = (row.getValue("status") as string) || "Active";
      return (
        <Badge variant="outline" className="font-normal text-xs">
          {status}
        </Badge>
      );
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as string;
      if (!date) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {moment(date).format("YY/MM/DD")}
        </div>
      );
    },
    enableSorting: true,
    enableHiding: true,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const record = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[160px]">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onViewRecord?.(record)}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                navigator.clipboard.writeText(record.originalId || record.id);
                toast.success("ID copied to clipboard");
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy ID
            </DropdownMenuItem>
            {record.email && (
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(record.email!);
                  toast.success("Email copied to clipboard");
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Email
              </DropdownMenuItem>
            )}
            {record.website && (
              <DropdownMenuItem asChild>
                <a
                  href={record.website.startsWith("http") ? record.website : `https://${record.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Globe className="mr-2 h-4 w-4" />
                  Visit Website
                </a>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
];
