"use client"

import { useState } from "react"
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
import { ItemMedia } from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import type { AgentSchedule, CreatAgentType } from "../types"
import { AgentEditSheet } from "./agent-edit-sheet"

// Same emerald/muted chip colors used by NewAgentCard (agent-card.tsx) — Badge
// has no built-in "success" variant.
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

// Uppercases the first letter — used for the schedule frequency label.
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

// Turns a schedule into the short label shown under the card ("Daily at 21:22",
// "Once at 14:00", or "On demand" for manual/unset schedules). Uses the raw
// HH:mm string as-is (24-hour) rather than reformatting it, matching the
// reference design. `schedule` can be null/undefined for older rows saved
// before a schedule was required, so that's treated the same as "manual".
const formatScheduleLabel = (schedule: AgentSchedule | null | undefined): string => {
  if (!schedule || schedule.type === "manual" || !schedule.time) return "On demand"

  const frequencyLabel = schedule.type === "once" ? "Once" : capitalize(schedule.frequency || "scheduled")
  return `${frequencyLabel} at ${schedule.time}`
}

interface AgentListCardProps {
  agent: CreatAgentType
  onEdit?: (agent: CreatAgentType) => void
  onToggleStatus?: (agent: CreatAgentType) => void
  onRunNow?: (agent: CreatAgentType) => void
  onDelete?: (agent: CreatAgentType) => void
}

/**
 * @component AgentListCard
 * @description One card in the "My Agents" grid — avatar with a status dot, name, active/inactive badge, description, schedule, and a full-width "Run agent" action, plus an overflow menu for pause/activate and delete.
 * @param agent The saved agent to display.
 * @param onEdit Called with the freshly-saved agent once the edit sheet's save succeeds.
 * @param onToggleStatus Called with the agent when "Pause agent"/"Activate agent" is chosen.
 * @param onRunNow Called with the agent when "Run agent" is clicked.
 * @param onDelete Called with the agent when "Delete agent" is chosen.
 */
export const AgentListCard = ({ agent, onEdit, onToggleStatus, onRunNow, onDelete }: AgentListCardProps) => {
  // Edit sheet is opened from a DropdownMenuItem, which isn't a real <button> —
  // Base UI's sheet trigger can't merge its click handling onto one, so this
  // drives AgentEditSheet in controlled mode instead of using it as a trigger.
  const [editOpen, setEditOpen] = useState(false)
  const statusBadge = STATUS_BADGE[agent.status]
  const scheduleLabel = formatScheduleLabel(agent.schedule)

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-5 text-sm ring-1 ring-foreground/10">
      <div className="flex items-start justify-between">
        <div className="relative">
          <ItemMedia variant="image" className="size-12 bg-muted">
            <img src={agent.agentImage} alt={agent.name} />
          </ItemMedia>
          {/* Small online/active indicator overlapping the avatar's corner. */}
          <span
            className={cn(
              "absolute -right-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-background",
              agent.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40"
            )}
          />
        </div>

        <div className="flex items-center">
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
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
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
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span className="line-clamp-1 font-medium">{agent.name}</span>
          <Badge variant="outline" className={cn("shrink-0", statusBadge.className)}>
            {statusBadge.label}
          </Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-muted-foreground">{agent.description}</p>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ClockIcon className="size-3.5" />
        {scheduleLabel}
      </div>

      <Separator />

      <Button
        className="w-full"
        onClick={() => onRunNow?.(agent)}
      >
        <PlayIcon />
        Run agent
      </Button>

      <AgentEditSheet agent={agent} onUpdated={onEdit} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  )
}
