"use client";

import {
  AtSign,
  Chrome,
  Facebook,
  Instagram,
  Linkedin,
  Music2,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import type { NavItem, NavSubItem } from "../nav-main";

type SocialPlatformId =
  | "instagram"
  | "facebook"
  | "linkedin"
  | "threads"
  | "tiktok"
  | "google-ads"
  | "twitter-x"
  | "youtube";

type SocialPlatformAction = "extension" | "login";

type SocialPlatformActionConfig = {
  label: string;
  url: string;
};

type SocialPlatformConfig = {
  id: SocialPlatformId;
  title: string;
  icon: LucideIcon;
  actions: Partial<Record<SocialPlatformAction, SocialPlatformActionConfig>>;
};

const externalTarget = "_blank";

export const ADS_MANAGER_URLS: Partial<Record<SocialPlatformId, string>> = {
  "google-ads": "https://ads.google.com/",
  facebook: "https://www.facebook.com/business/",
  linkedin: "https://business.linkedin.com/advertise/ads",
  instagram: "https://www.facebook.com/business/tools/instagram-ads",
  tiktok: "https://ads.tiktok.com/",
  "twitter-x": "https://ads.x.com/",
  youtube: "https://ads.google.com/home/campaigns/video-ads/",
};

export function getPlatformAdsUrl(platformId: SocialPlatformId) {
  return ADS_MANAGER_URLS[platformId] ?? null;
}

const socialPlatforms: SocialPlatformConfig[] = [
  {
    id: "instagram",
    title: "Instagram",
    icon: Instagram,
    actions: {
      extension: {
        label: "Extension",
        url: "https://chromewebstore.google.com/detail/instadm-auto-dm-leads-col/mfmhpjojeelkcnejjlmjdgipfdaefkad?authuser=0&hl=en-GB",
      },
      login: {
        label: "Start",
        url: "https://www.instagram.com/accounts/login/",
      },
    },
  },
  {
    id: "facebook",
    title: "Facebook",
    icon: Facebook,
    actions: {
      extension: {
        label: "Extension",
        url: "https://chromewebstore.google.com/detail/facebookdm-auto-dm-leads/dipgidedgklfkdhmhckbjggonkifipeo?authuser=0&hl=en-GB",
      },
      login: {
        label: "Start",
        url: "https://www.facebook.com/login",
      },
    },
  },
  {
    id: "linkedin",
    title: "LinkedIn",
    icon: Linkedin,
    actions: {
      extension: {
        label: "Extension",
        url: "https://chromewebstore.google.com/detail/ingage-%E2%80%94-one-click-ai-lin/nkaegpeiilppheefgalffciemnamogla?authuser=0&hl=en-GB",
      },
      login: {
        label: "Start",
        url: "https://www.linkedin.com/login",
      },
    },
  },
  {
    id: "threads",
    title: "Threads",
    icon: AtSign,
    actions: {
      login: {
        label: "Start",
        url: "https://www.threads.net/login",
      },
    },
  },
  {
    id: "tiktok",
    title: "TikTok",
    icon: Music2,
    actions: {},
  },
  {
    id: "google-ads",
    title: "Google",
    icon: Chrome,
    actions: { },
  },
  {
    id: "twitter-x",
    title: "Twitter",
    icon: Twitter,
    actions: {
      login: {
        label: "Start",
        url: "https://x.com/i/flow/login",
      },
    },
  },
];

const buildPlatformAction = (
  platform: SocialPlatformConfig,
  action: SocialPlatformAction,
): NavSubItem | null => {
  const actionConfig = platform.actions[action];

  if (!actionConfig) {
    return null;
  }

  return {
    title: `${platform.title} ${actionConfig.label}`,
    url: actionConfig.url,
    external: true,
    target: externalTarget,
  };
};

const buildPlatformAdsAction = (
  platform: SocialPlatformConfig,
): NavSubItem | null => {
  const adsUrl = getPlatformAdsUrl(platform.id);

  if (!adsUrl) {
    return null;
  }

  return {
    title: `${platform.title} Ads`,
    url: adsUrl,
    external: true,
    target: externalTarget,
  };
};

export default function getSocialPlatformMenuItems(): NavItem[] {
  return socialPlatforms.map((platform) => ({
    title: platform.title,
    icon: platform.icon,
    items: [
      buildPlatformAction(platform, "extension"),
      buildPlatformAction(platform, "login"),
      buildPlatformAdsAction(platform),
    ].filter((item): item is NavSubItem => item !== null),
  }));
}
