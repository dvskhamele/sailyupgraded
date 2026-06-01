import { Activity } from "lucide-react";
import type { CrmSidebarCounts } from "@/actions/crm/sidebar/get-sidebar-counts";
import { NavItem } from "../nav-main";

interface GetActivitiesMenuItemProps {
  title?: string;
  counts?: CrmSidebarCounts;
}

export default function getActivitiesMenuItem({
  title = "Activities",
  counts,
}: GetActivitiesMenuItemProps = {}): NavItem {
  return {
    title,
    url: "/activities",
    icon: Activity,
    count: counts?.activities,
  };
}
