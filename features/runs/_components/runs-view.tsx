"use client"

import { useState } from "react"
import { isAxiosError } from "axios"
import { Loader2Icon } from "lucide-react"
import { TablePagination } from "@/components/table-pagination"
import { useGetLogs } from "../hook/use-logs"
import { RunsStats } from "./runs-stats"
import { RunsTable } from "./runs-table"

// Rows fetched per page — sent straight through to GET /api/logs.
const PAGE_SIZE = 10

/**
 * @component RunsView
 * @description Agent Runs page — summary stat cards plus a paginated table
 * of the signed-in user's agent runs, backed by GET /api/logs.
 */
export const RunsView = () => {
  const [page, setPage] = useState(1)
  const { data, isPending, isError, error } = useGetLogs(page, PAGE_SIZE)

  const totalPages = Math.ceil((data?.totalCount ?? 0) / PAGE_SIZE)

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="font-bold text-3xl">Agent Runs</h2>
        <p>See what your agents are working on and review their results.</p>
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 rounded-xl border p-4 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading your runs…
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {isAxiosError<{ error?: string }>(error) && error.response?.data?.error
            ? error.response.data.error
            : "Something went wrong loading your runs. Please try again."}
        </div>
      ) : (
        <>
          <RunsStats counts={data.statusCounts} />

          <div className="flex flex-col gap-4">
            <h3 className="font-heading text-xl font-semibold">Recent Runs</h3>
            <RunsTable runs={data.logs} />
            <TablePagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}
    </section>
  )
}
