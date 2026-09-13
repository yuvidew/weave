import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { RunStatusBadge } from "@/features/runs/_components/run-status-badge"
import type { Run } from "@/features/runs/types"
import type { DashboardListVariant } from "../types"

// Icon tint per variant — same emerald/sky/muted/amber accents as
// dashboard-stat-cards.tsx, applied to just the icon so an empty panel still
// reads as "which kind of list is this" without a colored background.
const TINT_CLASSNAME: Record<DashboardListVariant, string> = {
  completed: "text-emerald-600 dark:text-emerald-400",
  running: "text-sky-600 dark:text-sky-400",
  attention: "text-amber-600 dark:text-amber-400",
  scheduled: "text-muted-foreground",
}

interface DashboardListPanelProps {
  title: string
  icon: LucideIcon
  emptyText: string
  runs: Run[]
  variant: DashboardListVariant
}

/**
 * @component DashboardListPanel
 * @description Shared card shell for the dashboard's 4 "what's happening"
 * lists (needs attention / running now / latest results / up next) — a
 * header with a live count badge, then either a friendly empty-state row or
 * up to 5 compact run rows. `variant` decides whether each row's right side
 * shows a RunStatusBadge or (for completed runs) the result snippet.
 */
export const DashboardListPanel = ({ title, icon: Icon, emptyText, runs, variant }: DashboardListPanelProps) => {
  const visibleRuns = runs.slice(0, 5)

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-5">
      <div className="flex items-center gap-2">
        <h3 className="font-heading font-semibold">{title}</h3>
        <Badge variant="outline">{runs.length}</Badge>
      </div>

      {visibleRuns.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
          <Icon className={cn("size-4 shrink-0", TINT_CLASSNAME[variant])} />
          {emptyText}
        </div>
      ) : (
        <div className="flex flex-col divide-y">
          {visibleRuns.map((run) => (
            <div key={run.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="truncate text-sm font-medium">{run.agentName}</p>
                <p className="truncate text-xs text-muted-foreground">{run.task}</p>
              </div>

              {variant === "completed" ? (
                <p className="line-clamp-1 max-w-40 shrink-0 text-right text-xs text-muted-foreground">
                  {run.result ?? "—"}
                </p>
              ) : (
                <RunStatusBadge status={run.status} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
