// Races a promise against a fixed deadline so a hung external call (a
// Pipedream action, a stalled Groq stream, etc. with no timeout of its own)
// can't hang an entire Inngest step indefinitely — see
// agent-reliability-report.md §6 recommendation 6. Note this only stops
// *waiting* on the original promise; nothing here cancels the underlying
// work, so a very late resolution can still write data after the timeout
// already fired (a real limitation without an AbortController threaded all
// the way through Pipedream/Groq/Browserbase calls — noted as a known gap).
export const withTimeout = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> =>
    Promise.race([
        promise,
        new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(message)), ms)
        }),
    ])
