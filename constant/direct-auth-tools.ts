// Catalog slugs whose auth is a single shared server-side credential (an API
// key / preconfigured resource read from .env) rather than a per-agent
// Pipedream OAuth connection — these are always "available" once listed in
// an agent's `tools`, with no Connect/Disconnect flow. Deliberately
// import-free (unlike constant/agent-actions.ts, which pulls in
// @/lib/pipedream at module scope) so client components — e.g.
// features/agents/_components/agent-edit-sheet.tsx — can check this without
// dragging any server-only SDK client construction into the client bundle.
// "serpapi" and "google_search" are two separate seeded `tools` catalog rows
// (db/seed.ts) that are functionally the same search capability — both need
// to be direct-auth, or an agent-config LLM that happens to pick "serpapi"
// instead of "google_search" would still hit the old Pipedream connect flow.
export const DIRECT_AUTH_TOOL_SLUGS = ["browserbase", "google_search", "serpapi"] as const

// Whether `slug` skips the Pipedream connect flow entirely.
export const isDirectAuthTool = (slug: string): boolean =>
    (DIRECT_AUTH_TOOL_SLUGS as readonly string[]).includes(slug)

// Static display metadata for direct-auth tools, used in place of
// pipedream.apps.retrieve (which has no matching app for these slugs).
export const DIRECT_AUTH_TOOL_DISPLAY: Record<string, { name: string; logo: string }> = {
    browserbase: { name: "Browserbase", logo: "" },
    google_search: { name: "Google Search", logo: "" },
    serpapi: { name: "SERP Search", logo: "" },
}
