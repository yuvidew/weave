import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { RunStatus } from "../types"

// Color per status — same emerald/muted-chip technique as agent-list-card.tsx's
// STATUS_BADGE, extended to the full set of statuses AgentRun actually writes
// (see inngest/functions.ts).
const STATUS_BADGE: Record<RunStatus, { label: string; className: string }> = {
  completed: {
    label: "Completed",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  running: {
    label: "Running",
    className:
      "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:border-sky-500/20 dark:bg-sky-500/15 dark:text-sky-400",
  },
  scheduled: {
    label: "Scheduled",
    className: "border-border text-muted-foreground",
  },
  failed: {
    label: "Failed",
    className:
      "border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/20 dark:bg-destructive/15",
  },
  skipped: {
    label: "Skipped",
    className: "border-border text-muted-foreground",
  },
}

/**
 * @component RunStatusBadge
 * @description Colored badge for one AgentRun status — completed/running/scheduled/failed/skipped.
 * @param status The run's current status.
 */
export const RunStatusBadge = ({ status }: { status: RunStatus }) => {
  const { label, className } = STATUS_BADGE[status]
  return (
    <Badge variant="outline" className={cn("shrink-0", className)}>
      {label}
    </Badge>
  )
}
