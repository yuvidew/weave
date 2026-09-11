import { pipedream, resolvePipedreamAppSlug } from "@/lib/pipedream";
import { isDirectAuthTool } from "@/constant/direct-auth-tools";
import { PipedreamError } from "@pipedream/sdk";

export type ConnectedTool = {
    slug: string;
    connectedAccountId: string;
};

// Resolves which of an agent's allowed catalog slugs are actually connected
// (a healthy, non-dead Pipedream account exists) right now, along with the
// Pipedream account id each one needs for actions.run()'s app-type
// configuredProps (`{ authProvisionId: connectedAccountId }`). Shared by
// GET /api/agent/tools (display) and app/api/agent/chat/route.ts (deciding
// which curated actions to actually offer the model this turn).
export const getConnectedTools = async (
    agentId: string,
    allowedSlugs: string[]
): Promise<ConnectedTool[]> => {
    if (allowedSlugs.length === 0) return [];

    // Direct-auth tools (e.g. "browserbase") use one shared server-side API
    // key, not a per-agent Pipedream OAuth account — they're always
    // available, so skip the Pipedream lookup for them entirely.
    // `connectedAccountId` is a sentinel here; direct actions never read it.
    const directTools: ConnectedTool[] = allowedSlugs
        .filter(isDirectAuthTool)
        .map((slug) => ({ slug, connectedAccountId: "direct" }))

    const pipedreamSlugs = allowedSlugs.filter((slug) => !isDirectAuthTool(slug))
    if (pipedreamSlugs.length === 0) return directTools

    // Pipedream 404s this call (instead of returning []) for an
    // externalUserId it's never seen before — i.e. an agent that's never had
    // any tool connected yet — so that specific case means "no connected
    // accounts," not a real failure.
    const connectedAccounts = await pipedream.accounts.listByExternalUser(agentId).catch((error) => {
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
