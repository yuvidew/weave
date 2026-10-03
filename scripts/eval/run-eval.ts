// Eval harness for the agent execution loop — drives the real `runChatTurn()`
// tool-calling loop (the same function chat, scheduled runs, and "Run now"
// all share) against a set of throwaway agents, one per scenario in
// scenarios.ts, then reads back `chatMessages` — the ground-truth execution
// trace — to check for hallucination, infinite-loop, and bad-tool-call
// failure modes. See agent-reliability-report.md for the full writeup.
//
// Usage: npm run eval:agent [-- --keep]
//   --keep   skip deleting the throwaway eval-* rows afterward, so they can
//            be inspected manually via `npm run db:studio`.
import { mkdirSync, writeFileSync } from "fs"
import { join } from "path"
import { asc, eq, inArray } from "drizzle-orm"
import { AgentConfig, chatMessages, db, users } from "@/db"
import { getConnectedTools } from "@/lib/agent-tools"
import { runChatTurn, MAX_ITERATIONS, STEPS_EXHAUSTED_MESSAGE, type StoredToolCall } from "@/app/api/agent/chat/_lib"
import { EVAL_SCENARIOS, type EvalScenario } from "./scenarios"

const KEEP = process.argv.includes("--keep")
// Every scenario's throwaway agentId is namespaced under this run's tag, so
// cleanup and manual inspection can both target `${RUN_TAG}-*` reliably.
const RUN_TAG = `eval-${Date.now()}`

type ScenarioResult = {
    id: string
    description: string
    expectation: string
    iterations: number
    hitMaxIterations: boolean
    toolCalls: { name: string; arguments: Record<string, unknown>; status: string; error?: string }[]
    duplicateToolCalls: boolean
    finishedViaFallback: boolean
    finalContent: string | null
}

// Runs one scenario end to end: creates a throwaway agent + seed prompt,
// drives the real loop, then reconstructs the full turn trace from
// chatMessages to grade what actually happened (iteration count, every tool
// call and its outcome, whether the loop hit MAX_ITERATIONS, etc.).
const runScenario = async (scenario: EvalScenario, userEmail: string): Promise<ScenarioResult> => {
    const agentId = `${RUN_TAG}-${scenario.id}`

    const [agent] = await db
        .insert(AgentConfig)
        .values({
            agentId,
            userEmail,
            name: `Eval: ${scenario.id}`,
            description: scenario.description,
            objective: scenario.objective,
            instructions: scenario.instructions,
            tools: scenario.tools,
            status: "inactive", // never surfaces as a real agent anywhere in the UI
        })
        .returning()

    await db.insert(chatMessages).values({
        agentId,
        userEmail,
        role: "user",
        content: scenario.prompt,
    })

    const history = await db.select().from(chatMessages).where(eq(chatMessages.agentId, agentId)).orderBy(asc(chatMessages.id))
    const connectedTools = await getConnectedTools(userEmail, scenario.tools)

    await runChatTurn(agent, history, connectedTools)

    const trace = await db.select().from(chatMessages).where(eq(chatMessages.agentId, agentId)).orderBy(asc(chatMessages.id))
    const assistantRows = trace.filter((row) => row.role === "assistant")
    const allToolCalls: StoredToolCall[] = assistantRows.flatMap((row) => (row.toolCalls as StoredToolCall[] | null) ?? [])
    const finalRow = assistantRows[assistantRows.length - 1]

    // A repeated call (same tool + identical arguments) is exactly the
    // "spins its wheels" behavior nothing in the loop currently detects —
    // see the guardrail table in agent-reliability-report.md.
    const seenCallSignatures = new Set<string>()
    let duplicateToolCalls = false
    for (const call of allToolCalls) {
        const signature = `${call.name}:${JSON.stringify(call.arguments)}`
        if (seenCallSignatures.has(signature)) duplicateToolCalls = true
        seenCallSignatures.add(signature)
    }

    return {
        id: scenario.id,
        description: scenario.description,
        expectation: scenario.expectation,
        iterations: assistantRows.length,
        hitMaxIterations: assistantRows.length >= MAX_ITERATIONS,
        toolCalls: allToolCalls.map((call) => ({ name: call.name, arguments: call.arguments, status: call.status, error: call.error })),
        duplicateToolCalls,
        finishedViaFallback: finalRow?.content === STEPS_EXHAUSTED_MESSAGE,
        finalContent: finalRow?.content ?? null,
    }
}

// Deletes every row this run created — chatMessages first, since it FKs to
// AgentConfig.agentId.
const cleanup = async (scenarioIds: string[]) => {
    const agentIds = scenarioIds.map((id) => `${RUN_TAG}-${id}`)
    await db.delete(chatMessages).where(inArray(chatMessages.agentId, agentIds))
    await db.delete(AgentConfig).where(inArray(AgentConfig.agentId, agentIds))
}

const main = async () => {
    // Reuses whichever real user already exists in this DB, purely to
    // satisfy the userEmail → users.email FK — the eval agents don't
    // otherwise touch anything belonging to that user.
    const [userRow] = await db.select().from(users).limit(1)
    if (!userRow) {
        throw new Error("No row in `users` table — sign into the app at least once first so there's a valid userEmail for the FK.")
    }

    console.log(`Running ${EVAL_SCENARIOS.length} eval scenarios as ${userRow.email} (tag: ${RUN_TAG})...\n`)

    const results: ScenarioResult[] = []
    for (const [index, scenario] of EVAL_SCENARIOS.entries()) {
        // Small pacing gap between scenarios — the loop-bait scenario alone
        // burns most of Groq's free-tier tokens-per-minute budget, so running
        // scenarios back-to-back with no gap risks the *harness itself*
        // tripping a 429 on an unrelated later scenario, muddying results.
        if (index > 0) await new Promise((resolve) => setTimeout(resolve, 15_000))

        process.stdout.write(`-> ${scenario.id} ... `)
        try {
            const result = await runScenario(scenario, userRow.email)
            results.push(result)
            console.log(`done (${result.iterations} iteration(s), ${result.toolCalls.length} tool call(s))`)
        } catch (error) {
            console.log("ERRORED")
            results.push({
                id: scenario.id,
                description: scenario.description,
                expectation: scenario.expectation,
                iterations: 0,
                hitMaxIterations: false,
                toolCalls: [],
                duplicateToolCalls: false,
                finishedViaFallback: false,
                finalContent: `[harness error] ${error instanceof Error ? error.message : String(error)}`,
            })
        }
    }

    console.log("\n=== Results ===\n")
    for (const result of results) {
        console.log(`## ${result.id}`)
        console.log(`   expectation: ${result.expectation}`)
        console.log(`   iterations: ${result.iterations}${result.hitMaxIterations ? " (HIT MAX_ITERATIONS)" : ""}`)
        console.log(`   tool calls: ${result.toolCalls.map((c) => `${c.name}(${c.status})`).join(", ") || "none"}`)
        if (result.duplicateToolCalls) console.log("   ⚠ duplicate identical tool call detected")
        if (result.finishedViaFallback) console.log("   ⚠ finished via the generic fallback message")
        console.log(`   final content: ${(result.finalContent ?? "").slice(0, 400)}`)
        console.log("")
    }

    const outDir = join(process.cwd(), "scripts/eval/results")
    mkdirSync(outDir, { recursive: true })
    const outPath = join(outDir, `${RUN_TAG}.json`)
    writeFileSync(outPath, JSON.stringify(results, null, 2))
    console.log(`Full results written to ${outPath}`)

    if (KEEP) {
        console.log(`\n--keep passed - leaving ${RUN_TAG}-* rows in the DB for manual inspection (npm run db:studio).`)
    } else {
        await cleanup(EVAL_SCENARIOS.map((s) => s.id))
        console.log(`\nCleaned up ${RUN_TAG}-* rows.`)
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Eval harness failed:", error)
        process.exit(1)
    })
