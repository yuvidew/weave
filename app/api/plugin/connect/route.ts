import { db, tools } from "@/db";
import { isDirectAuthTool } from "@/constant/direct-auth-tools";
import { pipedream, resolvePipedreamAppSlug } from "@/lib/pipedream";
import { currentUser } from "@clerk/nextjs/server";
import { PipedreamError } from "@pipedream/sdk";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Confirms `slug` is a real, active catalog entry — guards both handlers
// below against connecting/disconnecting an app that isn't actually offered.
const loadActiveTool = async (slug: string) => {
    const rows = await db.select().from(tools)
        .where(and(eq(tools.slug, slug), eq(tools.status, "active")));
    return rows[0] ?? null;
}

// Mints a Connect token scoped to the signed-in user (userEmail doubles as
// Pipedream's externalUserId) for one app, and returns the hosted Connect
// Link URL the client opens to run that app's OAuth flow. Connections are
// per-user, not per-agent, so this one connection is immediately usable by
// every agent this user has — see lib/agent-tools.ts.
export const POST = async (req: NextRequest) => {
    const { slug } = await req.json();

    if (!slug) {
        return NextResponse.json({ error: "slug is required" }, { status: 400 })
    }

    // Direct-auth tools (e.g. "browserbase") use a shared server-side
    // credential — there's no connect flow to mint a token for.
    if (isDirectAuthTool(slug)) {
        return NextResponse.json({ error: "This tool doesn't use the connect flow — it's available automatically." }, { status: 400 })
    }

    const user = await currentUser();
    const userEmail = user?.primaryEmailAddress?.emailAddress;

    if (!userEmail) {
        return NextResponse.json({ error: "Unauthorized User" }, { status: 400 })
    }

    const tool = await loadActiveTool(slug);
    if (!tool) {
        return NextResponse.json({ error: "Tool not found" }, { status: 404 })
    }

    try {
        // A couple of catalog slugs (e.g. "google_search") don't have their
        // own Pipedream app — resolve to whichever app actually backs them.
        const pipedreamAppSlug = resolvePipedreamAppSlug(slug)

        const { connectLinkUrl } = await pipedream.tokens.create({
            externalUserId: userEmail,
            appId: pipedreamAppSlug,
        })

        // The token response scopes auth, but the hosted widget still needs
        // `app` on the URL itself to open straight into that app's flow.
        const url = `${connectLinkUrl}${connectLinkUrl.includes("?") ? "&" : "?"}app=${encodeURIComponent(pipedreamAppSlug)}`

        return NextResponse.json({ url })
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to start the connect flow" }, { status: 500 })
    }
}

// Removes the user's connected account for one app, so a fresh Connect flow
// is required next time — affects every agent, since connections are shared.
export const DELETE = async (req: NextRequest) => {
    const { slug } = await req.json();

    if (!slug) {
        return NextResponse.json({ error: "slug is required" }, { status: 400 })
    }

    if (isDirectAuthTool(slug)) {
        return NextResponse.json({ error: "This tool doesn't use the connect flow — it's available automatically." }, { status: 400 })
    }

    const user = await currentUser();
    const userEmail = user?.primaryEmailAddress?.emailAddress;

    if (!userEmail) {
        return NextResponse.json({ error: "Unauthorized User" }, { status: 400 })
    }

    const tool = await loadActiveTool(slug);
    if (!tool) {
        return NextResponse.json({ error: "Tool not found" }, { status: 404 })
    }

    try {
        // Same 404-means-"no accounts yet" case as the catalog GET route —
        // disconnecting a tool that was never connected shouldn't error.
        const accounts = await pipedream.accounts
            .listByExternalUser(userEmail, { app: resolvePipedreamAppSlug(slug) })
            .catch((error) => {
                if (error instanceof PipedreamError && error.statusCode === 404) return []
                throw error
            })

        await Promise.all(accounts.map((account) => pipedream.accounts.delete(account.id)))

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to disconnect the tool" }, { status: 500 })
    }
}
