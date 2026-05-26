import { Bot } from "lucide-react";
import { NavItem } from "../nav-main";

export default function getRetailAIActivitiesMenuItem(): NavItem {
  return {
    title: "Retail AI Activities",
    url: "/retail-ai-activities",
    icon: Bot,
  };
}


