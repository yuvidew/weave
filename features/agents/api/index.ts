import axios from "axios"
import type { AgentConfigResponse } from "../types"

// Calls the agent-config generation endpoint with the user's prompt (on a
// clarification follow-up, the caller appends prior answers to the prompt
// before calling this again) and returns the parsed AI response.
export const agentConfigure = async (prompt: string) => {
  const { data } = await axios.post<AgentConfigResponse>("/api/agent/configure", { prompt })

  return data
}
