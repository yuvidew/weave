import Browserbase from "@browserbasehq/sdk"

// Terminal statuses for a Browserbase agent run — once reached, `result` is
// populated (if any) and polling stops.
const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "STOPPED", "TIMED_OUT"]

// How long to poll one Browserbase run before giving up, and how often to
// check. This is a synchronous request/response with no streaming (same
// tradeoff app/api/agent/chat/_lib.ts's runChatTurn already accepts for
// every other action) — app/api/agent/chat/route.ts and
// app/api/agent/chat/resolve/route.ts set a matching `maxDuration` so a
// serverless deployment doesn't kill the function mid-poll.
const POLL_DEADLINE_MS = 3 * 60 * 1000 // 3 minutes
const POLL_INTERVAL_MS = 3000

// Overrides the dashboard Agent's own resultSchema, which requires every
// findings[] item to carry name/price/details/sourceUrl and the top-level
// object to carry summary/findings/caveats. That's stricter than a research
// task can usually satisfy (not every finding has a clean price, sometimes
// there's nothing to caveat) — the agent kept producing a `done` call the
// schema rejected until the run gave up entirely ("The agent repeatedly
// returned an invalid `done` tool call"). Only `summary` is required here;
// everything else is left optional so a run can still finish cleanly.
const RESULT_SCHEMA = {
    type: "object",
    properties: {
        summary: { type: "string" },
        findings: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    price: { type: "string" },
                    details: { type: "string" },
                    sourceUrl: { type: "string" },
                },
            },
        },
        caveats: { type: "array", items: { type: "string" } },
    },
    required: ["summary"],
}

// Runs Browserbase's preconfigured dashboard Agent (BROWSERBASE_AGENT_ID —
// not this app's own AgentConfig) against a model-supplied research task and
// polls until it reaches a terminal state. Plugged in as `browser_research`'s
// `run` in constant/agent-actions.ts.
export const runBrowserResearch = async (
    args: Record<string, unknown>
): Promise<{ runId: string; status: string; result: unknown }> => {
    const task = typeof args.task === "string" ? args.task.trim() : ""
    if (!task) {
        throw new Error('browser_research requires a non-empty "task" describing what to look up.')
    }

    const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! })
    const { runId } = await bb.agents.runs.create({
        agentId: process.env.BROWSERBASE_AGENT_ID!,
        task,
        browserSettings: { proxies: true },
        resultSchema: RESULT_SCHEMA,
    })

    const deadline = Date.now() + POLL_DEADLINE_MS
    while (Date.now() < deadline) {
        const run = await bb.agents.runs.retrieve(runId)

        if (TERMINAL_STATUSES.includes(run.status)) {
            if (run.status !== "COMPLETED") {
                throw new Error(`Browser research ${run.status.toLowerCase()} before finishing.`)
            }
            return { runId, status: run.status, result: run.result }
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }

    throw new Error(`Browser research timed out after ${POLL_DEADLINE_MS / 1000}s — try a narrower task.`)
}
