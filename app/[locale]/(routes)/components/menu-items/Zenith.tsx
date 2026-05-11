import { CalendarClock } from "lucide-react";
import type { NavItem } from "../nav-main";

export const ZENITH_DASHBOARD_URL =
  "https://zenith-nu-mocha.vercel.app/dashboard?page=composer";

export default function getZenithMenuItem(): NavItem {
  return {
    title: "Zenith",
    url: "/zenith",
    icon: CalendarClock,
    exact: true,
  };
}
