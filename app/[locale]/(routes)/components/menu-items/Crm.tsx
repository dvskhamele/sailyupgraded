import { Coins } from "lucide-react";
import { NavItem } from "../nav-main";

/**
 * CRM Module Menu Item - Task Group 2.3
 *
 * Converted from DropdownMenu pattern to collapsible sidebar group.
 * Returns a NavItem object with sub-items for all CRM routes.
 *
 * @param localizations - Localized labels for CRM module items
 * @returns NavItem object with collapsible sub-items for CRM navigation
 */

type Props = {
  localizations: {
    title: string;
    accounts: string;
    contacts: string;
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
        title: localizations.contacts,
        url: "/crm/contacts",
      },
      {
        title: localizations.leads,
        url: "/crm/leads",
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
