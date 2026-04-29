import { Coins } from "lucide-react";
import { NavItem } from "../nav-main";

type Props = {
  localizations: {
    title: string;
    accounts: string;
    leads: string;
    opportunities: string;
    contracts: string;
    products: string;
  };
};

export const getCrmMenuItem = ({ localizations }: Props): NavItem => {
  return {
    title: localizations.title,
    url: "/crm",
    icon: Coins,
    alwaysOpen: true,
    items: [
      {
        title: "Dashboard",
        url: "/crm/dashboard",
      },
      {
        title: localizations.opportunities,
        url: "/crm/opportunities",
      },
      {
        title: localizations.accounts,
        url: "/crm/accounts",
      },
      {
        title: localizations.products,
        url: "/crm/products",
      },
      {
        title: "Overview",
        url: "/crm",
      },
    ],
  };
};

export default getCrmMenuItem;
