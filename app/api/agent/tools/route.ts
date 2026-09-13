import { AgentConfig, db } from "@/db";
import { getConnectedTools } from "@/lib/agent-tools";
import { DIRECT_AUTH_TOOL_DISPLAY, isDirectAuthTool } from "@/constant/direct-auth-tools";
import { pipedream, resolvePipedreamAppSlug } from "@/lib/pipedream";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server"

export const GET = async (req: NextRequest) => {
    const searchParams = req.nextUrl.searchParams;
    const agentId = searchParams.get("agentId");

    if (!agentId) {
        return NextResponse.json({
            error: "agentId is required",
        }, { status: 400 })
    }

    const user = await currentUser();

    if (!user) {
        return NextResponse.json({
            error: "Unauthorized User",
        }, { status: 400 })
    };

    const userEmail = user.primaryEmailAddress?.emailAddress;

    if (!userEmail) {
        return NextResponse.json({
            error: "User has no primary email address",
        }, { status: 400 })
    }

    const result = await db.select().from(AgentConfig)
    .where(eq(AgentConfig.agentId, agentId))

    const agentConfig = result[0];

    if (!agentConfig) {
        return NextResponse.json({
            error: "Agent not found",
        }, { status: 404 })
    }

    // `tools` is a nullable jsonb column — never assume it's an array.
    const allowedTools: string[] = Array.isArray(agentConfig.tools) ? agentConfig.tools : [];

    // No tools configured — skip the Pipedream lookup entirely.
    if (allowedTools.length === 0) {
        return NextResponse.json({ tools: [] })
    }

    try {
        // Single source of truth for "is this slug actually connected" —
        // shared with the chat route, which uses it to decide which curated
        // actions to offer the model. Scoped to the user (not this one
        // agent) — one call here covers every app this user has ever
        // connected, from any agent or the Plugins page.
        const connectedTools = await getConnectedTools(userEmail, allowedTools)

        // Accounts don't carry the app's name/logo when nothing's connected
        // yet, so fetch each allowed slug's app metadata directly — this is
        // the only source for those fields pre-connection. Resolved through
        // the catalog-slug → Pipedream-app-slug map, since a couple of
        // catalog tools (e.g. "google_search") don't have their own app.
        // Direct-auth tools (e.g. "browserbase") have no matching Pipedream
        // app at all — skip the doomed lookup and use static display info.
        const apps = await Promise.all(
            allowedTools.map((slug) =>
                isDirectAuthTool(slug)
                    ? Promise.resolve(null)
                    : pipedream.apps.retrieve(resolvePipedreamAppSlug(slug)).catch(() => null)
            )
        )

        const tools = allowedTools.map((slug: string, index: number) => {
            const direct = DIRECT_AUTH_TOOL_DISPLAY[slug]
            const app = apps[index]?.data
            const connectedTool = connectedTools.find((tool) => tool.slug === slug)

            return {
                slug,
                name: direct?.name ?? app?.name ?? slug,
                logo: direct?.logo ?? app?.imgSrc ?? "",
                connected: Boolean(connectedTool),
                // The "direct" sentinel connectedAccountId (see
                // getConnectedTools) is an internal detail, not a real
                // Pipedream account — never surface it to the client.
                connectedAccountId: isDirectAuthTool(slug) ? null : (connectedTool?.connectedAccountId ?? null),
            }
        })

        return NextResponse.json({ tools })
    } catch (error) {
        console.error(error)
        return NextResponse.json({
            error: "Failed to load agent tools",
        }, { status: 500 })
    }
}