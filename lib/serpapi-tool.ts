// Caps how many organic results are kept — SerpAPI's raw response carries
// far more fields (ads, related searches, pagination, etc.) than a model
// needs to answer a question, so only a trimmed, relevant slice is returned.
const DEFAULT_NUM_RESULTS = 5
const MAX_NUM_RESULTS = 10

// Guards against a hung request stalling the whole chat turn — a plain
// search should resolve in a couple of seconds, not minutes (unlike
// lib/browserbase-tool.ts's multi-minute poll).
const REQUEST_TIMEOUT_MS = 15000

type SerpApiOrganicResult = {
    title?: string
    link?: string
    snippet?: string
}

type SerpApiResponse = {
    error?: string
    answer_box?: { answer?: string; snippet?: string }
    organic_results?: SerpApiOrganicResult[]
}

// Runs a real Google search via SerpAPI (a single shared server-side API
// key — no per-agent connection, same auth model as
// lib/browserbase-tool.ts). Plugged in as `web_search`'s `run` in
// constant/agent-actions.ts.
export const runWebSearch = async (
    args: Record<string, unknown>
): Promise<{ query: string; answer: string | null; results: { title: string; link: string; snippet: string }[] }> => {
    const query = typeof args.query === "string" ? args.query.trim() : ""
    if (!query) {
        throw new Error('web_search requires a non-empty "query".')
    }

    const requestedNum = typeof args.numResults === "number" ? args.numResults : DEFAULT_NUM_RESULTS
    const numResults = Math.min(Math.max(Math.trunc(requestedNum) || DEFAULT_NUM_RESULTS, 1), MAX_NUM_RESULTS)

    const url = new URL("https://serpapi.com/search.json")
    url.searchParams.set("engine", "google")
    url.searchParams.set("q", query)
    url.searchParams.set("num", String(numResults))
    url.searchParams.set("api_key", process.env.SERPAPI_API_KEY!)

    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
    const data = (await response.json()) as SerpApiResponse

    // SerpAPI can return a 200 with an `error` field (e.g. a bad api_key or
    // an unsupported query) instead of a non-OK status — check both.
    if (!response.ok || data.error) {
        throw new Error(data.error || `SerpAPI request failed (${response.status}).`)
    }

    return {
        query,
        answer: data.answer_box?.answer ?? data.answer_box?.snippet ?? null,
        results: (data.organic_results ?? []).slice(0, numResults).map((result) => ({
            title: result.title ?? "",
            link: result.link ?? "",
            snippet: result.snippet ?? "",
        })),
    }
}
