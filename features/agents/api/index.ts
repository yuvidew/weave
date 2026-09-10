import axios from "axios"
import type { AgentConfigResponse, CreatAgentType } from "../types"

// Calls the agent-config generation endpoint with the user's prompt (on a
// clarification follow-up, the caller appends prior answers to the prompt
// before calling this again) and returns the parsed AI response.
export const agentConfigure = async (prompt: string) => {
  const { data } = await axios.post<AgentConfigResponse>("/api/agent/configure", { prompt })

  return data
}

// Updates an existing agent's config. `agentId` identifies which row to
// update server-side — the PUT route scopes the update to it (and the
// signed-in user), so it must be sent alongside the edited fields.
export const editAgent = async ({ agentId, agentConfig }: { agentId: string; agentConfig: Partial<CreatAgentType> }) => {
  const { data } = await axios.put<CreatAgentType>("/api/agent/configure", { agentId, agentConfig })

  return data
}