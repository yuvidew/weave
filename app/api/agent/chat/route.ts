import { AgentConfig, chatMessages, db } from "@/db";
import { getConnectedTools } from "@/lib/agent-tools";
import { isGroqOverloaded } from "@/lib/groq";
import { currentUser } from "@clerk/nextjs/server";
import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { runChatTurn } from "./_lib";

// Loads the signed-in user's own agent row by agentId, or null if it
// doesn't exist / belongs to someone else — scoping agentId+userEmail
// together in one WHERE (rather than fetching then checking ownership)
// means a foreign agent 404s instead of leaking its existence, matching the
// PUT handler in app/api/agent/configure/route.ts.
const loadOwnedAgent = async (agentId: string, userEmail: string) => {
    const rows = await db.select().from(AgentConfig)
        .where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, userEmail)))
    return rows[0] ?? null
}

export const GET = async (req: NextRequest) => {
    const agentId = req.nextUrl.searchParams.get("agentId")

    if (!agentId) {
        return NextResponse.json({ error: "agentId is required" }, { status: 400 })
    }

    const user = await currentUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized User" }, { status: 400 })
    }

    const userEmail = user.primaryEmailAddress?.emailAddress ?? ""
    const agent = await loadOwnedAgent(agentId, userEmail)
    if (!agent) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    const messages = await db.select().from(chatMessages)
        .where(eq(chatMessages.agentId, agentId))
        .orderBy(asc(chatMessages.id))

    return NextResponse.json({ messages })
}

export const POST = async (req: NextRequest) => {
    const { agentId, message } = await req.json()

    if (!agentId) {
        return NextResponse.json({ error: "agentId is required" }, { status: 400 })
    }
    if (!message?.trim()) {
        return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const user = await currentUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized User" }, { status: 400 })
    }

    const userEmail = user.primaryEmailAddress?.emailAddress ?? ""
    const agent = await loadOwnedAgent(agentId, userEmail)
    if (!agent) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 })
    }

    try {
        await db.insert(chatMessages).values({
            agentId, userEmail, role: "user", content: message.trim(),
        })

        const history = await db.select().from(chatMessages)
            .where(eq(chatMessages.agentId, agentId))
            .orderBy(asc(chatMessages.id))

        // `tools` is a nullable jsonb column — never assume it's an array.
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
                    : "Failed to send message",
            },
            { status: overloaded ? 503 : 500 }
        )
    }
}
