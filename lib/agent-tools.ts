import { pipedream, resolvePipedreamAppSlug } from "@/lib/pipedream";
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

    // Pipedream 404s this call (instead of returning []) for an
    // externalUserId it's never seen before — i.e. an agent that's never had
    // any tool connected yet — so that specific case means "no connected
    // accounts," not a real failure.
    const connectedAccounts = await pipedream.accounts.listByExternalUser(agentId).catch((error) => {
        if (error instanceof PipedreamError && error.statusCode === 404) return []
        throw error
    })

    return allowedSlugs.flatMap((slug) => {
        const pipedreamAppSlug = resolvePipedreamAppSlug(slug)
        const account = connectedAccounts.find(
            (acc) => acc.app?.nameSlug?.toLowerCase() === pipedreamAppSlug.toLowerCase()
        )
        const connected = Boolean(account?.healthy) && !account?.dead

        return connected && account ? [{ slug, connectedAccountId: account.id }] : []
    })
}
