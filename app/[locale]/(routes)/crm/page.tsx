import { Suspense, type ComponentType } from "react";
import Link from "next/link";
import {
  CoinsIcon,
  Contact,
  DollarSignIcon,
  FileText,
  HeartHandshakeIcon,
  LandmarkIcon,
  UserIcon,
} from "lucide-react";
import { Decimal } from "@prisma/client/runtime/client";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { getSession } from "@/lib/auth-server";
import { getDefaultCurrency, formatCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeadsCount } from "@/actions/dashboard/get-leads-count";
import { getContactCount } from "@/actions/dashboard/get-contacts-count";
import { getAccountsCount } from "@/actions/dashboard/get-accounts-count";
import { getActiveUsersCount } from "@/actions/dashboard/get-active-users-count";
import { getOpportunitiesCount } from "@/actions/dashboard/get-opportunities-count";
import { getExpectedRevenue } from "@/actions/crm/opportunity/get-expected-revenue";
import { getTemplates } from "@/actions/campaigns/templates/get-templates";

import Container from "../components/ui/Container";
import LoadingBox from "../components/dasboard/loading-box";

const CrmPage = async () => {
  const session = await getSession();

  if (!session) return null;

  const userId = session.user.id;
  void userId;
  const dict = await getTranslations("DashboardPage");
  const cookieStore = await cookies();
  const defaultCurrency = await getDefaultCurrency();
  const displayCurrency =
    cookieStore.get("display_currency")?.value || defaultCurrency;

  const [
    leads,
    contacts,
    users,
    accounts,
    revenue,
    opportunities,
    templates,
  ] = await Promise.all([
    getLeadsCount(),
    getContactCount(),
    getActiveUsersCount(),
    getAccountsCount(),
    getExpectedRevenue(displayCurrency),
    getOpportunitiesCount(),
    getTemplates(),
  ]);

  return (
    <Container
      title="Quick Snapshot"
      description="Dashboard"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Suspense fallback={<LoadingBox />}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {dict("totalRevenue")}
              </CardTitle>
              <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-medium">0</div>
            </CardContent>
          </Card>
        </Suspense>
        <Suspense fallback={<LoadingBox />}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {dict("expectedRevenue")}
              </CardTitle>
              <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-medium">
                {formatCurrency(new Decimal(revenue), displayCurrency)}
              </div>
            </CardContent>
          </Card>
        </Suspense>

        <DashboardCard href="/admin/users" title={dict("activeUsers")} IconComponent={UserIcon} content={users} />
        <DashboardCard href="/crm/accounts" title={dict("accounts")} IconComponent={LandmarkIcon} content={accounts} />
        <DashboardCard href="/crm/opportunities" title={dict("opportunities")} IconComponent={HeartHandshakeIcon} content={opportunities} />
        <DashboardCard href="/crm/contacts" title={dict("contacts")} IconComponent={Contact} content={contacts} />
        <DashboardCard href="/crm/leads" title={dict("leads")} IconComponent={CoinsIcon} content={leads} />
        <DashboardCard href="/campaigns/templates" title="Templates" IconComponent={FileText} content={templates.length} />
      </div>
    </Container>
  );
};

export default CrmPage;

const DashboardCard = ({
  href,
  title,
  IconComponent,
  content,
}: {
  href: string;
  title: string;
  IconComponent: ComponentType<{ className?: string }>;
  content: number;
}) => (
  <Link href={href}>
    <Suspense fallback={<LoadingBox />}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <IconComponent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-medium">{content}</div>
        </CardContent>
      </Card>
    </Suspense>
  </Link>
);
