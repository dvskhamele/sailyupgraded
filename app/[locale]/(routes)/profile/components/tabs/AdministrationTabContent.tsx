import Link from "next/link";
import {
  ClipboardList,
  Coins,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const adminPanels = [
  {
    title: "CRM Settings",
    description: "Manage sales types, stages, and CRM config values.",
    href: "/admin/crm-settings",
    Icon: SlidersHorizontal,
  },
  {
    title: "Users",
    description: "Manage user access and invitations.",
    href: "/admin/users",
    Icon: Users,
  },
  {
    title: "Currencies",
    description: "Manage enabled currencies and exchange rates.",
    href: "/admin/currencies",
    Icon: Coins,
  },
  {
    title: "Audit Log",
    description: "Review recent admin and system activity.",
    href: "/admin/audit-log",
    Icon: ClipboardList,
  },
];

export function AdministrationTabContent() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {adminPanels.map(({ title, description, href, Icon }) => (
        <Link key={href} href={href}>
          <Card className="h-full transition-colors hover:border-foreground/20 hover:bg-muted/30">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="space-y-1">
                <CardTitle className="text-base">{title}</CardTitle>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <Icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Open panel
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
