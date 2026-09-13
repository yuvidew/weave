import { pipedream, resolvePipedreamAppSlug } from "@/lib/pipedream";
import { isDirectAuthTool } from "@/constant/direct-auth-tools";
import { PipedreamError } from "@pipedream/sdk";

export type ConnectedTool = {
    slug: string;
    connectedAccountId: string;
};

// Resolves which of a user's allowed catalog slugs are actually connected
// (a healthy, non-dead Pipedream account exists) right now, along with the
// Pipedream account id each one needs for actions.run()'s app-type
// configuredProps (`{ authProvisionId: connectedAccountId }`). Connections
// are scoped to the user (externalUserId = userEmail), not any one agent —
// connecting an app once (from the Plugins page, or an agent's edit sheet)
// makes it available to every one of that user's agents. Shared by
// GET /api/agent/tools (display), app/api/agent/chat/route.ts and
// lib/execute-agent.ts (deciding which curated actions to offer this turn).
export const getConnectedTools = async (
    externalUserId: string,
    allowedSlugs: string[]
): Promise<ConnectedTool[]> => {
    if (allowedSlugs.length === 0) return [];

    // Direct-auth tools (e.g. "browserbase") use one shared server-side API
    // key, not a per-user Pipedream OAuth account — they're always
    // available, so skip the Pipedream lookup for them entirely.
    // `connectedAccountId` is a sentinel here; direct actions never read it.
    const directTools: ConnectedTool[] = allowedSlugs
        .filter(isDirectAuthTool)
        .map((slug) => ({ slug, connectedAccountId: "direct" }))

    const pipedreamSlugs = allowedSlugs.filter((slug) => !isDirectAuthTool(slug))
    if (pipedreamSlugs.length === 0) return directTools

    // Pipedream 404s this call (instead of returning []) for an
    // externalUserId it's never seen before — i.e. a user who's never had
    // any tool connected yet — so that specific case means "no connected
    // accounts," not a real failure.
    const connectedAccounts = await pipedream.accounts.listByExternalUser(externalUserId).catch((error) => {
        if (error instanceof PipedreamError && error.statusCode === 404) return []
        throw error
    })

    const pipedreamTools = pipedreamSlugs.flatMap((slug) => {
        const pipedreamAppSlug = resolvePipedreamAppSlug(slug)
        const account = connectedAccounts.find(
            (acc) => acc.app?.nameSlug?.toLowerCase() === pipedreamAppSlug.toLowerCase()
        )
        const connected = Boolean(account?.healthy) && !account?.dead

        return connected && account ? [{ slug, connectedAccountId: account.id }] : []
    })

    return [...directTools, ...pipedreamTools]
}
