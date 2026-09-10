"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { ChevronRightIcon } from "lucide-react"
import { cn } from "cn"
import { usePathname } from "next/navigation"

/**
 * @component NavMain
 * @description Primary sidebar nav group — renders top-level links, expanding into a sub-list for items that have children.
 * @param items Nav entries to render, each optionally carrying nested sub-items.
 */
export const NavMain = ({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
    iconColor?: string
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}) => {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Workspace</SidebarGroupLabel>
      <SidebarMenu className="space-y-2">
        {items.map((item) =>
          item.items?.length ? (
            <Collapsible
              key={item.title}
              defaultOpen={item.isActive}
              className="group/collapsible "
              render={<SidebarMenuItem />}
            >
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton
                    tooltip={item.title}
                    size="lg"
                    className="group-data-[collapsible=icon]:justify-center"
                    isActive={item.url == pathname}
                  />
                }
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md [&_svg]:size-3.5",
                    item.iconColor
                  )}
                >
                  {item.icon}
                </span>
                <span>{item.title}</span>
                <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton render={<a href={subItem.url} />}>
                        <span>{subItem.title}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                render={<a href={item.url} />}
                size="lg"
                className="group-data-[collapsible=icon]:justify-center items-center "
                isActive={item.url == pathname}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md [&_svg]:size-3.5",
                    item.iconColor
                  )}
                >
                  {item.icon}
                </span>
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
