// Generic retry helper for a transient external-call failure — same
// couple-of-quick-retries-with-backoff shape as lib/groq.ts's
// generateWithRetry, reused by tools that had no retry logic of their own
// (lib/serpapi-tool.ts, lib/browserbase-tool.ts — see
// agent-reliability-report.md §6 recommendation 7).
export const withRetries = async <T>(
    fn: () => Promise<T>,
    options: { attempts?: number; backoffMs?: number; isRetryable?: (error: unknown) => boolean } = {}
): Promise<T> => {
    const attempts = options.attempts ?? 3
    const backoffMs = options.backoffMs ?? 300
    const isRetryable = options.isRetryable ?? (() => true)

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await fn()
        } catch (error) {
            if (attempt === attempts || !isRetryable(error)) throw error
            await new Promise((resolve) => setTimeout(resolve, attempt * backoffMs))
        }
    }

    // Unreachable — the loop above always returns or throws.
    throw new Error("withRetries exhausted its attempts without a result")
}
