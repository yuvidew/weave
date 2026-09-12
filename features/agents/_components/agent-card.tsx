"use client"

import { useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { ClockIcon, MoreHorizontalIcon, PauseIcon, PencilIcon, PlayIcon, Trash2Icon, ZapIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { FieldDescription, FieldTitle } from "@/components/ui/field"
import { isDirectAuthTool } from "@/constant/direct-auth-tools"
import { useAgentTools, useConnectTool } from "../hook/use-agent"
import type { AgentSchedule, CreatAgentType } from "../types"
import { AgentEditSheet } from "./agent-edit-sheet"
import { AgentToolRow } from "./agent-tool-row"

// Reuses the emerald/muted chip colors already used elsewhere in the app
// (app-sidebar.tsx, create-agent.tsx) — Badge has no built-in "success" variant.
const STATUS_BADGE: Record<CreatAgentType["status"], { label: string; className: string }> = {
  active: {
    label: "Active",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  inactive: {
    label: "Inactive",
    className: "border-border text-muted-foreground",
  },
}

// Builds the "Next run today at 9:00 AM · Runs daily" line from a schedule,
// or null when there's nothing to show (a manual schedule, no time set, or no
// schedule at all — older rows saved before a schedule was required).
const formatNextRun = (schedule: AgentSchedule | null | undefined): string | null => {
  if (!schedule || schedule.type === "manual" || !schedule.time) return null

  const [hours, minutes] = schedule.time.split(":").map(Number)
  const scheduledToday = new Date()
  scheduledToday.setHours(hours, minutes, 0, 0)
  const time = format(scheduledToday, "h:mm a")

  if (schedule.type === "once") return `Runs once at ${time}`

  // Only "daily" lets us say today vs. tomorrow with any confidence — the
  // schedule doesn't store which day of the week/month for the others.
  const isDaily = schedule.frequency === "daily"
  const day = isDaily && scheduledToday.getTime() <= Date.now() ? "tomorrow" : "today"
  const frequencyLabel = schedule.frequency ? `Runs ${schedule.frequency}` : "Runs on schedule"

  return isDaily ? `Next run ${day} at ${time} · ${frequencyLabel}` : `Next run at ${time} · ${frequencyLabel}`
}

interface NewAgentCardPropType {
  agent: CreatAgentType
  onEdit?: (agent: CreatAgentType) => void
  onRunNow?: (agent: CreatAgentType) => void
  onToggleStatus?: (agent: CreatAgentType) => void
  onDelete?: (agent: CreatAgentType) => void
  // Set only by the create-agent flow, right after this exact agent was
  // generated — gates the auto-open-first-tool-popup effect below so a
  // re-render or another render site (e.g. the edit-preview route's mock
  // agent) never triggers an OAuth popup the user didn't ask for.
  isNewlyCreated?: boolean
}

/**
 * @component NewAgentCard
 * @description One row in the "My Agents" list — avatar, name, status badge, description, and next-run schedule, with an edit action and an overflow menu (run now, edit, pause/activate, delete). Keeps its own copy of `agent` so a save in the edit sheet updates the row in place. When `isNewlyCreated`, also renders a "Connect your tools" section and auto-opens the first OAuth tool's connect popup.
 * @param agent The saved agent to display.
 * @param onEdit Called with the agent when the edit button (or the overflow menu's "Edit agent") is clicked.
 * @param onRunNow Called with the agent when "Run now" is chosen from the overflow menu.
 * @param onToggleStatus Called with the agent when "Pause"/"Activate" is chosen from the overflow menu.
 * @param onDelete Called with the agent when "Delete" is chosen from the overflow menu.
 * @param isNewlyCreated Whether this card is showing an agent that was just created — enables the auto-connect behavior.
 */
export const NewAgentCard = ({ agent, onEdit, onRunNow, onToggleStatus, onDelete, isNewlyCreated }: NewAgentCardPropType) => {
  // Local copy so a save in AgentEditSheet reflects here immediately — there's
  // no shared agents list/query yet to refetch from once "My Agents" exists.
  const [currentAgent, setCurrentAgent] = useState(agent)

  // Stay in sync if the parent passes a newer `agent` (e.g. after a future list refetch).
  useEffect(() => {
    setCurrentAgent(agent)
  }, [agent])

  const statusBadge = STATUS_BADGE[currentAgent.status]
  const nextRun = formatNextRun(currentAgent.schedule)

  // Direct-auth tools (browserbase/serpapi/google_search) use a shared
  // server-side credential and need no connect flow — only the rest belong
  // in the "Connect your tools" section.
  const connectableSlugs = (currentAgent.tools ?? []).filter((slug) => !isDirectAuthTool(slug))
  const hasConnectableTools = connectableSlugs.length > 0
  const { data: fetchedTools } = useAgentTools(currentAgent.agentId, hasConnectableTools)
  const connectTool = useConnectTool()

  // Fires the first connectable tool's connect flow exactly once, right after
  // this agent was created — a fresh agent has zero connected accounts, so
  // "first connectable slug" already means "first one that needs connecting."
  // The ref (not just the dependency array) is what stops React Strict
  // Mode's double-invoke in dev from opening two popups.
  const autoConnectFired = useRef(false)
  useEffect(() => {
    if (!isNewlyCreated || autoConnectFired.current || !hasConnectableTools) return
    autoConnectFired.current = true
    connectTool.mutate({ agentId: currentAgent.agentId, slug: connectableSlugs[0] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewlyCreated, hasConnectableTools, currentAgent.agentId])

  return (
    <div className="flex flex-col gap-3">
      <Item variant="outline">
        <ItemMedia variant="image" className="bg-muted w-16 h-16" >
          <img src={currentAgent.agentImage} alt={currentAgent.name} width={50} height={50} />
        </ItemMedia>

        <ItemContent>
          <ItemTitle>
            {currentAgent.name}
            <Badge variant="outline" className={statusBadge.className}>
              {statusBadge.label}
            </Badge>
          </ItemTitle>
          <ItemDescription>{currentAgent.description}</ItemDescription>
          {nextRun && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  currentAgent.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40"
                )}
              />
              <ClockIcon className="size-3.5" />
              {nextRun}
            </div>
          )}
        </ItemContent>

        <ItemActions>
          <AgentEditSheet agent={currentAgent} onUpdated={setCurrentAgent}>
            <Button variant="ghost" size="icon-sm" onClick={() => onEdit?.(currentAgent)}>
              <PencilIcon />
              <span className="sr-only">Edit agent</span>
            </Button>
          </AgentEditSheet>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="aria-expanded:bg-muted" />}>
              <MoreHorizontalIcon />
              <span className="sr-only">More</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onRunNow?.(currentAgent)}>
                <ZapIcon />
                <span>Run now</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.(currentAgent)}>
                <PencilIcon />
                <span>Edit agent</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onToggleStatus?.(currentAgent)}>
                {currentAgent.status === "active" ? <PauseIcon /> : <PlayIcon />}
                <span>{currentAgent.status === "active" ? "Pause agent" : "Activate agent"}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete?.(currentAgent)}>
                <Trash2Icon />
                <span>Delete agent</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ItemActions>
      </Item>

      {hasConnectableTools && (
        <div className="rounded-xl border p-4">
          <FieldTitle>Connect your tools</FieldTitle>
          <FieldDescription>
            {isNewlyCreated
              ? "We've started connecting the first tool below — finish any others so this agent can actually use them."
              : "This agent needs these tools connected before it can use them."}
          </FieldDescription>
          <div className="mt-3 flex flex-col gap-2">
            {connectableSlugs.map((slug) => (
              <AgentToolRow
                key={slug}
                slug={slug}
                agentId={currentAgent.agentId}
                fetchedTool={fetchedTools?.find((tool) => tool.slug === slug)}
                connectTool={connectTool}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
