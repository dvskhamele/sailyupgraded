import { Users } from "lucide-react";
import { NavItem } from "../nav-main";

export const getPeopleMenuItem = (): NavItem => {
  return {
    title: "People",
    icon: Users,
    url: "/crm/people",
    exact: true,
  };
};

export default getPeopleMenuItem;
