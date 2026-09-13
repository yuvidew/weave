"use client"

import { isAxiosError } from "axios"
import { AlertTriangleIcon, CalendarClockIcon, CheckCircle2Icon, Loader2Icon, ZapIcon } from "lucide-react"
import { useAllAgents } from "@/features/agents/hook/use-agent"
import { useGetLogs } from "@/features/runs/hook/use-logs"
import type { Run } from "@/features/runs/types"
import { DashboardHeader } from "./dashboard-header"
import { DashboardListPanel } from "./dashboard-list-panel"
import { DashboardStatCards } from "./dashboard-stat-cards"
import { RecentAgentCard } from "./recent-agent-card"

// Rows fetched for the dashboard's lists — there's no dedicated "recent
// activity" endpoint, so this pulls a generously sized page of GET /api/logs
// and filters it client-side per status instead of paginating.
const LOGS_PAGE_SIZE = 50

// How often the dashboard silently refetches in the background — there's no
// realtime push for run/agent status, so polling is how "live" counts stay
// live without a manual refresh action.
const AUTO_REFRESH_MS = 30_000

/**
 * @component DashboardView
 * @description Dashboard home — greeting header, 4 stat tiles, a spotlight on
 * the most recently updated agent, and 4 "what's happening" lists (needs
 * attention / running now / latest results / up next). Sourced entirely from
 * the existing GET /api/logs and GET /api/agent/configure hooks, both polled
 * every AUTO_REFRESH_MS so the page stays current with no manual refresh —
 * there's no dedicated dashboard-summary endpoint yet, so "running" is
 * approximated from the fetched page and "attention" maps to failed runs.
 */
export const DashboardView = () => {
  const { data: logsData, isPending: isLogsPending, isError: isLogsError, error: logsError } = useGetLogs(1, LOGS_PAGE_SIZE, {
    refetchInterval: AUTO_REFRESH_MS,
  })
  const { data: agents, isPending: isAgentsPending, isError: isAgentsError } = useAllAgents({
    refetchInterval: AUTO_REFRESH_MS,
  })

  const runs = logsData?.logs ?? []
  const byStatus = (status: Run["status"]) => runs.filter((run) => run.status === status)
  // RunStatusCounts (statusCounts) has no global "running" total, so this
  // counts running rows in the fetched page instead — best-effort, not a
  // true site-wide count. See features/runs/types.ts.
  const runningRuns = byStatus("running")

  // Most recently touched agent — falls back to createdAt for agents that
  // have never been edited since creation.
  const recentAgent = agents
    ?.slice()
    .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())[0]

  return (
    <div className="flex flex-col gap-6">
      <DashboardHeader />

      <DashboardStatCards
        completed={logsData?.statusCounts.completed ?? 0}
        running={runningRuns.length}
        scheduled={logsData?.statusCounts.scheduled ?? 0}
        attention={logsData?.statusCounts.failed ?? 0}
        isPending={isLogsPending}
        isError={isLogsError}
      />

      <RecentAgentCard agent={recentAgent} isPending={isAgentsPending} isError={isAgentsError} />

      {isLogsPending ? (
        <div className="flex items-center gap-2 rounded-xl border p-4 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading your runs…
        </div>
      ) : isLogsError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {isAxiosError<{ error?: string }>(logsError) && logsError.response?.data?.error
            ? logsError.response.data.error
            : "Something went wrong loading your runs. Please try again."}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <DashboardListPanel
            title="Needs your attention"
            icon={AlertTriangleIcon}
            emptyText="No runs need attention right now."
            runs={byStatus("failed")}
            variant="attention"
          />
          <DashboardListPanel
            title="Running now"
            icon={ZapIcon}
            emptyText="No agents are running right now."
            runs={runningRuns}
            variant="running"
          />
          <DashboardListPanel
            title="Latest results"
            icon={CheckCircle2Icon}
            emptyText="Completed run results will appear here."
            runs={byStatus("completed")}
            variant="completed"
          />
          <DashboardListPanel
            title="Up next"
            icon={CalendarClockIcon}
            emptyText="Scheduled runs will appear here."
            runs={byStatus("scheduled")}
            variant="scheduled"
          />
        </div>
      )}
    </div>
  )
}
