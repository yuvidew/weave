// Mirrors the values actually written to `AgentRun.status` by the Inngest
// functions that execute runs (see inngest/functions.ts).
export type RunStatus = "scheduled" | "running" | "completed" | "failed" | "skipped"

// Shape of one row in the runs table — this is exactly what `GET /api/logs`
// returns per row (see app/api/logs/route.ts), already flattened from its
// `AgentRun` + `AgentConfig` join so the table/sheet components don't need to
// know about the underlying DB shape.
export interface Run {
  id: string
  agentId: string
  agentName: string
  agentImage: string
  task: string
  status: RunStatus
  updatedAt: string
  // Output text on success, error text on failure — null while still scheduled/running.
  result: string | null
}

// Per-status totals across *all* of the user's runs (not just the current
// page) — powers RunsStats' summary cards.
export interface RunStatusCounts {
  completed: number
  failed: number
  scheduled: number
}

// Full response from `GET /api/logs?page=&pageSize=`.
export interface LogsResponse {
  logs: Run[]
  totalCount: number
  page: number
  pageSize: number
  statusCounts: RunStatusCounts
}
