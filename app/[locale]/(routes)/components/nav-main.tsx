"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { type LucideIcon, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

/**
 * NavMain Component - Task Groups 2.1, 5.3
 *
 * Primary navigation component for the sidebar.
 * Features:
 * - Renders navigation items with icons and labels
 * - Supports collapsible groups for module dropdowns
 * - Active state detection using usePathname()
 * - Supports nested navigation items
 *
 * Task 5.3 Updates (Animation Standardization):
 * - Removed custom duration-200 class from ChevronRight icon
 * - Now uses Tailwind default transition duration (150ms)
 * - Maintains smooth rotation animation with shadcn defaults
 *
 * @param items - Array of navigation items (can be simple or grouped)
 * @param dict - Localization dictionary for labels
 */

export interface NavItem {
  title: string
  url?: string
  icon?: LucideIcon
  isActive?: boolean
  alwaysOpen?: boolean
  items?: NavSubItem[] // For collapsible groups
}

export interface NavSubItem {
  title: string
  url: string
  isActive?: boolean
  exact?: boolean
  items?: NavSubItem[]
}

interface NavMainProps {
  items: NavItem[]
  dict?: any
}

export function NavMain({ items, dict }: NavMainProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Helper function to check if a route is active
  const isRouteActive = (url?: string, exact?: boolean): boolean => {
    if (!url) {
      return false
    }

    const [targetPath, targetQuery] = url.split("?")
    const normalizedPathname = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "")

    if (targetQuery) {
      const targetParams = new URLSearchParams(targetQuery)
      const pathMatches = exact
        ? pathname === targetPath || normalizedPathname === targetPath
        : pathname.startsWith(targetPath) || normalizedPathname.startsWith(targetPath)

      if (!pathMatches) {
        return false
      }

      return Array.from(targetParams.entries()).every(([key, value]) => searchParams.get(key) === value)
    }

    if (url === "/" || url === "") {
      return pathname === "/" || pathname === ""
    }
    if (exact) {
      return pathname === url || normalizedPathname === url
    }
    return pathname.startsWith(url) || normalizedPathname.startsWith(url)
  }

  // Helper to check if any sub-item is active
  const hasActiveChild = (subItems?: NavSubItem[]): boolean => {
    if (!subItems) return false
    return subItems.some((item) => isRouteActive(item.url, item.exact) || hasActiveChild(item.items))
  }

  const renderSubItems = (subItems: NavSubItem[], depth = 0) => {
    return subItems.map((subItem) => {
      const isActive = isRouteActive(subItem.url, subItem.exact)
      const hasNestedItems = !!subItem.items?.length
      const hasActiveNestedChild = hasActiveChild(subItem.items)

      if (hasNestedItems) {
        return (
          <Collapsible
            key={`${subItem.title}-${subItem.url}`}
            asChild
            defaultOpen={hasActiveNestedChild || isActive}
            className="group/collapsible"
          >
            <SidebarMenuSubItem>
              <div className={cn("w-full", depth > 0 && "pl-2")}>
                <CollapsibleTrigger asChild>
                  <SidebarMenuSubButton isActive={isActive || hasActiveNestedChild}>
                    <span>{subItem.title}</span>
                    <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                  </SidebarMenuSubButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {renderSubItems(subItem.items!, depth + 1)}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </div>
            </SidebarMenuSubItem>
          </Collapsible>
        )
      }

      return (
        <SidebarMenuSubItem key={`${subItem.title}-${subItem.url}`}>
          <div className={cn(depth > 0 && "pl-2")}>
            <SidebarMenuSubButton
              asChild
              isActive={isActive}
            >
              <Link href={subItem.url}>
                <span>{subItem.title}</span>
              </Link>
            </SidebarMenuSubButton>
          </div>
        </SidebarMenuSubItem>
      )
    })
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          // Check if this is a collapsible group with sub-items
          if (item.items && item.items.length > 0) {
            const hasActive = hasActiveChild(item.items)

            if (item.alwaysOpen) {
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild={!!item.url}
                    tooltip={item.title}
                    isActive={hasActive || (!!item.url && isRouteActive(item.url))}
                  >
                    {item.url ? (
                      <Link href={item.url}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                      </Link>
                    ) : (
                      <>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                      </>
                    )}
                  </SidebarMenuButton>
                  <SidebarMenuSub>
                    {renderSubItems(item.items)}
                  </SidebarMenuSub>
                </SidebarMenuItem>
              )
            }

            return (
              <Collapsible
                key={item.title}
                asChild
                defaultOpen={hasActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={hasActive}
                    >
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {renderSubItems(item.items)}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )
          }

          // Simple navigation item (no sub-items)
          if (!item.url) return null
          const isActive = isRouteActive(item.url)
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={isActive}
              >
                <Link href={item.url}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
