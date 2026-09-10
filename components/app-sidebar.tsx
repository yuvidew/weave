"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { WavesIcon, BotIcon, PlayIcon, PlugIcon, LayoutTemplateIcon, PanelsTopLeftIcon } from "lucide-react"

// This is sample data.
const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/",
      icon: (
        <PanelsTopLeftIcon />
      ),
      iconColor: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
    },
    {
      title: "Agents",
      url: "/agents",
      icon: (
        <BotIcon
        />
      ),
      iconColor: "bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
    },
    {
      title: "Runs",
      url: "/runs",
      icon: (
        <PlayIcon
        />
      ),
      iconColor: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    },
    {
      title: "Plugin",
      url: "/plugins",
      icon: (
        <PlugIcon
        />
      ),
      iconColor: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
    },
    {
      title: "Templates",
      url: "/templates",
      icon: (
        <LayoutTemplateIcon
        />
      ),
      iconColor: "bg-rose-500/10 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
    },
  ],
}

/**
 * @component AppSidebar
 * @description Main app sidebar shell — brand header, primary nav, and the signed-in user footer.
 */
export const AppSidebar = ({ ...props }: React.ComponentProps<typeof Sidebar>) => {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-transparent active:bg-transparent"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <WavesIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Weave</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
