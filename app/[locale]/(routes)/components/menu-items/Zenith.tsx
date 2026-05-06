import { Orbit } from "lucide-react";
import { NavItem } from "../nav-main";

type Props = {
  title: string;
};

export const getZenithMenuItem = ({ title }: Props): NavItem => {
  return {
    title,
    url: "https://zenith-nu-mocha.vercel.app/dashboard?page=schedule",
    icon: Orbit,
    external: true,
  };
};

export const getInstagramExtensionMenuItem = ({ title }: Props): NavItem => {
  return {
    title,
    url: "https://chromewebstore.google.com/detail/instadm-auto-dm-leads-col/mfmhpjojeelkcnejjlmjdgipfdaefkad?authuser=0&hl=en-GB",
    icon: Orbit,
    external: true,
  };
};

export const getLinkedInExtensionMenuItem = ({ title }: Props): NavItem => {
  return {
    title,
    url: "https://chromewebstore.google.com/detail/ingage-%E2%80%94-one-click-ai-lin/nkaegpeiilppheefgalffciemnamogla?authuser=0&hl=en-GB",
    icon: Orbit,
    external: true,
  };
};

export default getZenithMenuItem;
