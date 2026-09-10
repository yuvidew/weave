"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { AGENT_LIMIT } from "@/db/schema"

/**
 * @component AgentUsageDialog
 * @description Modal showing how many agents the user has created against their plan limit, with a progress bar.
 * @param used Number of agents already created.
 * @param limit Plan's max agent count; defaults to `AGENT_LIMIT`.
 */
export const AgentUsageDialog = ({
  open,
  onOpenChange,
  used,
  limit = AGENT_LIMIT,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  used: number
  limit?: number
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agents</DialogTitle>
          <DialogDescription>
            Agents you&apos;ve created on your current plan.
          </DialogDescription>
        </DialogHeader>
        {/* Section 1: agent count */}
        <div className="flex items-baseline gap-1.5 rounded-lg border bg-muted/40 p-3">
          <span className="text-2xl font-semibold tabular-nums">{used}</span>
          <span className="text-sm text-muted-foreground">
            of {limit} agents created
          </span>
        </div>

        {/* Section 2: progress (0-100 scale, number label shows used/limit) */}
        <Progress value={limit > 0 ? (used / limit) * 100 : 0} max={100}>
          <div className="flex w-full items-center justify-between">
            <ProgressLabel>Progress</ProgressLabel>
            <ProgressValue>{() => limit > 0 ? (used / limit) * 100 : 0}</ProgressValue>
          </div>
        </Progress>
      </DialogContent>
    </Dialog>
  )
}
