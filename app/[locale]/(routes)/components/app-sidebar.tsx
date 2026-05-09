"use client";

import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Facebook,
  Chrome,
  Twitter,
  Youtube,
  Music2,
  AtSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { CalendarClock, Instagram, Linkedin } from "lucide-react";
import getContactsMenuItem from "./menu-items/Contacts";
import getCrmMenuItem from "./menu-items/Crm";
// import getProjectsMenuItem from "./menu-items/Projects";
// import getEmailsMenuItem from "./menu-items/Emails";
import getReportsMenuItem from "./menu-items/Reports";
// import getDocumentsMenuItem from "./menu-items/Documents";
// import getInvoicesMenuItem from "./menu-items/Invoices";
import getAdministrationMenuItem from "./menu-items/Administration";
import getTemplatesMenuItem from "./menu-items/Campaigns";

/**
 * AppSidebar Component - Task Groups 1.2, 2.2-2.7, 3.1, 5.3, 5.4
 *
 * Core sidebar component for NextCRM application layout.
 * Implements shadcn/ui sidebar pattern with:
 * - Logo and "N" branding symbol with rotation animation
 * - Build version display in footer (when expanded)
 * - Navigation with Dashboard and module items
 * - Nav-user section in footer for user profile and actions
 *
 * Phase 2 Updates:
 * - Task 2.2: Added Dashboard menu item integration
 * - Task 2.3: Added CRM module navigation (collapsible group with module filtering)
 * - Task 2.4: Added Projects module navigation (simple item with module filtering)
 * - Task 2.5: Added Emails module navigation (simple item with module filtering)
 * - Task 2.6: Added remaining module navigation items (Employees, Reports, Documents, Databox)
 * - Task 2.7: Added Administration menu with role-based visibility (is_admin check)
 * - NavMain component renders all enabled module navigation items
 * - Module filtering ensures only enabled modules appear in navigation
 * - Role-based visibility: Administration only shows for admin users
 *
 * Phase 3 Updates:
 * - Task 3.1: Added NavUser component in SidebarFooter
 * - NavUser displays user avatar, name, email
 * - NavUser provides dropdown with user actions (Profile, Settings, Logout)
 * - NavUser adapts to collapsed/expanded sidebar states
 * - Build version moved above NavUser in footer
 *
 * Phase 5 Updates (Design Consistency):
 * - Task 5.3: Removed duration-200 from app name animation (uses Tailwind default)
 * - Task 5.3: Kept duration-500 on "N" symbol for intentional brand emphasis
 * - Task 5.4: Changed build version text-gray-500 to text-muted-foreground for theme support
 *
 * @param modules - Array of enabled modules from system_Modules_Enabled table
 * @param dict - Localization dictionary for navigation labels
 * @param build - Build number for version display
 * @param session - User session data for role-based navigation and user profile
 */

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
  userStatus?: string;
  userLanguage?: string;
  lastLoginAt?: Date;
}

interface Session {
  user: User;
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  dict: any;
  session: Session;
}

export function AppSidebar({
  dict,
  session,
  ...props
}: AppSidebarProps) {
  const { state } = useSidebar();
  const isExpanded = state === "expanded";

  const navItems = [
    getCrmMenuItem({ localizations: dict.crm }),
    getContactsMenuItem(),
    getTemplatesMenuItem({
      localizations: dict.campaigns,
    }),
    getReportsMenuItem({ title: dict?.reports || "Reports" }),
  ];

  // Administration: admin users only
  if (session?.user?.role === "admin") {
    navItems.push(
      getAdministrationMenuItem({ title: dict?.settings || "Administration" }),
    );
  }

  navItems.push(
    {
      title: "Instagram",
      icon: Instagram,
      defaultOpen: true,
      items: [
        {
          title: "Instagram Extension",
          url: "https://chromewebstore.google.com/detail/instadm-auto-dm-leads-col/mfmhpjojeelkcnejjlmjdgipfdaefkad?authuser=0&hl=en-GB",
          external: true,
          target: "_blank",
        },
        {
          title: "Instagram Start",
          url: "https://www.instagram.com/accounts/login/",
          external: true,
          target: "_blank",
        },
        {
          title: "Instagram ADs",
          url: "#",
          external: true,
          target: "_blank",
        },
      ],
    },
    {
      title: "LinkedIn",
      icon: Linkedin,
      defaultOpen: true,
      items: [
        {
          title: "LinkedIn Extension",
          url: "https://chromewebstore.google.com/detail/ingage-%E2%80%94-one-click-ai-lin/nkaegpeiilppheefgalffciemnamogla?authuser=0&hl=en-GB",
          external: true,
          target: "_blank",
        },
        {
          title: "LinkedIn Start",
          url: "https://www.linkedin.com/login",
          external: true,
          target: "_blank",
        },
        {
          title: "LinkedIn ADs",
          url: "⁠https://business.linkedin.com/advertise/ads",
          external: true,
          target: "_blank",
        },
      ],
    },
   {
  title: "Facebook",
  icon: Facebook,
  defaultOpen: true,
  items: [
    {
      title: "Facebook Login",
      url: "https://www.facebook.com/login",
      external: true,
      target: "_blank",
    },
    {
      title: "Facebook Ads",
      url: "https://www.facebook.com/business/ads",
      external: true,
      target: "_blank",
    },
  ],
},
{
  title: "Google",
  icon: Chrome,
  defaultOpen: true,
  items: [
    {
      title: "Google Login",
      url: "https://accounts.google.com/",
      external: true,
      target: "_blank",
    },
    {
      title: "Google Ads",
      url: "https://ads.google.com/",
      external: true,
      target: "_blank",
    },
  ],
},
{
  title: "Threads",
  icon: AtSign,
  defaultOpen: true,
  items: [
    {
      title: "Threads Login",
      url: "https://www.threads.net/login",
      external: true,
      target: "_blank",
    },
    {
      title: "Threads",
      url: "https://www.threads.net/",
      external: true,
      target: "_blank",
    },
  ],
},
{
  title: "Twitter / X",
  icon: Twitter,
  defaultOpen: true,
  items: [
    {
      title: "Twitter Login",
      url: "https://x.com/i/flow/login",
      external: true,
      target: "_blank",
    },
    {
      title: "Twitter Ads",
      url: "https://ads.x.com/",
      external: true,
      target: "_blank",
    },
  ],
},
{
  title: "TikTok",
  icon: Music2,
  defaultOpen: true,
  items: [
    {
      title: "TikTok Login",
      url: "https://www.tiktok.com/login",
      external: true,
      target: "_blank",
    },
    {
      title: "TikTok Ads",
      url: "https://ads.tiktok.com/",
      external: true,
      target: "_blank",
    },
  ],
},
{
  title: "YouTube",
  icon: Youtube,
  defaultOpen: true,
  items: [
    {
      title: "YouTube Studio",
      url: "https://studio.youtube.com/",
      external: true,
      target: "_blank",
    },
    {
      title: "YouTube Ads",
      url: "https://ads.google.com/home/campaigns/video-ads/",
      external: true,
      target: "_blank",
    },
  ],
},
    {
      title: "Zenith",
      url: "https://zenith-nu-mocha.vercel.app/dashboard?page=composer",
      icon: CalendarClock,
      external: true,
      target: "_blank",
    },
   
  );
  // Prepare user data for NavUser component
  const userData = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    avatar: session.user.image,
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Header with Logo and Branding */}
      <SidebarHeader>
        <Link
          href="/crm/dashboard"
          className={cn(
            "flex items-center py-1",
            isExpanded ? "gap-x-4" : "justify-center",
          )}
        >
          {/* "N" Branding Symbol with rotation animation */}
          <div
            className={cn(
              "flex-shrink-0 border rounded-full px-4 py-2 transition-transform duration-500",
              isExpanded && "rotate-[360deg]",
            )}
          >
            S
          </div>

          {/* App Name - visible when expanded, hidden when collapsed */}
          <h1
            className={cn(
              "origin-left font-medium text-xl transition-all overflow-hidden whitespace-nowrap",
              !isExpanded ? "w-0 opacity-0" : "w-auto opacity-100",
            )}
          >
            Saily
          </h1>
        </Link>
      </SidebarHeader>

      {/* Main Content - Navigation */}
      <SidebarContent>
        {/* NavMain component with all enabled module navigation items */}
        <NavMain items={navItems} dict={dict} />
      </SidebarContent>

      {/* Footer with NavUser and Build Version */}
      <SidebarFooter>
        {/* Task 3.1: NavUser component with user profile and actions */}
        <NavUser user={userData} />
      </SidebarFooter>

      {/* Rail for toggling sidebar on desktop */}
      <SidebarRail />
    </Sidebar>
  );
}
