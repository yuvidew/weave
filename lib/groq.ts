import Groq, { APIError } from "groq-sdk";
import type { ChatCompletionCreateParamsNonStreaming } from "groq-sdk/resources/chat/completions";

// Model shared by every Groq call in the app (agent config generation, chat
// replies) — keeping it in one place means a future model swap is one edit.
export const GROQ_MODEL = "openai/gpt-oss-120b";

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Groq returns 503 when a model is temporarily overloaded and 429 when
// rate-limited — both are transient, so retry a couple times with a short
// backoff before giving up instead of failing the whole request immediately.
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
            const isRetryable = error instanceof APIError && (error.status === 503 || error.status === 429)

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
