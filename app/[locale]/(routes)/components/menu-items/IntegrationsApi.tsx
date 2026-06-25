import { Plug } from "lucide-react";
import type { NavItem } from "../nav-main";

export default function getIntegrationsApiMenuItem(): NavItem {
  return {
    title: "Integrations & API",
    url: "/integrations",
    icon: Plug,
  };
}
