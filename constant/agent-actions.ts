import { pipedream } from "@/lib/pipedream";

// Curated, hand-picked catalog of actions an agent can call during chat,
// each mapped to one specific, verified Pipedream action component with
// static (non-dependent) parameters — deliberately not the full Pipedream
// action registry, which would need dynamic/remote-options prop resolution
// (e.g. picking a Slack channel) that this pass skips. Every `componentId`
// and `configurableProps` name below was confirmed live against Pipedream's
// registry (pipedream.actions.list/retrieve) before being hardcoded here —
// see app/api/agent/chat/route.ts for how this catalog is used.

// Minimal shape of an AgentConfig row an action's `resolveMissingArgs` needs
// — avoids importing the full Drizzle row type, which would create a
// circular import (app/api/agent/chat/_lib.ts already imports from here).
export type AgentConfigLike = {
    agentId: string
    // Drizzle infers untyped jsonb columns as `unknown` (same as
    // AgentConfig.tools/skills elsewhere) — narrow it at the read site.
    toolDefaults: unknown
}

// One action Groq can choose to call. `name` doubles as the OpenAI/Groq
// function name, so it must be a valid identifier (no spaces/dashes).
export type AgentActionDef = {
    name: string
    description: string
    // JSON Schema for ChatCompletionTool.function.parameters — what the
    // model is asked to fill in. Deliberately does NOT include the
    // Pipedream "app" prop (e.g. "gmail") — that's account plumbing the
    // model never sees, wired in by the caller via `appPropName`.
    parameters: Record<string, unknown>
    // Catalog slug (e.g. "gmail") this action requires connected — gates
    // which actions are even offered to Groq for a given agent.
    catalogSlug: string
    // Verified Pipedream action component id (see module comment above).
    componentId: string
    // Name of this component's "app"-type configurable prop — the caller
    // sets `configuredProps[appPropName] = { authProvisionId: connectedAccountId }`.
    appPropName: string
    // When true, this action pauses for the user's approval before running
    // (see app/api/agent/chat/_lib.ts / resolve/route.ts) instead of running
    // immediately. Every action below currently sets this to false — the
    // approval-gate machinery stays in place (DB status, ToolCallCard,
    // resolve route) so it can be turned back on per-action later, but
    // nothing in the app requests it right now.
    needsApproval: boolean
    // Turns the model's parsed JSON arguments into this component's
    // configuredProps (minus the app prop, added separately by the caller).
    toConfiguredProps: (args: Record<string, any>) => Record<string, unknown>
    // Human-readable summary shown on the approval card / as a status line.
    toApprovalLabel: (args: Record<string, any>) => string
    // Optional: fills in args the model left out but that it should never
    // have to ask the user for (e.g. a Notion parent page — the model has no
    // way to know a real page UUID on its own). Called before
    // toConfiguredProps/toApprovalLabel; its return value is merged
    // *underneath* the model's own args, so an explicit value always wins.
    // Implementations are expected to persist anything they discover onto
    // `agent.toolDefaults` (via the caller-injected `persistDefault`) so
    // future turns skip the lookup entirely.
    resolveMissingArgs?: (
        args: Record<string, any>,
        ctx: {
            agent: AgentConfigLike
            connectedAccountId: string
            persistDefault: (values: Record<string, unknown>) => Promise<void>
        }
    ) => Promise<Record<string, unknown>>
}

export const AGENT_ACTIONS: AgentActionDef[] = [
    {
        name: "gmail_send_email",
        description: "Send a new email from the connected Gmail account.",
        parameters: {
            type: "object",
            properties: {
                to: {
                    type: "array",
                    items: { type: "string" },
                    description: "Recipient email addresses.",
                },
                subject: { type: "string", description: "Subject line." },
                body: { type: "string", description: "Plain text email body." },
            },
            required: ["to", "subject", "body"],
        },
        catalogSlug: "gmail",
        componentId: "gmail-send-email",
        appPropName: "gmail",
        needsApproval: false,
        toConfiguredProps: (args) => ({
            to: args.to,
            subject: args.subject,
            body: args.body,
            bodyType: "plaintext",
        }),
        toApprovalLabel: (args) =>
            `Send email to ${(Array.isArray(args.to) ? args.to : [args.to]).join(", ")} — Subject: ${args.subject}`,
    },
    {
        name: "gmail_list_recent_emails",
        description: "List the most recent emails in the connected Gmail inbox, optionally filtered by a search query.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "Optional Gmail search query (e.g. \"is:unread\")." },
                maxResults: { type: "integer", description: "How many emails to fetch (default 5)." },
            },
            required: [],
        },
        catalogSlug: "gmail",
        componentId: "gmail-find-email",
        appPropName: "gmail",
        needsApproval: false,
        toConfiguredProps: (args) => ({
            q: args.query || undefined,
            maxResults: args.maxResults ?? 5,
            format: "metadata",
        }),
        toApprovalLabel: () => "List recent emails",
    },
    {
        name: "notion_create_page",
        description: "Create a new Notion page under a given parent page or database.",
        parameters: {
            type: "object",
            properties: {
                parentId: {
                    type: "string",
                    description:
                        "Optional. Only set this if the user explicitly names a different Notion page/database for this request. Otherwise omit it entirely — the app automatically finds and reuses an appropriate page, so never ask the user for a page ID or link.",
                },
                title: { type: "string", description: "The page title." },
                content: { type: "string", description: "The page body, as Markdown." },
            },
            required: ["title"],
        },
        catalogSlug: "notion",
        componentId: "notion-create-page",
        appPropName: "notion",
        needsApproval: false,
        toConfiguredProps: (args) => ({
            parent: args.parentId,
            title: args.title,
            content: args.content || undefined,
        }),
        toApprovalLabel: (args) => `Create Notion page "${args.title}"`,
        // The model can't know a real Notion page UUID on its own, and Notion
        // has no "workspace root" — every page needs a parent. Rather than
        // asking the user, reuse a previously-discovered default, or (the
        // very first time only) search the pages already shared with this
        // Notion connection and adopt the first one. Safe to just take
        // result[0]: this search only ever runs once per agent, before any
        // page this action creates exists yet, so every candidate at that
        // point is genuinely pre-existing, user-shared content.
        resolveMissingArgs: async (args, { agent, connectedAccountId, persistDefault }) => {
            if (args.parentId) return {}

            const stored = agent.toolDefaults as Record<string, Record<string, unknown>> | null
            const storedParentId = stored?.notion_create_page?.parentId
            if (storedParentId) return { parentId: storedParentId }

            const search = await pipedream.actions.run({
                id: "notion-search",
                externalUserId: agent.agentId,
                configuredProps: {
                    notion: { authProvisionId: connectedAccountId },
                    filter: "page",
                    pageSize: 1,
                },
            })
            const first = (search.ret as { results?: { id: string }[] } | undefined)?.results?.[0]
            if (!first) {
                throw new Error(
                    "No Notion pages are shared with this connection yet — open Notion → Settings → Connections, share at least one page with it, then try again."
                )
            }

            await persistDefault({ parentId: first.id })
            return { parentId: first.id }
        },
    },
    {
        name: "google_calendar_create_event",
        description: "Create a new event on the connected Google Calendar (primary calendar).",
        parameters: {
            type: "object",
            properties: {
                summary: { type: "string", description: "Event title." },
                startDateTime: {
                    type: "string",
                    description: "Event start, as an RFC3339 timestamp (e.g. \"2026-01-15T09:00:00-05:00\") or, for an all-day event, \"yyyy-mm-dd\".",
                },
                endDateTime: {
                    type: "string",
                    description: "Event end, in the same format as startDateTime.",
                },
                location: { type: "string", description: "Optional event location." },
                description: { type: "string", description: "Optional event description." },
            },
            required: ["summary", "startDateTime", "endDateTime"],
        },
        catalogSlug: "google_calendar",
        componentId: "google_calendar-create-event",
        appPropName: "googleCalendar",
        needsApproval: false,
        toConfiguredProps: (args) => ({
            summary: args.summary,
            eventStartDate: args.startDateTime,
            eventEndDate: args.endDateTime,
            location: args.location || undefined,
            description: args.description || undefined,
        }),
        toApprovalLabel: (args) => `Create calendar event "${args.summary}" (${args.startDateTime} – ${args.endDateTime})`,
    },
    {
        name: "google_calendar_list_events",
        description: "List upcoming events on the connected Google Calendar (primary calendar).",
        parameters: {
            type: "object",
            properties: {
                timeMin: { type: "string", description: "Only return events starting after this RFC3339 timestamp (default: now)." },
                timeMax: { type: "string", description: "Only return events starting before this RFC3339 timestamp." },
                maxResults: { type: "integer", description: "How many events to fetch (default 10)." },
                query: { type: "string", description: "Optional free-text search." },
            },
            required: [],
        },
        catalogSlug: "google_calendar",
        componentId: "google_calendar-list-events",
        appPropName: "googleCalendar",
        needsApproval: false,
        toConfiguredProps: (args) => ({
            timeMin: args.timeMin || new Date().toISOString(),
            timeMax: args.timeMax || undefined,
            maxResults: args.maxResults ?? 10,
            q: args.query || undefined,
            singleEvents: true,
            orderBy: "startTime",
        }),
        toApprovalLabel: () => "List upcoming calendar events",
    },
]

// Builds the set of actions available this turn from an agent's *connected*
// catalog slugs (not just its configured `tools` list — see
// lib/agent-tools.ts's getConnectedTools).
export const getActionsForSlugs = (slugs: string[]): AgentActionDef[] =>
    AGENT_ACTIONS.filter((action) => slugs.includes(action.catalogSlug))

// Looks up an action by the Groq function name a tool_call resolved to.
export const findActionByName = (name: string): AgentActionDef | undefined =>
    AGENT_ACTIONS.find((action) => action.name === name)
