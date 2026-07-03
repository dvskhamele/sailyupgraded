import { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { getSession } from "@/lib/auth-server";
import { runWithOrganizationContext } from "@/lib/organization-context";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AvatarProvider } from "@/context/avatar-context";
import { CurrencyProvider } from "@/context/currency-context";

import { getEnabledCurrencies, getDefaultCurrency } from "@/lib/currency";
import { getCrmSidebarCounts } from "@/actions/crm/sidebar/get-sidebar-counts";

import Header from "./components/Header";
import Footer from "./components/Footer";
import { AppSidebar } from "./components/app-sidebar";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  title: "",
  description: "",
  openGraph: {
    images: [
      {
        url: "/images/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      {
        url: "/images/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "",
      },
    ],
  },
};

type AppLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
};

export default async function AppLayout({ children, params }: AppLayoutProps) {
  const { locale } = await params;

  const session = await getSession();

  if (!session) {
    redirect(`/${locale}/sign-in`);
  }

  const user = session.user;

  if (user.userStatus === "INACTIVE") {
    redirect(`/${locale}/inactive`);
  }

  if (!user.organizationId) {
    redirect(`/${locale}/create-organization`);
  }

  if (user.userStatus === "PENDING") {
    redirect(`/${locale}/pending`);
  }

  return runWithOrganizationContext(user.organizationId, async () => {
    const dict = await getTranslations("ModuleMenu");

    const translations = {
      dashboard: dict("dashboard"),
      crm: {
        title: dict("crm.title"),
        accounts: dict("crm.accounts"),
        opportunities: dict("crm.opportunities"),
        contacts: dict("crm.contacts"),
        leads: dict("crm.leads"),
        contracts: dict("crm.contracts"),
        products: dict("crm.products"),
      },
      campaigns: {
        title: dict("campaigns.title"),
        templates: dict("campaigns.templates"),
      },
      projects: dict("projects"),
      emails: dict("emails"),
      reports: dict("reports"),
      documents: dict("documents"),
      invoices: dict("invoices"),
      settings: dict("settings"),
    };

    const [cookieStore, sidebarCounts, enabledCurrencies, defaultCurrency] =
      await Promise.all([
        cookies(),
        getCrmSidebarCounts(),
        getEnabledCurrencies(),
        getDefaultCurrency(),
      ]);

    const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";
    const cookieCurrency = cookieStore.get("display_currency")?.value;

    const displayCurrency =
      cookieCurrency &&
      enabledCurrencies.some(
        (currency: { code: string }) => currency.code === cookieCurrency,
      )
        ? cookieCurrency
        : defaultCurrency;

    const currencyList = enabledCurrencies.map(
      (currency: { code: string; name: string; symbol: string }) => ({
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
      }),
    );

    return (
      <AvatarProvider initialAvatar={user.image}>
        <CurrencyProvider
          initialCurrency={displayCurrency}
          currencies={currencyList}
        >
          <SidebarProvider defaultOpen={sidebarOpen}>
            <AppSidebar
              dict={translations}
              session={session}
              counts={sidebarCounts}
            />

            <SidebarInset>
              <Header
                id={user.id as string}
                lang={user.userLanguage as string}
              />

              <div className="flex h-full w-full min-w-0 flex-grow flex-col overflow-y-auto">
                <div className="w-full min-w-0 flex-grow">
                  <div className="w-full min-w-0 px-4">{children}</div>
                </div>

                <Footer />
              </div>
            </SidebarInset>
          </SidebarProvider>
        </CurrencyProvider>
      </AvatarProvider>
    );
  });
}