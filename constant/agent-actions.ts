import { pipedream } from "@/lib/pipedream";
import { runBrowserResearch } from "@/lib/browserbase-tool";
import { runWebSearch } from "@/lib/serpapi-tool";

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
// Fields common to both execution styles below.
type AgentActionBase = {
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
    // When true, this action pauses for the user's approval before running
    // (see app/api/agent/chat/_lib.ts / resolve/route.ts) instead of running
    // immediately. Every action below currently sets this to false — the
    // approval-gate machinery stays in place (DB status, ToolCallCard,
    // resolve route) so it can be turned back on per-action later, but
    // nothing in the app requests it right now.
    needsApproval: boolean
    // Human-readable summary shown on the approval card / as a status line.
    toApprovalLabel: (args: Record<string, any>) => string
}

// Executed via pipedream.actions.run — every action needs a connected
// Pipedream account for its `catalogSlug` (see lib/agent-tools.ts).
export type PipedreamAgentAction = AgentActionBase & {
    // Verified Pipedream action component id (see module comment above).
    componentId: string
    // Name of this component's "app"-type configurable prop — the caller
    // sets `configuredProps[appPropName] = { authProvisionId: connectedAccountId }`.
    appPropName: string
    // Turns the model's parsed JSON arguments into this component's
    // configuredProps (minus the app prop, added separately by the caller).
    toConfiguredProps: (args: Record<string, any>) => Record<string, unknown>
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
    run?: undefined
}

// Executed directly (no Pipedream involved) — for tools whose auth is a
// single shared server-side credential rather than a per-agent OAuth
// connection (see constant/direct-auth-tools.ts). `runChatTurn` calls `run`
// straight away, skipping the "connected account" requirement entirely.
type DirectAgentAction = AgentActionBase & {
    run: (args: Record<string, any>) => Promise<unknown>
    componentId?: undefined
    appPropName?: undefined
    toConfiguredProps?: undefined
    resolveMissingArgs?: undefined
}

export type AgentActionDef = PipedreamAgentAction | DirectAgentAction

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
    {
        name: "slack_send_message",
        description: "Send a message to a Slack channel, user, or group via the connected Slack workspace.",
        parameters: {
            type: "object",
            properties: {
                channel: {
                    type: "string",
                    description: "Channel name (e.g. \"#general\" or \"general\"), channel ID, user ID, or group ID to post the message to — channel names are resolved to IDs automatically.",
                },
                text: { type: "string", description: "The message text to post. Supports Slack mrkdwn formatting (e.g. \"*bold*\", \"_italic_\")." },
            },
            required: ["channel", "text"],
        },
        catalogSlug: "slack_v2",
        componentId: "slack_v2-post-message",
        appPropName: "slack",
        needsApproval: false,
        toConfiguredProps: (args) => ({
            channel: args.channel,
            text: args.text,
        }),
        toApprovalLabel: (args) => `Post to Slack ${args.channel}: ${String(args.text ?? "").slice(0, 80)}`,
    },
    {
        name: "browser_research",
        description:
            "Use this when the user asks you to browse or search the live internet, compare current prices, check current availability, or verify up-to-date information on a specific site you can't answer from your own knowledge. Runs a real, sandboxed browser session and can take up to a few minutes. Treat this strictly as read-only research — never use it to submit forms, log in, or make purchases.",
        parameters: {
            type: "object",
            properties: {
                task: {
                    type: "string",
                    description:
                        "A complete, self-contained instruction describing exactly what to find or verify on the live web, including the specific site/product/query — the browser agent has no other context.",
                },
            },
            required: ["task"],
        },
        catalogSlug: "browserbase",
        // Framed and prompted as read-only research — a blanket approval
        // gate would defeat the "quick price/availability check" use case.
        // Known simplification: the seeded `tools` catalog row's
        // `approvalRules` implies per-behavior approval (e.g. gate checkout
        // but not navigation), which this single static boolean can't
        // express for one opaque Browserbase run — real parity would need
        // `needsApproval` to become a function of the task text, or
        // constraints on the underlying Browserbase Agent itself.
        needsApproval: false,
        run: (args) => runBrowserResearch(args),
        toApprovalLabel: (args) => `Browser research: ${String(args.task ?? "").slice(0, 120)}`,
    },
    {
        name: "web_search",
        // Complements browser_research: this is a fast, structured Google
        // search via SerpAPI — no page navigation, just search results.
        // Prefer this for a quick lookup; reach for browser_research when
        // the task needs to actually visit/verify a specific page.
        description:
            "Search the web for current information, facts, or links using Google search results. Fast and read-only — prefer this over browser_research for a quick lookup that doesn't require visiting/verifying a specific page. Don't repeat a similar search if an earlier one in this conversation already returned relevant results — reuse what you already have instead of searching again. Returns only titles/links/snippets — there is no separate tool to \"open\" or fetch a result's full page; work from the snippet text, or call browser_research if you genuinely need a specific page's full content.",
        parameters: {
            type: "object",
            properties: {
                query: { type: "string", description: "The search query." },
                numResults: { type: "integer", description: "How many results to return (default 5, max 10)." },
            },
            required: ["query"],
        },
        catalogSlug: "google_search",
        needsApproval: false,
        run: (args) => runWebSearch(args),
        toApprovalLabel: (args) => `Web search: ${String(args.query ?? "")}`,
    },
]

// "serpapi" and "google_search" are two separate seeded `tools` catalog
// slugs (db/seed.ts) for the same underlying search capability — an
// agent-config LLM might pick either one. Rather than duplicating the
// web_search action under two catalogSlug values, normalize "serpapi" to
// "google_search" here so either slug unlocks it.
const CATALOG_SLUG_ALIASES: Record<string, string> = { serpapi: "google_search" }

// Builds the set of actions available this turn from an agent's *connected*
// catalog slugs (not just its configured `tools` list — see
// lib/agent-tools.ts's getConnectedTools).
export const getActionsForSlugs = (slugs: string[]): AgentActionDef[] => {
    const normalizedSlugs = new Set(slugs.map((slug) => CATALOG_SLUG_ALIASES[slug] ?? slug))
    return AGENT_ACTIONS.filter((action) => normalizedSlugs.has(action.catalogSlug))
}

// Looks up an action by the Groq function name a tool_call resolved to.
export const findActionByName = (name: string): AgentActionDef | undefined =>
    AGENT_ACTIONS.find((action) => action.name === name)
