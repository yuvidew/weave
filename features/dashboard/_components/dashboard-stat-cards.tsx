import { AlertTriangleIcon, CalendarClockIcon, CheckCircle2Icon, ZapIcon, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface StatTile {
  key: "completed" | "running" | "scheduled" | "attention"
  label: string
  sublabel: string
  icon: LucideIcon
  // Soft icon-chip tint — same emerald/sky/muted/amber accents used by
  // RunStatusBadge and agent-card.tsx's STATUS_BADGE, just applied to a
  // rounded-square instead of a pill.
  tintClassName: string
}

const TILES: StatTile[] = [
  {
    key: "completed",
    label: "Completed",
    sublabel: "finished runs",
    icon: CheckCircle2Icon,
    tintClassName: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "running",
    label: "Running",
    sublabel: "active agents",
    icon: ZapIcon,
    tintClassName: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    key: "scheduled",
    label: "Scheduled",
    sublabel: "coming up",
    icon: CalendarClockIcon,
    tintClassName: "bg-muted text-muted-foreground",
  },
  {
    key: "attention",
    label: "Attention",
    sublabel: "need review",
    icon: AlertTriangleIcon,
    tintClassName: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
]

interface DashboardStatCardsProps {
  completed: number
  running: number
  scheduled: number
  attention: number
  isPending: boolean
  isError: boolean
}

/**
 * @component DashboardStatCards
 * @description Row of 4 at-a-glance tiles — completed/running/scheduled/needs-
 * attention counts — each with a tinted icon chip and a big number. Same
 * completed/running/scheduled/failed→attention breakdown RunsStats uses, just
 * a bigger tile treatment for the dashboard's summary row. Handles its own
 * loading/error rows so it stays in place in the page layout regardless of
 * how long GET /api/logs takes.
 */
export const DashboardStatCards = ({ completed, running, scheduled, attention, isPending, isError }: DashboardStatCardsProps) => {
  const counts: Record<StatTile["key"], number> = { completed, running, scheduled, attention }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Something went wrong loading your run counts. Please try again.
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {TILES.map(({ key, label, sublabel, icon: Icon, tintClassName }) =>
        isPending ? (
          <div key={key} className="flex flex-col gap-3 rounded-xl border p-5">
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          </div>
        ) : (
          <div key={key} className="flex flex-col gap-3 rounded-xl border p-5">
            <div className="flex items-center justify-between">
              <span className={cn("flex size-9 items-center justify-center rounded-lg", tintClassName)}>
                <Icon className="size-4.5" />
              </span>
              <span className="text-2xl font-semibold">{counts[key]}</span>
            </div>
            <div>
              <p className="font-medium">{label}</p>
              <p className="text-sm text-muted-foreground">{sublabel}</p>
            </div>
          </div>
        )
      )}
    </div>
  )
}
