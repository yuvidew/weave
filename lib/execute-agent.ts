import { AgentConfig, chatMessages, db } from "@/db";
import { getConnectedTools } from "@/lib/agent-tools";
import { runChatTurn } from "@/app/api/agent/chat/_lib";
import { asc, eq } from "drizzle-orm";
import type { CreatAgentType } from "@/features/agents/types";

// Told to every scheduler-triggered run so the model treats it as a
// fire-and-forget execution instead of a live chat turn awaiting the user's
// reply. Without this, `buildAgentChatSystemPrompt` frames every turn as an
// interactive conversation ("the user is talking to you right now"), so the
// model tends to just describe what it would do — or even claim it already
// happened — instead of actually calling the tool. Shared by every caller of
// `executeAgent` (currently both Inngest scheduler functions) so they can't
// drift apart.
export const SCHEDULED_RUN_INSTRUCTION = `This run was triggered automatically by the scheduler — there is no user present to reply.
Do not ask questions, do not wait for confirmation, and do not just describe or claim what you did.
If a tool is available for the required action (e.g. posting a message), you must actually call it now — a text-only reply that only describes or restates the task, or claims success without a real tool call, is not sufficient and will be treated as a failed run.
Do not create, schedule, repeat, automate, or ask how to schedule this task again — if the instructions mention daily, recurring, schedule, or a time, treat that as already handled; just do the underlying task itself for this one occurrence.`

// Runs one full agent turn outside of the chat UI — the shared entry point
// the Inngest scheduler (inngest/functions.ts) calls to actually execute a
// due/queued AgentRun. Re-fetches the live DB row instead of trusting the
// caller's `agentConfig` (which may be a normalized/stale snapshot taken
// when the run was queued), so a scheduled run always reflects the agent's
// current instructions/tools. Reuses `runChatTurn` — the same tool-calling
// loop the chat UI uses — so scheduled runs behave identically to a manual
// chat message and show up in the agent's chat history for the user to see.
export const executeAgent = async ({
    agentConfig,
    userEmail,
    input,
}: {
    agentConfig: CreatAgentType
    userEmail: string
    input: string
}) => {
    const [agentRow] = await db.select().from(AgentConfig)
        .where(eq(AgentConfig.agentId, agentConfig.agentId))
        .limit(1)

    if (!agentRow) {
        throw new Error(`Agent ${agentConfig.agentId} was not found.`)
    }

    // Seeds this run as a "user" turn so it's replayed through the same
    // history-based conversation loop as a real chat message. Prefixed with
    // the scheduled-run instruction (not persisted onto the agent's own
    // config — just this one message) so the model executes rather than chats.
    await db.insert(chatMessages).values({
        agentId: agentRow.agentId,
        userEmail,
        role: "user",
        content: [SCHEDULED_RUN_INSTRUCTION, "", "Task to execute now:", input].join("\n"),
    })

    const history = await db.select().from(chatMessages)
        .where(eq(chatMessages.agentId, agentRow.agentId))
        .orderBy(asc(chatMessages.id))

    // `tools` is a nullable jsonb column — never assume it's an array.
    // Connections are per-user (see lib/agent-tools.ts), so this covers
    // every app the user has connected from any agent or the Plugins page.
    const allowedTools: string[] = Array.isArray(agentRow.tools) ? agentRow.tools : []
    const connectedTools = await getConnectedTools(userEmail, allowedTools)

    // Also folded into the system prompt (not just the user turn above) so
    // it survives even if the model weighs the system prompt more heavily
    // than conversation history — same reasoning `agentRow.instructions` was
    // never mutated in the DB, only in this in-memory copy for this call.
    const scheduledAgentRow = {
        ...agentRow,
        instructions: [agentRow.instructions ?? "", SCHEDULED_RUN_INSTRUCTION].filter(Boolean).join("\n\n"),
    }

    const reply = await runChatTurn(scheduledAgentRow, history, connectedTools)

    return {
        assistantMessageId: reply.id,
        content: reply.content,
        toolCalls: reply.toolCalls,
    }
}
