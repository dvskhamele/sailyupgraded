import { FileText } from "lucide-react";
import type { CrmSidebarCounts } from "@/actions/crm/sidebar/get-sidebar-counts";
import { NavItem } from "../nav-main";

type Props = {
  localizations: {
    title: string;
    campaigns?: string;
    templates: string;
    targets?: string;
    targetLists?: string;
  };
  counts?: CrmSidebarCounts;
};

export const getTemplatesMenuItem = ({ localizations, counts }: Props): NavItem => {
  return {
    title: localizations.templates,
    icon: FileText,
    count: counts?.templates,
    items: [
      {
        title: localizations.templates,
        url: "/campaigns/templates",
        count: counts?.templates,
      },
    ],
  };
};

export default getTemplatesMenuItem;
