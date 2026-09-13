"use client"

import { useState } from "react"
import { InboxIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ItemMedia } from "@/components/ui/item"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RunStatusBadge } from "./run-status-badge"
import { RunResultSheet } from "./run-result-sheet"
import { formatRunTimestamp } from "../format-timestamp"
import type { Run } from "../types"

/**
 * @component RunsTable
 * @description Table of agent runs — agent, task, status, last-updated time,
 * and a "View" button that opens the run's full result in a side sheet.
 * Purely presentational: takes the current page's rows as a prop, so the
 * caller owns pagination (see RunsView).
 * @param runs The rows to render — already sliced to the current page.
 */
export const RunsTable = ({ runs }: { runs: Run[] }) => {
  // Owns its own sheet state, same self-contained pattern AgentListCard uses
  // for its edit sheet/delete dialog — one shared sheet, driven by whichever
  // row's "View" button was last clicked.
  const [selectedRun, setSelectedRun] = useState<Run | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleView = (run: Run) => {
    setSelectedRun(run)
    setSheetOpen(true)
  }

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
        <InboxIcon className="size-6 text-muted-foreground" />
        <div>
          <p className="font-medium">No runs yet</p>
          <p className="text-sm text-muted-foreground">Runs will show up here once an agent executes.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <ItemMedia variant="image" className="size-8 bg-muted">
                      <img src={run.agentImage} alt={run.agentName} />
                    </ItemMedia>
                    <span className="font-medium">{run.agentName}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-70 truncate whitespace-nowrap text-muted-foreground">
                  {run.task}
                </TableCell>
                <TableCell>
                  <RunStatusBadge status={run.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatRunTimestamp(run.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => handleView(run)}>
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <RunResultSheet run={selectedRun} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  )
}
