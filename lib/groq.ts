import Groq, { APIError } from "groq-sdk";
import type { ChatCompletionCreateParamsNonStreaming } from "groq-sdk/resources/chat/completions";

// Model shared by every Groq call in the app (agent config generation, chat
// replies) — keeping it in one place means a future model swap is one edit.
export const GROQ_MODEL = "openai/gpt-oss-120b";

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// A 429's `retry-after` header tells us how long Groq wants us to wait. Groq
// sends 429 for both a short per-minute burst (worth a quick retry) and an
// exhausted daily token quota (retry-after in the hundreds of seconds) — only
// the former is worth our own sub-second backoff, so this caps which 429s
// `generateWithRetry` bothers retrying at all.
const MAX_RETRYABLE_RETRY_AFTER_SECONDS = 5

// Seconds Groq says to wait before retrying, from a 429's `retry-after`
// header — null if the error isn't a 429 or the header's missing/unparseable.
const getRetryAfterSeconds = (error: unknown): number | null => {
    if (!(error instanceof APIError) || error.status !== 429) return null

    const header = error.headers?.get?.("retry-after")
    const seconds = header ? Number(header) : NaN
    return Number.isFinite(seconds) ? seconds : null
}

// Groq returns 503 when a model is temporarily overloaded and 429 when
// rate-limited — both are transient, so retry a couple times with a short
// backoff before giving up instead of failing the whole request immediately.
// A 429 backed by a long `retry-after` (e.g. a daily token quota) skips
// retries entirely — it won't resolve within milliseconds, so retrying just
// adds latency and log noise before failing anyway.
// Shared by app/api/agent/configure/route.ts and app/api/agent/chat/route.ts.
export const generateWithRetry = async (
    client: Groq,
    params: ChatCompletionCreateParamsNonStreaming,
    attempts = 3
) => {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await client.chat.completions.create(params)
        } catch (error) {
            const retryAfterSeconds = getRetryAfterSeconds(error)
            const isRetryable =
                error instanceof APIError &&
                (error.status === 503 || (error.status === 429 && (retryAfterSeconds ?? 0) <= MAX_RETRYABLE_RETRY_AFTER_SECONDS))

            if (!isRetryable || attempt === attempts) throw error

            await new Promise((resolve) => setTimeout(resolve, attempt * 500))
        }
    }

    // Unreachable — the loop above always returns or throws.
    throw new Error("generateWithRetry exhausted its attempts without a result")
}

// True when a Groq error means "the model is temporarily overloaded" — used
// to pick a friendlier error message/status code than a generic 500.
export const isGroqOverloaded = (error: unknown) => error instanceof APIError && error.status === 503

// True when a Groq error means "rate limit hit" (per-minute burst or a daily
// token quota) — distinct from isGroqOverloaded so callers can tell the user
// how long to wait via getGroqRetryAfterMinutes below, instead of a generic
// "failed to generate" message.
export const isGroqRateLimited = (error: unknown) => error instanceof APIError && error.status === 429

// Minutes until Groq's rate limit resets, read from the 429's `retry-after`
// header — null when that can't be determined, so callers fall back to a
// generic "try again shortly" instead of a made-up number.
export const getGroqRetryAfterMinutes = (error: unknown): number | null => {
    const seconds = getRetryAfterSeconds(error)
    return seconds === null ? null : Math.ceil(seconds / 60)
}
