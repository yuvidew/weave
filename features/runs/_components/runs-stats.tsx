import { cn } from "@/lib/utils"
import type { RunStatusCounts } from "../types"

// Dot color per stat — independent of RunStatusBadge's palette since this is
// a summary chip (colored dot + count), not a status label.
const STATS: { label: string; status: keyof RunStatusCounts; dotClassName: string }[] = [
  { label: "Completed", status: "completed", dotClassName: "bg-emerald-500" },
  { label: "Failed", status: "failed", dotClassName: "bg-red-500" },
  { label: "Scheduled", status: "scheduled", dotClassName: "bg-blue-500" },
]

/**
 * @component RunsStats
 * @description Row of summary cards — completed/failed/scheduled counts across
 * *all* of the user's runs (not just the current page), each as a colored dot
 * + label on the left and the count on the right.
 * @param counts Per-status totals, straight from GET /api/logs's `statusCounts`.
 */
export const RunsStats = ({ counts }: { counts: RunStatusCounts }) => {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {STATS.map(({ label, status, dotClassName }) => (
        <div
          key={status}
          className="flex items-center justify-between rounded-xl border px-5 py-4"
        >
          <div className="flex items-center gap-2">
            <span className={cn("size-2.5 shrink-0 rounded-full", dotClassName)} />
            <span className="font-medium">{label}</span>
          </div>
          <span className="text-base font-semibold">{counts[status]}</span>
        </div>
      ))}
    </div>
  )
}
