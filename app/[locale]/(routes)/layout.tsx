import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import Header from "./components/Header";
import Footer from "./components/Footer";

import { Metadata } from "next";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { getTranslations } from "next-intl/server";
import { AvatarProvider } from "@/context/avatar-context";
import { CurrencyProvider } from "@/context/currency-context";
import { getEnabledCurrencies, getDefaultCurrency } from "@/lib/currency";
import { getCrmSidebarCounts } from "@/actions/crm/sidebar/get-sidebar-counts";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL! || "http://localhost:3000"
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

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  //console.log(session, "session");

  if (!session) {
    return redirect("/sign-in");
  }

  // If guest session, we can proceed (demo mode)
  // If user session, check user status
  let user = null;
  if (session.type === "user") {
    user = session.user;
  }

  if (user?.userStatus === "PENDING") {
    return redirect("/pending");
  }

  if (user?.userStatus === "INACTIVE") {
    return redirect("/inactive");
  }

  // Fetch localization dictionary
  const dict = await getTranslations("ModuleMenu");

  // Extract translations as plain object for client component
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
      // campaigns: dict("campaigns.campaigns"),
      templates: dict("campaigns.templates"),
      // targets: dict("campaigns.targets"),
      // targetLists: dict("campaigns.targetLists"),
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
  const displayCurrency = cookieCurrency && enabledCurrencies.some((c: { code: string }) => c.code === cookieCurrency)
    ? cookieCurrency
    : defaultCurrency;
  const currencyList = enabledCurrencies.map((c: { code: string; name: string; symbol: string }) => ({ code: c.code, name: c.name, symbol: c.symbol }));

  // For guest session, create mock user
  const effectiveUser = user || {
    id: "guest-user",
    email: "guest@example.com",
    name: "Guest User",
    role: "admin",
    userStatus: "ACTIVE",
    userLanguage: "en",
    image: null,
    avatar: null,
  };

  //console.log(typeof build, "build");
  return (
    <AvatarProvider initialAvatar={effectiveUser?.image}>
    <CurrencyProvider initialCurrency={displayCurrency} currencies={currencyList}>
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar
        dict={translations}
        session={session.type === "user" ? session : { user: effectiveUser, session: { id: "guest-session" } }}
        counts={sidebarCounts}
      />
      <SidebarInset>
        <Header
          id={effectiveUser.id as string}
          lang={effectiveUser.userLanguage as string}
        />
        {/*
          Task Group 3.3: Footer Relocation
          - Footer has been moved inside the scrollable content area
          - This allows the footer to scroll with the page content
          - Footer will appear at the bottom of the content, not fixed at viewport bottom
        */}
        <div className="flex flex-col flex-grow overflow-y-auto h-full w-full min-w-0">
          <div className="flex-grow w-full min-w-0">
            <div className="w-full px-4 min-w-0">
              {children}
            </div>
          </div>
          <Footer />
        </div>
      </SidebarInset>
    </SidebarProvider>
    </CurrencyProvider>
    </AvatarProvider>
  );
}
