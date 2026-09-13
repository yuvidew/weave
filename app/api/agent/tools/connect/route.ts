import { AgentConfig, db } from "@/db";
import { isDirectAuthTool } from "@/constant/direct-auth-tools";
import { pipedream, resolvePipedreamAppSlug } from "@/lib/pipedream";
import { currentUser } from "@clerk/nextjs/server";
import { PipedreamError } from "@pipedream/sdk";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server"

// Loads the agent, scoped to the requesting user, and confirms `slug` is one
// of its configured tools — shared by POST/DELETE below so neither handler
// can be pointed at another user's agent or an unconfigured tool.
const loadOwnedAgentWithTool = async (agentId: string, slug: string, userEmail: string) => {
    const result = await db.select().from(AgentConfig)
        .where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, userEmail)))

    const agentConfig = result[0];
    const allowedTools: string[] = Array.isArray(agentConfig?.tools) ? agentConfig.tools : [];

    if (!agentConfig || !allowedTools.some((tool) => tool.toLowerCase() === slug.toLowerCase())) {
        return null
    }

    return agentConfig
}

// Mints a short-lived Connect token scoped to this user (userEmail doubles
// as Pipedream's externalUserId — connections aren't per-agent, so this
// grants every one of the user's agents access, not just this one) and one
// app, and returns the hosted Connect Link URL the client opens to run that
// app's OAuth flow.
export const POST = async (req: NextRequest) => {
    const { agentId, slug } = await req.json();

    if (!agentId || !slug) {
        return NextResponse.json({ error: "agentId and slug are required" }, { status: 400 })
    }

    // Direct-auth tools (e.g. "browserbase") use a shared server-side
    // credential, not a per-agent Pipedream OAuth connection — there's no
    // connect flow to mint a token for. The UI never calls this for such a
    // slug (see agent-edit-sheet.tsx), but guard it here too.
    if (isDirectAuthTool(slug)) {
        return NextResponse.json({ error: "This tool doesn't use the connect flow — it's available automatically." }, { status: 400 })
    }

    const user = await currentUser();
    const userEmail = user?.primaryEmailAddress?.emailAddress;

    if (!userEmail) {
        return NextResponse.json({ error: "Unauthorized User" }, { status: 400 })
    }

    const agentConfig = await loadOwnedAgentWithTool(agentId, slug, userEmail)

    if (!agentConfig) {
        return NextResponse.json({ error: "Agent not found or tool not configured" }, { status: 404 })
    }

    try {
        // A couple of catalog slugs (e.g. "google_search") don't have their
        // own Pipedream app — resolve to whichever app actually backs them.
        const pipedreamAppSlug = resolvePipedreamAppSlug(slug)

        const { connectLinkUrl } = await pipedream.tokens.create({
            externalUserId: userEmail,
            // Resolves the app's OAuth client and pins the link's host to it.
            appId: pipedreamAppSlug,
        })

        // The token response scopes auth, but the hosted widget still needs
        // `app` on the URL itself to open straight into that app's flow.
        const url = `${connectLinkUrl}${connectLinkUrl.includes("?") ? "&" : "?"}app=${encodeURIComponent(pipedreamAppSlug)}`

        return NextResponse.json({ url })
    } catch (error) {
        console.error(error)
        return NextResponse.json({ error: "Failed to start the connect flow" }, { status: 500 })
    }
}

// Removes the user's connected account for one app — since connections are
// per-user, this disconnects it for every one of the user's agents, not just
// this one — so a fresh Connect flow is required next time (mirrors the
// "Disconnect" button in the edit sheet).
export const DELETE = async (req: NextRequest) => {
    const { agentId, slug } = await req.json();

    if (!agentId || !slug) {
        return NextResponse.json({ error: "agentId and slug are required" }, { status: 400 })
    }

    // Same as POST above — nothing to disconnect for a direct-auth tool.
    if (isDirectAuthTool(slug)) {
        return NextResponse.json({ error: "This tool doesn't use the connect flow — it's available automatically." }, { status: 400 })
    }

    const user = await currentUser();
    const userEmail = user?.primaryEmailAddress?.emailAddress;

    if (!userEmail) {
        return NextResponse.json({ error: "Unauthorized User" }, { status: 400 })
    }

    const agentConfig = await loadOwnedAgentWithTool(agentId, slug, userEmail)

    if (!agentConfig) {
        return NextResponse.json({ error: "Agent not found or tool not configured" }, { status: 404 })
    }

    try {
        // Same 404-means-"no accounts yet" case as the GET route — disconnecting
        // a tool that was never connected shouldn't be a server error.
        const accounts = await pipedream.accounts
            .listByExternalUser(userEmail, { app: resolvePipedreamAppSlug(slug) })
            .catch((error) => {
                if (error instanceof PipedreamError && error.statusCode === 404) return []
                throw error
            })

        await Promise.all(accounts.map((account) => pipedream.accounts.delete(account.id)))

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error(error)
        return NextResponse.json({ error: "Failed to disconnect the tool" }, { status: 500 })
    }
}
