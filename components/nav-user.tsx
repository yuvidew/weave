"use client"

import { useState } from "react"
import { useClerk, useUser } from "@clerk/nextjs"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  useSidebar,
} from "@/components/ui/sidebar"
import { ChevronsUpDownIcon, BadgeCheckIcon, CreditCardIcon, LogOutIcon, Loader2Icon, SunMoonIcon } from "lucide-react"
import { useUserDetail } from "@/context/user-detail-context"
import { AgentUsageDialog } from "@/components/agent-usage-dialog"
import { ThemeDialog } from "@/components/theme-dialog"
import { ProfileDialog } from "@/components/profile-dialog"
import { AGENT_LIMIT } from "@/db/schema"
import { getInitials } from "@/lib/utils"

/**
 * @component NavUser
 * @description Sidebar footer — signed-in user's avatar/name/email with an account dropdown, plus the agent usage dialog.
 */
export const NavUser = () => {
  const { isMobile } = useSidebar()
  const { userDetail } = useUserDetail()
  const { signOut } = useClerk()
  // Clerk's live profile image — not persisted in our DB, read directly from the client hook.
  const { user } = useUser()
  // Controls the open state of the agent-usage dialog, opened from the dropdown.
  const [usageOpen, setUsageOpen] = useState(false)
  // Controls the open state of the theme dialog, opened from the dropdown.
  const [themeOpen, setThemeOpen] = useState(false)
  // Controls the open state of the profile dialog, opened from the dropdown.
  const [profileOpen, setProfileOpen] = useState(false)
  // Dropdown is controlled so we can force it closed once sign-out settles.
  const [menuOpen, setMenuOpen] = useState(false)
  // True while the sign-out request is in flight — swaps the log-out icon for a spinner.
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Signs the user out and redirects to /sign-in. Keeps the dropdown open
  // (via closeOnClick={false} on the item) until the request settles.
  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await signOut({ redirectUrl: "/sign-in" })
    } finally {
      setIsLoggingOut(false)
      setMenuOpen(false)
    }
  }

  if (!userDetail) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuSkeleton showIcon />
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const name = userDetail.name ?? "Unnamed"
  const initials = getInitials(userDetail.name)
  // Derives agents *used* from credits *remaining*, clamped to a sane [0, AGENT_LIMIT] range.
  const agentsUsed = Math.min(
    AGENT_LIMIT,
    Math.max(0, AGENT_LIMIT - (userDetail.agentCredits ?? AGENT_LIMIT))
  )

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar>
              <AvatarImage src={user?.imageUrl} alt={name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-xs">{userDetail.email}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarImage src={user?.imageUrl} alt={name} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{name}</span>
                    <span className="truncate text-xs">{userDetail.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                <BadgeCheckIcon
                />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setUsageOpen(true)}>
                <CreditCardIcon
                />
                Usage
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setThemeOpen(true)}>
                <SunMoonIcon
                />
                Theme
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              closeOnClick={false}
              disabled={isLoggingOut}
              onClick={handleLogout}
            >
              {isLoggingOut ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <LogOutIcon />
              )}
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
      <AgentUsageDialog
        open={usageOpen}
        onOpenChange={setUsageOpen}
        used={agentsUsed}
      />
      <ThemeDialog open={themeOpen} onOpenChange={setThemeOpen} />
      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        name={name}
        email={userDetail.email}
        imageUrl={user?.imageUrl}
        createdAt={userDetail.createdAt}
      />
    </SidebarMenu>
  )
}
