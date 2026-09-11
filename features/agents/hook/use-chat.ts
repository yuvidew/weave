import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { isAxiosError } from "axios"
import { toast } from "@/components/ui/toast"
import { getChatHistory, resolveToolCall, sendChatMessage } from "../api"

// Pulls the server's `{ error }` message out of a failed request, falling
// back to a generic message for network errors or anything unexpected.
// Duplicated from use-agent.ts rather than shared — keeping chat's mutations
// self-contained here matches how this file is split from use-agent.ts in
// the first place.
const getErrorMessage = (error: unknown, fallback: string) =>
  isAxiosError<{ error?: string }>(error) && error.response?.data?.error
    ? error.response.data.error
    : fallback

// Loads an agent's chat transcript. `enabled` is threaded through explicitly
// so the fetch only fires while ChatSheet is actually open, matching
// useAgentTools's enabled-gated pattern in use-agent.ts.
export const useChatMessages = (agentId: string, enabled: boolean) => {
  return useQuery({
    queryFn: () => getChatHistory(agentId),
    queryKey: ["chat-messages", agentId],
    enabled: enabled && !!agentId,
  })
}

// Sends a chat message. No optimistic cache write — ChatSheet renders the
// just-sent text straight from this mutation's own `variables` while it's
// pending, so a plain invalidate-on-success is enough to bring in both the
// persisted user message and the agent's reply.
export const useSendChatMessage = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: sendChatMessage,
    mutationKey: ["send-chat-message"],
    onSuccess: (_message, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", agentId] })
    },
    onError: (error) => {
      toast.add({
        title: "Message failed",
        description: getErrorMessage(error, "Something went wrong sending that message. Please try again."),
        type: "error",
      })
    },
  })
}

// Approves or rejects one pending tool call.
export const useResolveToolCall = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: resolveToolCall,
    mutationKey: ["resolve-tool-call"],
    onSuccess: (_message, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", agentId] })
    },
    onError: (error) => {
      toast.add({
        title: "Couldn't record your decision",
        description: getErrorMessage(error, "Something went wrong. Please try again."),
        type: "error",
      })
    },
  })
}
