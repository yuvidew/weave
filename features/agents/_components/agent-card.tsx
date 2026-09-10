"use client"

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
import type { AgentSchedule, CreatAgentType } from "../types"

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
// or null when there's nothing to show (a manual schedule, or no time set).
const formatNextRun = (schedule: AgentSchedule): string | null => {
  if (schedule.type === "manual" || !schedule.time) return null

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
}

/**
 * @component NewAgentCard
 * @description One row in the "My Agents" list — avatar, name, status badge, description, and next-run schedule, with an edit action and an overflow menu (run now, edit, pause/activate, delete).
 * @param agent The saved agent to display.
 * @param onEdit Called with the agent when the edit button (or the overflow menu's "Edit agent") is clicked.
 * @param onRunNow Called with the agent when "Run now" is chosen from the overflow menu.
 * @param onToggleStatus Called with the agent when "Pause"/"Activate" is chosen from the overflow menu.
 * @param onDelete Called with the agent when "Delete" is chosen from the overflow menu.
 */
export const NewAgentCard = ({ agent, onEdit, onRunNow, onToggleStatus, onDelete }: NewAgentCardPropType) => {
  const statusBadge = STATUS_BADGE[agent.status]
  const nextRun = formatNextRun(agent.schedule)

  return (
    <Item variant="outline">
      <ItemMedia variant="image" className="bg-muted w-16 h-16" >
        <img src={agent.agentImage} alt={agent.name} width={50} height={50} />
      </ItemMedia>

      <ItemContent>
        <ItemTitle>
          {agent.name}
          <Badge variant="outline" className={statusBadge.className}>
            {statusBadge.label}
          </Badge>
        </ItemTitle>
        <ItemDescription>{agent.description}</ItemDescription>
        {nextRun && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={cn(
                "size-1.5 rounded-full",
                agent.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40"
              )}
            />
            <ClockIcon className="size-3.5" />
            {nextRun}
          </div>
        )}
      </ItemContent>

      <ItemActions>
        <Button variant="ghost" size="icon-sm" onClick={() => onEdit?.(agent)}>
          <PencilIcon />
          <span className="sr-only">Edit agent</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="aria-expanded:bg-muted" />}>
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRunNow?.(agent)}>
              <ZapIcon />
              <span>Run now</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit?.(agent)}>
              <PencilIcon />
              <span>Edit agent</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onToggleStatus?.(agent)}>
              {agent.status === "active" ? <PauseIcon /> : <PlayIcon />}
              <span>{agent.status === "active" ? "Pause agent" : "Activate agent"}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete?.(agent)}>
              <Trash2Icon />
              <span>Delete agent</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ItemActions>
    </Item>
  )
}
