import { useMutation } from "@tanstack/react-query"
import { isAxiosError } from "axios"
import { toast } from "@/components/ui/toast"
import { agentConfigure, editAgent } from "../api"

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
  return useMutation({
    mutationFn: agentConfigure,
    mutationKey: ["agent-configure"],
    onSuccess: (data) => {
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
  return useMutation({
    mutationFn: editAgent,
    mutationKey: ["edit-agent"],
    onSuccess: (agent) => {
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
