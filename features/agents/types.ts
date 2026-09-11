// Shape of a clarification question, mirroring the "type" enum in
// constant/response_schema.ts's clarificationQuestions items.
export type ClarificationQuestionType = "text" | "single_select" | "multi_select" | "number" | "date" | "time"

// One question the AI needs answered before it can finish the agent config.
export type ClarificationQuestion = {
  id: string
  question: string
  type: ClarificationQuestionType
  options: string[]
  allowCustom: boolean
  customPlaceholder: string
}

export type ScheduleType = "manual" | "once" | "recurring"
export type ScheduleFrequency = "daily" | "weekly" | "monthly" | "hourly"

export type AgentSchedule = {
  time: string;
  type: ScheduleType;
  frequency: ScheduleFrequency;
  date?: string;
  timezone?: string
  dayOfWeak?: string[]
}

// The fully generated agent configuration — present only when status is "ready".
export type AgentConfig = {
  name: string
  description: string
  objective: string
  instructions: string
  tools: string[]
  skills: string[]
  schedule: AgentSchedule
  outputFormat: string
}

export type AgentConfigStatus = "ready" | "needs_clarification"

// Response body of POST /api/agent/configure — matches the "Response contract"
// documented in constant/prompts.ts and enforced by constant/response_schema.ts.
// `agent` is only present once `status` is "ready" — it's the row actually
// saved to the DB (with its id/agentId/status/timestamps), as opposed to
// `config`, which is just the AI's raw pre-save output.
export type AgentConfigResponse = {
  status: AgentConfigStatus
  clarificationQuestions: ClarificationQuestion[]
  config: AgentConfig | null
  agent?: CreatAgentType
}

export type toolType = {
  name : string;
  connected : boolean;
  slug : string
  logo : string
  connectedAccountId : string | null
}

// Body of GET /api/agent/tools?agentId=... — per-slug tool info (name/logo/
// connected state) resolved against the agent's Pipedream Connect account.
export type AgentToolsResponse = {
  tools: toolType[]
}

// Body of POST /api/agent/tools/connect — the hosted Connect Link URL to open
// so the user can run that tool's OAuth flow.
export type ConnectToolResponse = {
  url: string
}

export type CreatAgentType = {
  id: number;
  userEmail: string;
  agentId: string;
  name: string;
  agentImage: string;
  description: string;
  instructions: string;
  objective: string;
  tools: string[];
  skills: string[];
  schedule: AgentSchedule;
  outputFormat: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

// Every editable field lives on one object instead of a useState per field —
// keeps the (un)seed/reset logic in one place and each update a single setForm call.
export type AgentFormState = {
    name: string
    agentImage: string
    prompt: string
    instructions: string
    outputFormat: string
    schedule: AgentSchedule
    skills: string[]
    newSkill: string
}

// Lifecycle of one tool call an agent requested during chat — mirrors
// db/schema.ts's chatMessages.toolCalls and app/api/agent/chat/_lib.ts's
// StoredToolCall. "pending" means it needs the user's approval before it
// runs (see ChatSheet's approval card).
export type ChatToolCallStatus = "pending" | "approved" | "rejected" | "done" | "error"

export type ChatToolCall = {
  id: string
  name: string
  arguments: Record<string, unknown>
  label: string
  needsApproval: boolean
  status: ChatToolCallStatus
  result?: unknown
  error?: string
}

export type ChatMessageRole = "user" | "assistant" | "tool"

// One row from the chatMessages table (GET/POST /api/agent/chat).
export type ChatMessageRow = {
  id: number
  agentId: string
  role: ChatMessageRole
  content: string | null
  toolCallId: string | null
  toolCalls: ChatToolCall[] | null
  createdAt: string
}

export type ChatHistoryResponse = { messages: ChatMessageRow[] }
export type SendChatMessageResponse = { message: ChatMessageRow }
export type ResolveToolCallResponse = { message: ChatMessageRow }
