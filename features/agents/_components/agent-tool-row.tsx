"use client"

import {
    CalendarIcon,
    Loader2Icon,
    LinkIcon,
    MailIcon,
    MessageSquareIcon,
    NotebookIcon,
    SearchIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item"
import { isDirectAuthTool } from "@/constant/direct-auth-tools"
import type { useConnectTool, useDisconnectTool } from "../hook/use-agent"
import type { toolType } from "../types"

// Known tool slugs mapped to a display label and icon — falls back to a
// generic link icon/capitalized slug for anything not in this list. Shared by
// every place that renders a tool row (the edit sheet's "Connected tools"
// list and NewAgentCard's "Connect your tools" section) so both stay in sync.
export const TOOL_DISPLAY: Record<string, { label: string; icon: typeof MailIcon }> = {
    gmail: { label: "Gmail", icon: MailIcon },
    slack: { label: "Slack", icon: MessageSquareIcon },
    notion: { label: "Notion", icon: NotebookIcon },
    google_calendar: { label: "Google Calendar", icon: CalendarIcon },
    google_search: { label: "Google Search", icon: SearchIcon },
    serp_search: { label: "SERP Search", icon: SearchIcon },
    serpapi: { label: "SERP Search", icon: SearchIcon },
    browserbase: { label: "Browserbase", icon: LinkIcon },
}

interface AgentToolRowProps {
    slug: string
    agentId: string
    // From useAgentTools() — the real name/logo/connected state once loaded.
    // Falls back to the static TOOL_DISPLAY label/icon, disconnected, while
    // loading or if a slug isn't found.
    fetchedTool?: toolType
    // Shared across every row rendered together so only the row actually in
    // flight shows a spinner (see agent.isPending / .variables below).
    connectTool: ReturnType<typeof useConnectTool>
    // Omit to hide the disconnect action entirely — a connected tool then
    // renders a plain "Connected" badge instead of a "Disconnect" button.
    // NewAgentCard's "Connect your tools" section only needs a Connect
    // action, so it doesn't pass this.
    disconnectTool?: ReturnType<typeof useDisconnectTool>
}

// One tool's connect/disconnect row: icon, name, connected state, and either
// a Connect/Disconnect button (OAuth tools) or a static "Available" badge
// (direct-auth tools, which use a shared server-side credential with nothing
// to connect).
export const AgentToolRow = ({ slug, agentId, fetchedTool, connectTool, disconnectTool }: AgentToolRowProps) => {
    const display = TOOL_DISPLAY[slug]
    const Icon = display?.icon ?? LinkIcon
    const isConnected = fetchedTool?.connected ?? false
    const isConnecting = connectTool.isPending && connectTool.variables?.slug === slug
    const isDisconnecting = disconnectTool?.isPending && disconnectTool.variables?.slug === slug

    return (
        <Item variant="outline">
            <ItemMedia variant="icon">
                {fetchedTool?.logo ? (
                    <img src={fetchedTool.logo} alt="" className="size-6" />
                ) : (
                    <Icon />
                )}
            </ItemMedia>
            <ItemContent>
                <ItemTitle>{fetchedTool?.name ?? display?.label ?? slug}</ItemTitle>
                <span className={isConnected ? "text-xs text-emerald-600 dark:text-emerald-400" : "text-xs text-muted-foreground"}>
                    {isConnected ? "Connected" : "Disconnected"}
                </span>
            </ItemContent>
            <ItemActions>
                {isDirectAuthTool(slug) ? (
                    // Shared server-side credential, not a per-agent OAuth
                    // grant — nothing to connect/disconnect here.
                    <Badge variant="secondary">Available</Badge>
                ) : !disconnectTool && isConnected ? (
                    // Disconnect wasn't wired up by the caller — show status
                    // only, rather than an action that isn't supported here.
                    <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400">Connected</Badge>
                ) : (
                    <Button
                        type="button"
                        variant="success"
                        size="sm"
                        disabled={isConnecting || isDisconnecting}
                        onClick={() =>
                            isConnected && disconnectTool
                                ? disconnectTool.mutate({ agentId, slug })
                                : connectTool.mutate({ agentId, slug })
                        }
                    >
                        {(isConnecting || isDisconnecting) && <Loader2Icon className="animate-spin" />}
                        {isConnected ? "Disconnect" : "Connect"}
                    </Button>
                )}
            </ItemActions>
        </Item>
    )
}
