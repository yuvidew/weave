import { NextRequest, NextResponse } from "next/server";
import Groq, { APIError } from "groq-sdk";
import type { ChatCompletionCreateParamsNonStreaming } from "groq-sdk/resources/chat/completions";
import { agent_config_system_prompt } from "@/constant/prompts";
import { agent_config_response } from "@/constant/response_schema";
import { AgentConfig, db, tools } from "@/db";
import { currentUser } from "@clerk/nextjs/server";
import { and, desc, eq, or } from "drizzle-orm";

// Groq returns 503 when a model is temporarily overloaded and 429 when
// rate-limited — both are transient, so retry a couple times with a short
// backoff before giving up instead of failing the whole request immediately.
const generateWithRetry = async (
    groq: Groq,
    params: ChatCompletionCreateParamsNonStreaming,
    attempts = 3
) => {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await groq.chat.completions.create(params)
        } catch (error) {
            const isRetryable = error instanceof APIError && (error.status === 503 || error.status === 429)

            if (!isRetryable || attempt === attempts) throw error

            await new Promise((resolve) => setTimeout(resolve, attempt * 500))
        }
    }

    // Unreachable — the loop above always returns or throws.
    throw new Error("generateWithRetry exhausted its attempts without a result")
}

export const POST = async (req: NextRequest) => {
    const { prompt } = await req.json();
    const user = await currentUser()

    if (!prompt?.trim()) {
        return NextResponse.json(
            {
                error: "Prompt is required",
            },
            {
                status: 400
            }
        )
    }

    const apiKey = process.env.GROQ_API_KEY

    try {
        // Live tool slugs so the prompt reflects the `tools` table without a code change.
        const availableTools = await db.select({ slug: tools.slug }).from(tools);

        const groq = new Groq({ apiKey })

        const content = agent_config_system_prompt
            .replace("{{AVAILABLE_TOOLS}}", availableTools.map((tool) => tool.slug).join(", "))
            .replace("{{USER_REQUEST}}", prompt)

        const response = await generateWithRetry(groq, {
            model: "openai/gpt-oss-120b",
            messages: [{ role: "user", content }],
            response_format: {
                type: "json_schema",
                json_schema: agent_config_response,
            },
        })

        const text = response.choices[0]?.message?.content

        const aiOutput = JSON.parse(text ?? "{}");

        if (aiOutput.status === "ready") {
            const agentId = crypto.randomUUID()
            const [agent] = await db.insert(AgentConfig).values({
                ...aiOutput.config,
                agentImage: `https://api.dicebear.com/10.x/voxel-bot/svg?tags=animation&seed=${agentId}`,
                agentId: agentId,
                userEmail: user?.primaryEmailAddress?.emailAddress
            }).returning();

            // `dbResult` from `.returning()` is an array — spreading it directly
            // (`{...dbResult}`) turns it into `{"0": row}` instead of a clean
            // object, so pull the single inserted row out first.
            return NextResponse.json({ ...aiOutput, agent })
        }

        return NextResponse.json(aiOutput)
    } catch (error) {
        console.log("Error", error)

        const isOverloaded = error instanceof APIError && error.status === 503

        return NextResponse.json(
            {
                error: isOverloaded
                    ? "The AI model is temporarily overloaded. Please try again in a moment."
                    : "Failed to generate agent configuration",
            },
            {
                status: isOverloaded ? 503 : 500
            }
        )
    }
}


export const PUT = async (req: NextRequest) => {
    const { agentId, agentConfig } = await req.json();
    const user = await currentUser()

    if (!agentId) {
        return NextResponse.json({ error: "agentId is required" }, { status: 400 })
    }

    try {

        // Scope the update to the requesting user's own agent — without a `where`
        // clause `db.update` touches every row in the table.
        const result = await db.update(AgentConfig)
            .set({ ...agentConfig, updatedAt: new Date() })
            .where(and(
                eq(AgentConfig.agentId, agentId),
                eq(AgentConfig.userEmail, user?.primaryEmailAddress?.emailAddress ?? "")
            ))
            .returning();

        if (!result[0]) {
            return NextResponse.json({ error: "Agent not found" }, { status: 404 })
        }

        return NextResponse.json(result[0])
    } catch (error) {
        return NextResponse.json(
            {
                error: "Internal server error",
            },
            {
                status: 500
            }
        )
    }

}


export const GET = async (req: NextRequest) => {
    const user = await currentUser();

    if (!user) {
        return NextResponse.json({
            error: "Unauthorized User",
        }, { status: 400 })
    }
    const result = await db.select().from(AgentConfig).where(eq(AgentConfig.userEmail, user?.primaryEmailAddress?.emailAddress ?? ""))
    .orderBy(desc(AgentConfig.updatedAt))

    return NextResponse.json(result)
}