"use client"

import { isAxiosError } from "axios"
import { Loader2Icon, SparklesIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useAllAgents, useToggleAgentStatus } from "../hook/use-agent"
import type { CreatAgentType } from "../types"
import { AgentListCard } from "./agent-list-card"

/**
 * @component MyAgents
 * @description Grid of the signed-in user's saved agents — loading/error/empty states plus a responsive card grid, backed by GET /api/agent/configure.
 * @param onCreateAgent Called when the empty state's "Create an agent" button is clicked, so the parent can switch to the Create Agent tab.
 */
export const MyAgents = ({ onCreateAgent }: { onCreateAgent?: () => void }) => {
  const { data: agents, isPending, isError, error } = useAllAgents()
  const { mutate: toggleStatus } = useToggleAgentStatus()

  // Flips an agent's status by sending the opposite value to the shared edit endpoint.
  const handleToggleStatus = (agent: CreatAgentType) => {
    toggleStatus({
      agentId: agent.agentId,
      agentConfig: { status: agent.status === "active" ? "inactive" : "active" },
    })
  }

  // "Run now" and "Delete" have no backend endpoint yet — surface that
  // honestly instead of pretending the action happened.
  const handleRunNow = () => {
    toast.add({ title: "Coming soon", description: "Running an agent on demand isn't available yet.", type: "info" })
  }

  const handleDelete = () => {
    toast.add({ title: "Coming soon", description: "Deleting agents isn't available yet.", type: "info" })
  }

  return (
    <div className="mt-5 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold">My Agents</h1>
          <p className="text-sm text-muted-foreground">Run, manage, and update all the agents you&apos;ve created.</p>
        </div>
        {!isPending && !isError && agents && agents.length > 0 && (
          <Badge variant="secondary">{agents.length} agent{agents.length === 1 ? "" : "s"}</Badge>
        )}
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 rounded-xl border p-4 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading your agents…
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {isAxiosError<{ error?: string }>(error) && error.response?.data?.error
            ? error.response.data.error
            : "Something went wrong loading your agents. Please try again."}
        </div>
      ) : !agents || agents.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <SparklesIcon className="size-6 text-muted-foreground" />
          <div>
            <p className="font-medium">No agents yet</p>
            <p className="text-sm text-muted-foreground">Create your first agent to see it here.</p>
          </div>
          {onCreateAgent && (
            <Button size="sm" onClick={onCreateAgent}>
              Create an agent
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {agents.map((agent) => (
            <AgentListCard
              key={agent.agentId}
              agent={agent}
              onToggleStatus={handleToggleStatus}
              onRunNow={handleRunNow}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
