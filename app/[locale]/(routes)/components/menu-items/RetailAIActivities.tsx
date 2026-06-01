import { Bot } from "lucide-react";
import type { CrmSidebarCounts } from "@/actions/crm/sidebar/get-sidebar-counts";
import { NavItem } from "../nav-main";

export default function getRetailAIActivitiesMenuItem(
  counts?: CrmSidebarCounts,
): NavItem {
  return {
    title: "AI Activities",
    url: "/retail-ai-activities",
    icon: Bot,
    count: counts?.aiActivities,
  };
}

