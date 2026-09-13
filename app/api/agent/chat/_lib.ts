import { AgentConfig, chatMessages, db } from "@/db";
import { buildAgentChatSystemPrompt } from "@/constant/prompts";
import { AgentActionDef, PipedreamAgentAction, findActionByName, getActionsForSlugs } from "@/constant/agent-actions";
import type { ConnectedTool } from "@/lib/agent-tools";
import { GROQ_MODEL, generateWithRetry, groq } from "@/lib/groq";
import { pipedream } from "@/lib/pipedream";
import { eq } from "drizzle-orm";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "groq-sdk/resources/chat/completions";

export type ToolCallStatus = "pending" | "approved" | "rejected" | "done" | "error"

// One call requested in a single assistant turn — see db/schema.ts's
// `chatMessages.toolCalls` for how this is persisted.
export type StoredToolCall = {
    id: string
    name: string
    arguments: Record<string, unknown>
    label: string
    needsApproval: boolean
    status: ToolCallStatus
    result?: unknown
    error?: string
}

export type AgentConfigRow = typeof AgentConfig.$inferSelect
export type ChatMessageRow = typeof chatMessages.$inferSelect

// Bounds how many sequential Groq round-trips one HTTP request can make —
// this is a synchronous request/response with no streaming, so an unbounded
// tool-calling loop risks a very long hanging POST. Needs to be generous
// enough for a real multi-step task (e.g. search, then post to Slack, then
// write to Notion) to actually finish instead of exhausting its budget on
// research alone — 4 was too tight for that in practice.
const MAX_ITERATIONS = 8

// Maps one persisted row back to the Groq message shape needed to replay
// the conversation so far. A "tool" row with no toolCallId, or an
// unrecognized role, can't be replayed and is dropped defensively.
const toGroqMessage = (row: ChatMessageRow): ChatCompletionMessageParam | null => {
    if (row.role === "user") {
        return { role: "user", content: row.content ?? "" }
    }

    if (row.role === "assistant") {
        const toolCalls = (row.toolCalls as StoredToolCall[] | null) ?? null
        if (toolCalls && toolCalls.length > 0) {
            return {
                role: "assistant",
                content: row.content,
                tool_calls: toolCalls.map((call) => ({
                    id: call.id,
                    type: "function",
                    function: { name: call.name, arguments: JSON.stringify(call.arguments) },
                })),
            }
        }
        return { role: "assistant", content: row.content ?? "" }
    }

    if (row.role === "tool" && row.toolCallId) {
        return { role: "tool", tool_call_id: row.toolCallId, content: row.content ?? "" }
    }

    return null
}

const toGroqTool = (action: AgentActionDef): ChatCompletionTool => ({
    type: "function",
    function: { name: action.name, description: action.description, parameters: action.parameters },
})

// Executes one curated action for real via Pipedream against the user's
// connected account for that action's app (connections are per-user, not
// per-agent — see lib/agent-tools.ts).
const runAction = (action: PipedreamAgentAction, args: Record<string, unknown>, externalUserId: string, connectedAccountId: string) =>
    pipedream.actions.run({
        id: action.componentId,
        externalUserId,
        configuredProps: {
            [action.appPropName]: { authProvisionId: connectedAccountId },
            ...action.toConfiguredProps(args),
        },
    })

// Merges newly-discovered default args (e.g. an auto-found Notion parent
// page) into `agent.toolDefaults[actionName]`, persists it, and mutates the
// in-memory `agent` row so a second call to the same action later in this
// same turn also sees it without a re-read.
const persistToolDefault = async (agent: AgentConfigRow, actionName: string, values: Record<string, unknown>) => {
    const existing = (agent.toolDefaults as Record<string, Record<string, unknown>> | null) ?? {}
    const merged = { ...existing, [actionName]: { ...existing[actionName], ...values } }
    await db.update(AgentConfig).set({ toolDefaults: merged }).where(eq(AgentConfig.agentId, agent.agentId))
    agent.toolDefaults = merged
}

// Runs the bounded tool-calling loop starting from `history` (already
// includes every persisted row up to and including whatever triggered this
// turn — a new user message, or a just-resolved approval), inserting new
// chatMessages rows as it goes, and returns the newest assistant row. Used
// by both POST /api/agent/chat and POST /api/agent/chat/resolve so the
// "call Groq, maybe run tools, maybe loop" logic lives in exactly one place.
export const runChatTurn = async (
    agent: AgentConfigRow,
    history: ChatMessageRow[],
    connectedTools: ConnectedTool[]
): Promise<ChatMessageRow> => {
    const actions = getActionsForSlugs(connectedTools.map((tool) => tool.slug))
    const systemPrompt = buildAgentChatSystemPrompt({
        name: agent.name ?? "Agent",
        objective: agent.objective ?? "",
        instructions: agent.instructions ?? "",
        outputFormat: agent.outputFormat ?? "",
    })

    const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...history.map(toGroqMessage).filter((message): message is ChatCompletionMessageParam => message !== null),
    ]

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        // On the last allowed iteration, force a plain reply so the loop
        // always terminates in text even if the model still wants to call
        // more tools. Omitting `tools` entirely (rather than sending them
        // with `tool_choice: "none"`) is what actually makes this hold —
        // a model asked hard enough to use a tool (see the scheduled-run
        // instruction in lib/execute-agent.ts) can still emit a tool_call
        // even with tool_choice "none", which Groq then hard-rejects with
        // a 400 ("Tool choice is none, but model called a tool") instead of
        // just returning text — so there's nothing to fall back to. With no
        // tool schemas in the request at all, it has nothing to call.
        const forceStop = iteration === MAX_ITERATIONS - 1

        let response: Awaited<ReturnType<typeof generateWithRetry>>
        try {
            response = await generateWithRetry(groq, {
                model: GROQ_MODEL,
                messages,
                tools: actions.length > 0 && !forceStop ? actions.map(toGroqTool) : undefined,
                tool_choice: actions.length > 0 && !forceStop ? "auto" : undefined,
            })
        } catch (error) {
            // A non-retryable Groq failure (bad request, model error, etc.)
            // would otherwise bubble straight out of this function with
            // nothing recorded — the whole turn just goes silent, mid-task,
            // with no trace in the transcript and no reply to the user. Persist
            // a visible row instead, and return it rather than rethrow, so the
            // caller (POST /api/agent/chat) still gets back a normal message
            // instead of a generic failure toast with nothing left behind.
            //
            // A model that hallucinates a tool we never declared (seen in
            // practice: it invents a "web_open" call to "open" a search
            // result, which doesn't exist in our catalog) trips one of two
            // Groq 400s: "Tool choice is none, but model called a tool" (on
            // the forced final no-tools iteration) or "attempted to call
            // tool 'x' which was not in request.tools" (on a normal
            // iteration, tools attached, wrong name). Neither is a real
            // system failure — both are "the model tried something we don't
            // support" — so both get the same friendly wording the
            // bottom-of-function fallback uses, instead of a raw JSON dump.
            const isUnsupportedToolAttempt =
                error instanceof Error && /tool_use_failed|which was not in request\.tools/.test(error.message)
            const content = forceStop || isUnsupportedToolAttempt
                ? "I wasn't able to finish that within the allowed number of steps — could you try rephrasing?"
                : `Something went wrong completing this — please try again. (${error instanceof Error ? error.message : "unknown error"})`
            const [saved] = await db.insert(chatMessages).values({
                agentId: agent.agentId,
                userEmail: agent.userEmail,
                role: "assistant",
                content,
            }).returning()
            return saved
        }

        const choice = response.choices[0]?.message
        const toolCalls = choice?.tool_calls

        if (!toolCalls || toolCalls.length === 0) {
            const [saved] = await db.insert(chatMessages).values({
                agentId: agent.agentId,
                userEmail: agent.userEmail,
                role: "assistant",
                content: choice?.content ?? "",
            }).returning()
            return saved
        }

        // Resolve each requested call: auto-run reads now, mark writes
        // pending for approval — never call Pipedream for those yet.
        const resolvedCalls: StoredToolCall[] = []
        for (const toolCall of toolCalls) {
            const action = findActionByName(toolCall.function.name)
            let args: Record<string, unknown> = {}
            try {
                args = JSON.parse(toolCall.function.arguments || "{}")
            } catch {
                // Malformed arguments from the model — proceed with an empty
                // object rather than crashing the whole turn.
            }

            if (!action) {
                resolvedCalls.push({
                    id: toolCall.id, name: toolCall.function.name, arguments: args,
                    label: toolCall.function.name, needsApproval: false, status: "error",
                    error: "Unknown action.",
                })
                continue
            }

            if (action.needsApproval) {
                resolvedCalls.push({
                    id: toolCall.id, name: action.name, arguments: args,
                    label: action.toApprovalLabel(args), needsApproval: true, status: "pending",
                })
                continue
            }

            // Direct (non-Pipedream) action — runs immediately, no
            // connected account required (see constant/direct-auth-tools.ts).
            if (action.run) {
                try {
                    const result = await action.run(args)
                    resolvedCalls.push({
                        id: toolCall.id, name: action.name, arguments: args,
                        label: action.toApprovalLabel(args), needsApproval: false, status: "done", result,
                    })
                } catch (error) {
                    resolvedCalls.push({
                        id: toolCall.id, name: action.name, arguments: args,
                        label: action.toApprovalLabel(args), needsApproval: false, status: "error",
                        error: error instanceof Error ? error.message : "Action failed.",
                    })
                }
                continue
            }

            const connectedTool = connectedTools.find((tool) => tool.slug === action.catalogSlug)
            if (!connectedTool) {
                resolvedCalls.push({
                    id: toolCall.id, name: action.name, arguments: args,
                    label: action.toApprovalLabel(args), needsApproval: false, status: "error",
                    error: `${action.catalogSlug} is not connected.`,
                })
                continue
            }

            try {
                // Fill in anything the model left out that it should never
                // have to ask the user for (e.g. a Notion parent page) —
                // an explicit value from the model always wins over this.
                let mergedArgs = args
                if (action.resolveMissingArgs) {
                    const resolved = await action.resolveMissingArgs(args, {
                        agent,
                        connectedAccountId: connectedTool.connectedAccountId,
                        persistDefault: (values) => persistToolDefault(agent, action.name, values),
                    })
                    mergedArgs = { ...resolved, ...args }
                }

                const result = await runAction(action, mergedArgs, agent.userEmail ?? "", connectedTool.connectedAccountId)
                resolvedCalls.push({
                    id: toolCall.id, name: action.name, arguments: mergedArgs,
                    label: action.toApprovalLabel(mergedArgs), needsApproval: false, status: "done", result,
                })
            } catch (error) {
                resolvedCalls.push({
                    id: toolCall.id, name: action.name, arguments: args,
                    label: action.toApprovalLabel(args), needsApproval: false, status: "error",
                    error: error instanceof Error ? error.message : "Action failed.",
                })
            }
        }

        const [assistantRow] = await db.insert(chatMessages).values({
            agentId: agent.agentId,
            userEmail: agent.userEmail,
            role: "assistant",
            content: choice?.content ?? null,
            toolCalls: resolvedCalls,
        }).returning()

        // Persist a `tool` result row for every call that actually ran (or
        // failed) this batch — independent of whether other calls in the
        // same batch are still pending, so an approval later doesn't need to
        // re-run ones that already finished.
        const settledCalls = resolvedCalls.filter((call) => call.status !== "pending")
        for (const call of settledCalls) {
            const content = JSON.stringify(call.status === "error" ? { error: call.error } : call.result)
            await db.insert(chatMessages).values({
                agentId: agent.agentId, userEmail: agent.userEmail, role: "tool", toolCallId: call.id, content,
            })
        }

        // Any pending call pauses the whole turn here — nothing more to do
        // until the user approves/rejects it via /api/agent/chat/resolve.
        if (resolvedCalls.some((call) => call.status === "pending")) {
            return assistantRow
        }

        // Every call in this batch settled immediately — feed the results
        // back into the conversation and loop so the model can react.
        messages.push({
            role: "assistant",
            content: choice?.content ?? null,
            tool_calls: resolvedCalls.map((call) => ({
                id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) },
            })),
        })
        for (const call of settledCalls) {
            const content = JSON.stringify(call.status === "error" ? { error: call.error } : call.result)
            messages.push({ role: "tool", tool_call_id: call.id, content })
        }
    }

    // Unreachable in practice — the forced `tool_choice:"none"` on the final
    // iteration guarantees a plain-content response — but keeps the
    // function's return type honest if that ever changes.
    const [saved] = await db.insert(chatMessages).values({
        agentId: agent.agentId, userEmail: agent.userEmail, role: "assistant",
        content: "I wasn't able to finish that within the allowed number of steps — could you try rephrasing?",
    }).returning()
    return saved
}
