import axios from "axios"
import type {
  AgentConfigResponse,
  AgentToolsResponse,
  ChatHistoryResponse,
  ConnectToolResponse,
  CreatAgentType,
  deleteAgentType,
  ResolveToolCallResponse,
  RunAgentNowResponse,
  SendChatMessageResponse,
} from "../types"
import { getBrowserTimezone } from "@/lib/utils"

// Calls the agent-config generation endpoint with the user's prompt (on a
// clarification follow-up, the caller appends prior answers to the prompt
// before calling this again) and returns the parsed AI response.
export const agentConfigure = async (prompt: string) => {
  const timezone = getBrowserTimezone()
  const { data } = await axios.post<AgentConfigResponse>("/api/agent/configure", { prompt, timezone })

  return data
}

// Updates an existing agent's config. `agentId` identifies which row to
// update server-side — the PUT route scopes the update to it (and the
// signed-in user), so it must be sent alongside the edited fields.
export const editAgent = async ({ agentId, agentConfig }: { agentId: string; agentConfig: Partial<CreatAgentType> }) => {
  const { data } = await axios.put<CreatAgentType>("/api/agent/configure", { agentId, agentConfig })

  return data
}

export const allAgents = async () => {
  const { data } = await axios.get<CreatAgentType[]>("/api/agent/configure")

  return data
}

// Fetches an agent's tools with their real name/logo/connected state, resolved
// against its Pipedream Connect account.
export const getAgentTools = async (agentId: string) => {
  const { data } = await axios.get<AgentToolsResponse>("/api/agent/tools", {
    params: { agentId },
  })

  return data.tools
}

// Mints a Pipedream Connect token for one agent/tool pair and returns the
// hosted Connect Link URL to open — the caller (useConnectTool) opens it in
// a new tab so the user can run that tool's OAuth flow.
export const createToolConnectUrl = async ({ agentId, slug }: { agentId: string; slug: string }) => {
  const { data } = await axios.post<ConnectToolResponse>("/api/agent/tools/connect", { agentId, slug })

  return data.url
}

// Removes the agent's connected account for one tool.
export const disconnectTool = async ({ agentId, slug }: { agentId: string; slug: string }) => {
  const { data } = await axios.delete<{ success: boolean }>("/api/agent/tools/connect", {
    data: { agentId, slug },
  })

  return data
}

// Loads an agent's full chat transcript, oldest first.
export const getChatHistory = async (agentId: string) => {
  const { data } = await axios.get<ChatHistoryResponse>("/api/agent/chat", { params: { agentId } })

  return data.messages
}

// Sends a chat message and returns the agent's newest reply — which may
// itself be a pending tool-call approval card rather than plain text; the
// caller renders based on `message.toolCalls`.
export const sendChatMessage = async ({ agentId, message }: { agentId: string; message: string }) => {
  const { data } = await axios.post<SendChatMessageResponse>("/api/agent/chat", { agentId, message })

  return data.message
}

// Approves or rejects one pending tool call and returns the agent's
// follow-up reply once every call in that batch has settled.
export const resolveToolCall = async (params: {
  agentId: string
  messageId: number
  toolCallId: string
  decision: "approve" | "reject"
}) => {
  const { data } = await axios.post<ResolveToolCallResponse>("/api/agent/chat/resolve", params)

  return data.message
}

// Deletes an agent and its scheduled runs. `agentName` isn't sent to the
// API — it's only carried through as a mutation variable so useDeleteAgent's
// onSuccess can toast the agent's name without the DELETE response (which is
// just `{ message }`) needing to include the full row.
export const deleteAgent = async ({ agentId }: { agentId: string; agentName: string }) => {
  const { data } = await axios.delete<deleteAgentType>("/api/agent/configure", {
    data: { agentId },
  })

  return data
}

export const updateAgent = async ({ agentId, agentConfig }: { agentId: string; agentConfig: Partial<CreatAgentType> }) => {
  const { data } = await axios.put<CreatAgentType>("/api/agent/configure", { agentId, agentConfig })

  return data
}

// Queues an immediate run for one agent, outside its normal schedule.
export const runAgentNow = async ({ agentId }: { agentId: string; agentName: string }) => {
  const { data } = await axios.post<RunAgentNowResponse>("/api/agent/run", { agentId })

  return data
}