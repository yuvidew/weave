import { AgentConfig, chatMessages, db } from "@/db";
import { findActionByName } from "@/constant/agent-actions";
import { getConnectedTools } from "@/lib/agent-tools";
import { isGroqOverloaded } from "@/lib/groq";
import { pipedream } from "@/lib/pipedream";
import { currentUser } from "@clerk/nextjs/server";
import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { runChatTurn, type StoredToolCall } from "../_lib";

export const POST = async (req: NextRequest) => {
    const { agentId, messageId, toolCallId, decision } = await req.json()

    if (!agentId || !messageId || !toolCallId || (decision !== "approve" && decision !== "reject")) {
        return NextResponse.json({ error: "agentId, messageId, toolCallId, and a valid decision are required" }, { status: 400 })
    }

    const user = await currentUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized User" }, { status: 400 })
    }

    const userEmail = user.primaryEmailAddress?.emailAddress ?? ""
    const [agent] = await db.select().from(AgentConfig)
        .where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, userEmail)))

    if (!agent) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    const [messageRow] = await db.select().from(chatMessages)
        .where(and(eq(chatMessages.id, messageId), eq(chatMessages.agentId, agentId)))

    if (!messageRow) {
        return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    const toolCalls = (messageRow.toolCalls as StoredToolCall[] | null) ?? []
    const callIndex = toolCalls.findIndex((call) => call.id === toolCallId)

    if (callIndex === -1) {
        return NextResponse.json({ error: "Tool call not found" }, { status: 404 })
    }
    if (toolCalls[callIndex].status !== "pending") {
        return NextResponse.json({ error: "Tool call already resolved" }, { status: 409 })
    }

    try {
        const call = toolCalls[callIndex]
        const action = findActionByName(call.name)
        const updatedCall: StoredToolCall = { ...call }

        if (decision === "reject") {
            updatedCall.status = "rejected"
        } else if (!action) {
            updatedCall.status = "error"
            updatedCall.error = "Unknown action."
        } else {
            const allowedTools: string[] = Array.isArray(agent.tools) ? agent.tools : []
            const connectedTools = await getConnectedTools(agentId, allowedTools)
            const connectedTool = connectedTools.find((tool) => tool.slug === action.catalogSlug)

            if (!connectedTool) {
                updatedCall.status = "error"
                updatedCall.error = `${action.catalogSlug} is not connected.`
            } else {
                try {
                    const result = await pipedream.actions.run({
                        id: action.componentId,
                        externalUserId: agentId,
                        configuredProps: {
                            [action.appPropName]: { authProvisionId: connectedTool.connectedAccountId },
                            ...action.toConfiguredProps(call.arguments),
                        },
                    })
                    updatedCall.status = "done"
                    updatedCall.result = result
                } catch (error) {
                    updatedCall.status = "error"
                    updatedCall.error = error instanceof Error ? error.message : "Action failed."
                }
            }
        }

        const updatedToolCalls = [...toolCalls]
        updatedToolCalls[callIndex] = updatedCall

        await db.update(chatMessages)
            .set({ toolCalls: updatedToolCalls })
            .where(eq(chatMessages.id, messageRow.id))

        const resultContent = JSON.stringify(
            updatedCall.status === "error"
                ? { error: updatedCall.error }
                : updatedCall.status === "rejected"
                    ? { status: "rejected", note: "The user chose not to approve this action when asked — it was not a technical failure. Acknowledge that you won't do it, without inventing a different reason." }
                    : updatedCall.result
        )
        await db.insert(chatMessages).values({
            agentId, userEmail, role: "tool", toolCallId, content: resultContent,
        })

        // Other calls in this same batch may still be awaiting their own
        // approval — only ask the model to react once every call in the
        // batch has settled (Groq requires a tool result for every
        // outstanding tool_call_id before it will accept another turn).
        if (updatedToolCalls.some((c) => c.status === "pending")) {
            return NextResponse.json({
                message: { ...messageRow, toolCalls: updatedToolCalls },
            })
        }

        const history = await db.select().from(chatMessages)
            .where(eq(chatMessages.agentId, agentId))
            .orderBy(asc(chatMessages.id))

        const allowedTools: string[] = Array.isArray(agent.tools) ? agent.tools : []
        const connectedTools = await getConnectedTools(agentId, allowedTools)
        const reply = await runChatTurn(agent, history, connectedTools)

        return NextResponse.json({ message: reply })
    } catch (error) {
        console.error(error)
        const overloaded = isGroqOverloaded(error)
        return NextResponse.json(
            {
                error: overloaded
                    ? "The AI model is temporarily overloaded. Please try again in a moment."
                    : "Failed to resolve tool call",
            },
            { status: overloaded ? 503 : 500 }
        )
    }
}
