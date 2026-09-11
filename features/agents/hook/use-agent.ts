import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { isAxiosError } from "axios"
import { toast } from "@/components/ui/toast"
import { agentConfigure, allAgents, createToolConnectUrl, disconnectTool, editAgent, getAgentTools } from "../api"

// Pulls the server's `{ error }` message out of a failed request, falling
// back to a generic message for network errors or anything unexpected.
const getErrorMessage = (error: unknown, fallback: string) =>
  isAxiosError<{ error?: string }>(error) && error.response?.data?.error
    ? error.response.data.error
    : fallback

// Wraps agentConfigure in a mutation so CreateAgent gets loading/error state
// for free and can trigger a generation call imperatively from the submit
// button. Only toasts success once the agent is actually ready — a
// "needs_clarification" response is still a successful call, but AiAgentQues
// already surfaces that inline, so a toast there would just be noise.
export const useAgentConfigure = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: agentConfigure,
    mutationKey: ["agent-configure"],
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["all-agents"] })
      if (data.status === "ready" && data.agent) {
        toast.add({
          title: "Agent created",
          description: `${data.agent.name} is ready.`,
          type: "success",
        })
      }
    },
    onError: (error) => {
      toast.add({
        title: "Couldn't create agent",
        description: getErrorMessage(
          error,
          "Something went wrong generating the agent config. Please try again."
        ),
        type: "error",
      })
    },
  })
}

// Wraps editAgent in a mutation so AgentEditSheet gets loading/error state
// for free and can trigger a save imperatively from the "Save changes" button.
export const useEditAgent = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: editAgent,
    mutationKey: ["edit-agent"],
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ["all-agents"] })
      toast.add({
        title: "Agent updated",
        description: `${agent.name} was saved.`,
        type: "success",
      })
    },
    onError: (error) => {
      toast.add({
        title: "Couldn't save changes",
        description: getErrorMessage(
          error,
          "Something went wrong saving your changes. Please try again."
        ),
        type: "error",
      })
    },
  })
}


export const useAllAgents = () =>{
  return useQuery({
    queryFn : allAgents,
    queryKey : ["all-agents"]
  })
}

// Fetches an agent's real tool data (name/logo/connected state) for the edit
// sheet. `enabled` is threaded in explicitly so the fetch — which calls
// Pipedream server-side — only fires while the sheet is open, not on every
// render of a list of agent cards.
export const useAgentTools = (agentId: string, enabled: boolean) => {
  return useQuery({
    queryFn: () => getAgentTools(agentId),
    queryKey: ["agent-tools", agentId],
    enabled: enabled && !!agentId,
  })
}

// Starts a tool's Connect flow: mints a token server-side and opens the
// returned Connect Link URL in a new tab. No manual "refetch on return"
// plumbing needed — the query client's default `refetchOnWindowFocus`
// re-runs useAgentTools as soon as the user comes back to this tab.
export const useConnectTool = () => {
  return useMutation({
    mutationFn: createToolConnectUrl,
    mutationKey: ["connect-tool"],
    onSuccess: (url) => {
      window.open(url, "_blank", "noopener,noreferrer")
    },
    onError: (error) => {
      toast.add({
        title: "Couldn't start the connect flow",
        description: getErrorMessage(error, "Something went wrong starting that tool's connect flow. Please try again."),
        type: "error",
      })
    },
  })
}

// Disconnects one agent/tool pair, then refetches its row in the sheet.
export const useDisconnectTool = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: disconnectTool,
    mutationKey: ["disconnect-tool"],
    onSuccess: (_data, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ["agent-tools", agentId] })
    },
    onError: (error) => {
      toast.add({
        title: "Couldn't disconnect",
        description: getErrorMessage(error, "Something went wrong disconnecting that tool. Please try again."),
        type: "error",
      })
    },
  })
}

// Flips an agent's active/inactive status via the existing edit endpoint,
// then refetches the My Agents list so the card reflects the new state.
export const useToggleAgentStatus = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: editAgent,
    mutationKey: ["toggle-agent-status"],
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ["all-agents"] })
      toast.add({
        title: agent.status === "active" ? "Agent activated" : "Agent paused",
        description: `${agent.name} is now ${agent.status}.`,
        type: "success",
      })
    },
    onError: (error) => {
      toast.add({
        title: "Couldn't update status",
        description: getErrorMessage(
          error,
          "Something went wrong updating the agent's status. Please try again."
        ),
        type: "error",
      })
    },
  })
}