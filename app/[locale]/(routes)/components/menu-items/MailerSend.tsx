import { Mail } from "lucide-react";
import type { NavItem } from "../nav-main";

export default function getMailerSendMenuItem(): NavItem {
  return {
    title: "MailerSend",
    url: "https://www.mailersend.com/",
    external: true,
    target: "_blank",
    icon: Mail,
  };
}
