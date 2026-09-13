import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ItemMedia } from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { RunStatusBadge } from "./run-status-badge"
import { formatRunTimestamp } from "../format-timestamp"
import type { Run } from "../types"

interface RunResultSheetProps {
  // The run to show detail for — null while nothing is selected, so the
  // sheet can stay mounted (controlled by `open`) without a run picked yet.
  run: Run | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * @component RunResultSheet
 * @description Side panel showing one agent run's full detail — agent, task,
 * status, timestamp, and its output/error text — opened from a row's "View" button.
 * @param run The run to display; sheet renders empty content if null.
 * @param open Controlled open state.
 * @param onOpenChange Called when the sheet is dismissed.
 */
export const RunResultSheet = ({ run, open, onOpenChange }: RunResultSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {run && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <ItemMedia variant="image" className="size-10 bg-muted">
                  <img src={run.agentImage} alt={run.agentName} />
                </ItemMedia>
                <div>
                  <SheetTitle>{run.agentName}</SheetTitle>
                  <SheetDescription>{formatRunTimestamp(run.updatedAt)}</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-4 overflow-y-auto px-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Status</p>
                <div className="mt-1.5">
                  <RunStatusBadge status={run.status} />
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground">Task</p>
                <p className="mt-1.5 text-sm">{run.task}</p>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground">Result</p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm">
                  {run.result ?? "No result yet — this run hasn't finished."}
                </p>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
