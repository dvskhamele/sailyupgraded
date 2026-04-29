import { Contact } from "lucide-react";
import { NavItem } from "../nav-main";

export const getContactsMenuItem = (): NavItem => {
  return {
    title: "Contacts",
    icon: Contact,
    items: [
      {
        title: "Contact",
        url: "/crm/contacts",
        exact: true,
      },
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
        title: "Vendors",
        url: "/crm/contacts?role=vendor",
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
