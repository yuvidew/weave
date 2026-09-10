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

