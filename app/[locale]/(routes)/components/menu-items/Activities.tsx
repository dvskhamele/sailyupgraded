import { Activity } from "lucide-react";
import { NavItem } from "../nav-main";

interface GetActivitiesMenuItemProps {
  title?: string;
}

export default function getActivitiesMenuItem({
  title = "Activities",
}: GetActivitiesMenuItemProps = {}): NavItem {
  return {
    title,
    url: "/activities",
    icon: Activity,
  };
}
