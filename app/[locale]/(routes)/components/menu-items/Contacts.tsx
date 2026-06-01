import { Contact } from "lucide-react";
import type { CrmSidebarCounts } from "@/actions/crm/sidebar/get-sidebar-counts";
import { NavItem } from "../nav-main";

export const getContactsMenuItem = (counts?: CrmSidebarCounts): NavItem => {
  return {
    title: "Contacts",
    icon: Contact,
    url: "/crm/contacts",
    count: counts?.contacts,
    alwaysOpen: true,
    items: [
      {
        title: "Leads",
        url: "/crm/leads",
        exact: true,
        count: counts?.leads,
      },
      {
        title: "Customers / Clients",
        url: "/crm/contacts?role=customer",
        exact: true,
        count: counts?.customers,
      },
      {
        title: "Agents",
        url: "/crm/contacts?role=agent",
        exact: true,
        count: counts?.agents,
      },
      {
        title: "Others",
        url: "/crm/contacts?role=others",
        exact: true,
        count: counts?.others,
      },
    ],
  };
};

export default getContactsMenuItem;
