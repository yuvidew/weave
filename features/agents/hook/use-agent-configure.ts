import { useMutation } from "@tanstack/react-query"
import { agentConfigure } from "../api"

// Wraps agentConfigure in a mutation so CreateAgent gets loading/error state
// for free and can trigger a generation call imperatively from the submit button.
export const useAgentConfigure = () => {
  return useMutation({
    mutationFn: agentConfigure,
  })
}
