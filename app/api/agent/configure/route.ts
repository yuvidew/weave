import { NextRequest, NextResponse } from "next/server";
import { agent_config_system_prompt } from "@/constant/prompts";
import { agent_config_response } from "@/constant/response_schema";
import { AgentConfig, db, tools } from "@/db";
import { currentUser } from "@clerk/nextjs/server";
import { and, desc, eq, or } from "drizzle-orm";
import { GROQ_MODEL, generateWithRetry, getGroqRetryAfterMinutes, groq, isGroqOverloaded, isGroqRateLimited } from "@/lib/groq";
import { normalizeSchedule, rescheduleAgentRuns } from "@/lib/agent-schedule";

export const POST = async (req: NextRequest) => {
    const { prompt, timezone } = await req.json();
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

    try {
        // Live tool slugs so the prompt reflects the `tools` table without a code change.
        const availableTools = await db.select({ slug: tools.slug }).from(tools);

        const content = agent_config_system_prompt
            .replace("{{AVAILABLE_TOOLS}}", availableTools.map((tool) => tool.slug).join(", "))
            .replace("{{USER_REQUEST}}", prompt)

        const response = await generateWithRetry(groq, {
            model: GROQ_MODEL,
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
            const schedule = normalizeSchedule(aiOutput?.config?.schedule)
            const [agent] = await db.insert(AgentConfig).values({
                ...aiOutput.config,
                agentImage: `https://api.dicebear.com/10.x/voxel-bot/svg?tags=animation&seed=${agentId}`,
                agentId: agentId,
                userEmail: user?.primaryEmailAddress?.emailAddress,
                schedule: {
                    ...schedule,
                    timezone: timezone,
                }
            }).returning();

            // Queues the first run for a daily recurring schedule — see
            // rescheduleAgentRuns's doc comment for why this same call is
            // also made from PUT on every schedule edit.
            await rescheduleAgentRuns({
                agentId,
                userEmail: user?.primaryEmailAddress?.emailAddress ?? "",
                schedule: { ...schedule, timezone },
            })

            // `dbResult` from `.returning()` is an array — spreading it directly
            // (`{...dbResult}`) turns it into `{"0": row}` instead of a clean
            // object, so pull the single inserted row out first.
            return NextResponse.json({ ...aiOutput, agent })
        }

        return NextResponse.json(aiOutput)
    } catch (error) {
        console.log("Error", error)

        const isOverloaded = isGroqOverloaded(error)
        const isRateLimited = isGroqRateLimited(error)
        const retryMinutes = getGroqRetryAfterMinutes(error)

        return NextResponse.json(
            {
                error: isRateLimited
                    ? `The AI model has hit its usage limit for now. Please try again${retryMinutes ? ` in about ${retryMinutes} minute${retryMinutes === 1 ? "" : "s"}` : " shortly"}.`
                    : isOverloaded
                    ? "The AI model is temporarily overloaded. Please try again in a moment."
                    : "Failed to generate agent configuration",
            },
            {
                status: isOverloaded || isRateLimited ? 503 : 500
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

        // The saved schedule (result[0].schedule) is the source of truth —
        // re-sync the queued run to it whenever schedule was part of this
        // edit, so a changed time/frequency/type actually takes effect
        // instead of leaving a stale run queued at the old time.
        if (agentConfig.schedule) {
            const savedSchedule = result[0].schedule as { type: string; time: string; frequency: string; timezone?: string }
            await rescheduleAgentRuns({
                agentId,
                userEmail: user?.primaryEmailAddress?.emailAddress ?? "",
                schedule: savedSchedule,
            })
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