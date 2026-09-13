import { PipedreamClient } from "@pipedream/sdk";

// Server-side Pipedream Connect client — replaces the old Composio client.
// Unlike Composio, this has no LLM "provider" concept and no session to
// create/persist: every call is just (externalUserId, app-or-accountId), and
// the signed-in user's email doubles as the externalUserId directly —
// connections are per-user, not per-agent, so connecting an app once makes
// it available to every one of that user's agents (see lib/agent-tools.ts).
export const pipedream = new PipedreamClient({
    projectEnvironment: process.env.PIPEDREAM_ENVIRONMENT as "development" | "production",
    clientId: process.env.PIPEDREAM_CLIENT_ID,
    clientSecret: process.env.PIPEDREAM_CLIENT_SECRET,
    // Required by the SDK's types (unlike clientId/clientSecret) — env vars
    // are always `string | undefined` to TS, so this still needs a cast.
    projectId: process.env.PIPEDREAM_PROJECT_ID as string,
});

// A few of the `tools` catalog's slugs (see db/seed.ts) don't have their own
// Pipedream app — they're a generic capability actually backed by one
// specific provider's app. Map those through; everything else's catalog
// slug already matches its Pipedream app slug directly (e.g. "gmail",
// "notion"). Note: two catalog tools resolving to the same Pipedream app
// share one underlying connected account — connecting/disconnecting either
// affects both.
// (No entries currently — "google_search" used to map to Pipedream's
// "serpapi" app here, but it's now a direct-auth tool backed by a shared
// SerpAPI key instead; see constant/direct-auth-tools.ts and
// lib/serpapi-tool.ts. Every call site checks isDirectAuthTool(slug) before
// ever reaching resolvePipedreamAppSlug, so this map is dead for that slug.)
const CATALOG_SLUG_TO_PIPEDREAM_APP: Record<string, string> = {}

// Resolves a catalog tool slug to the Pipedream app slug that actually
// backs it, per the mapping above.
export const resolvePipedreamAppSlug = (slug: string) =>
    CATALOG_SLUG_TO_PIPEDREAM_APP[slug.toLowerCase()] ?? slug
