import { AgentConfig, db } from "@/db";
import { pipedream, resolvePipedreamAppSlug } from "@/lib/pipedream";
import { currentUser } from "@clerk/nextjs/server";
import { PipedreamError } from "@pipedream/sdk";
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
        // One call covers every app this agent has ever connected — cheaper
        // than a per-slug lookup, and there's no "session" to create/reuse
        // like there was with Composio (agentId doubles as the externalUserId).
        // Pipedream 404s this call (instead of returning []) for an
        // externalUserId it's never seen before — i.e. an agent that's never
        // had any tool connected yet — so that specific case means "no
        // connected accounts," not a real failure.
        const connectedAccounts = await pipedream.accounts.listByExternalUser(agentId).catch((error) => {
            if (error instanceof PipedreamError && error.statusCode === 404) return []
            throw error
        })

        // Accounts don't carry the app's name/logo when nothing's connected
        // yet, so fetch each allowed slug's app metadata directly — this is
        // the only source for those fields pre-connection. Resolved through
        // the catalog-slug → Pipedream-app-slug map, since a couple of
        // catalog tools (e.g. "google_search") don't have their own app.
        const apps = await Promise.all(
            allowedTools.map((slug) => pipedream.apps.retrieve(resolvePipedreamAppSlug(slug)).catch(() => null))
        )

        const tools = allowedTools.map((slug: string, index: number) => {
            const app = apps[index]?.data
            const pipedreamAppSlug = resolvePipedreamAppSlug(slug)
            const account = connectedAccounts.find(
                (acc) => acc.app?.nameSlug?.toLowerCase() === pipedreamAppSlug.toLowerCase()
            )

            return {
                slug,
                name: app?.name ?? slug,
                logo: app?.imgSrc ?? "",
                connected: Boolean(account?.healthy) && !account?.dead,
                connectedAccountId: account?.id ?? null,
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