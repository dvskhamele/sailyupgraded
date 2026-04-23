import { FileText } from "lucide-react";
import { NavItem } from "../nav-main";

type Props = {
  localizations: {
    title: string;
    campaigns: string;
    templates: string;
    targets: string;
    targetLists: string;
  };
};

export const getTemplatesMenuItem = ({ localizations }: Props): NavItem => {
  return {
    title: localizations.templates,
    icon: FileText,
    items: [
      { title: localizations.templates, url: "/campaigns/templates" },
    ],
  };
};

export default getTemplatesMenuItem;
