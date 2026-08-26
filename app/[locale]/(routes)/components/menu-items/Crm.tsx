import { Coins } from "lucide-react";
import type { CrmSidebarCounts } from "@/actions/crm/sidebar/get-sidebar-counts";
import { NavItem } from "../nav-main";

type Props = {
  localizations: {
    title: string;
    accounts: string;
    contacts?: string;
    people?: string;
    leads: string;
    opportunities: string;
    contracts: string;
    products: string;
  };
  counts?: CrmSidebarCounts;
};

export const getCrmMenuItem = ({ localizations, counts }: Props): NavItem => {
  return {
    title: localizations.title,
    url: "/crm",
    icon: Coins,
    alwaysOpen: true,
    items: [
      {
        title: "Dashboard",
        url: "/crm/dashboard",
        count: counts?.dashboard,
      },
      {
        title: localizations.opportunities,
        url: "/crm/opportunities",
        count: counts?.opportunities,
      },
      {
        title: localizations.accounts,
        url: "/crm/accounts",
        count: counts?.company,
      },
      {
        title: localizations.products,
        url: "/crm/products",
        count: counts?.products,
      },
      {
        title: "Teams",
        url: "/crm/teams",
      },
      // {
      //   title: "Overview",
      //   url: "/crm",
      // },
    ],
  };
};

export default getCrmMenuItem;
