import { db, tools } from "@/db";
import { DIRECT_AUTH_TOOL_DISPLAY, isDirectAuthTool } from "@/constant/direct-auth-tools";
import { getConnectedTools } from "@/lib/agent-tools";
import { pipedream, resolvePipedreamAppSlug } from "@/lib/pipedream";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// Returns the full catalog of apps/tools available in the platform — every
// active `tools` row, enriched with each app's live name/logo from Pipedream
// and whether the signed-in user has it connected. Unlike /api/agent/tools,
// this isn't scoped to one agent's allowed slugs — it's the browsable catalog
// a user picks from — but connection state is still per-user (not per-agent,
// see lib/agent-tools.ts), so `connected` here matches what every one of
// their agents would see too.
export const GET = async () => {
    const user = await currentUser();
    const userEmail = user?.primaryEmailAddress?.emailAddress;

    if (!userEmail) {
        return NextResponse.json({ error: "Unauthorized User" }, { status: 400 })
    }

    // Only surface tools marked active in the catalog.
    const toolsResult = await db.select()
        .from(tools)
        .where(eq(tools.status, "active"));

    try {
        // Direct-auth tools (e.g. "browserbase") have no matching Pipedream
        // app — skip the doomed lookup and use static display info instead.
        const apps = await Promise.all(
            toolsResult.map((tool) =>
                isDirectAuthTool(tool.slug)
                    ? Promise.resolve(null)
                    : pipedream.apps.retrieve(resolvePipedreamAppSlug(tool.slug)).catch(() => null)
            )
        );

        // Same lookup GET /api/agent/tools uses — one call covers every
        // slug in the catalog since it's scoped to the user, not one agent.
        const connectedTools = await getConnectedTools(userEmail, toolsResult.map((tool) => tool.slug))

        const catalog = toolsResult.map((tool, index) => {
            const direct = DIRECT_AUTH_TOOL_DISPLAY[tool.slug];
            const app = apps[index]?.data;

            return {
                ...tool,
                // Prefer live Pipedream metadata, falling back to the db row
                // and then the static direct-auth display info.
                name: app?.name ?? direct?.name ?? tool.name,
                logo: app?.imgSrc ?? direct?.logo ?? tool.icon ?? "",
                connected: connectedTools.some((connected) => connected.slug === tool.slug),
            }
        });

        return NextResponse.json({ tools: catalog });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to load apps and tools" }, { status: 500 });
    }
}
