import { Contact } from "lucide-react";
import { NavItem } from "../nav-main";

export const getContactsMenuItem = (): NavItem => {
  return {
    title: "Contacts",
    icon: Contact,
    url: "/crm/contacts",
    alwaysOpen: true,
    items: [
      {
        title: "Leads",
        url: "/crm/leads",
        exact: true,
      },
      {
        title: "Customers / Clients",
        url: "/crm/contacts?role=customer",
        exact: true,
      },
      {
        title: "Agents",
        url: "/crm/contacts?role=agent",
        exact: true,
      },
      {
        title: "Others",
        url: "/crm/contacts?role=others",
        exact: true,
      },
    ],
  };
};

export default getContactsMenuItem;
