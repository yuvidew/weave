
import { AgentConfig, AgentRun, db } from "@/db";
import { calculateNextDailyRun } from "@/lib/agent-schedule";
import { executeAgent } from "@/lib/execute-agent";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { inngest } from "./client";
import { CreatAgentType } from "@/features/agents/types";

export const ProcessScheduledAgent = inngest.createFunction(
  {
    id: "process-scheduled-agent-runs",
    // Run this scheduler every 5 minutes to pick pending agent jobs.
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async ({ step }) => {
    const now = new Date();
    // Bounds how far back a stuck/missed run is still picked up, so a run
    // that somehow never got claimed doesn't stay "due" forever.
    const lookback = new Date(now.getTime() - 60 * 60 * 1000)

    // Step 1: Load scheduled agent runs whose execution time has actually
    // arrived (scheduledFor <= now) — NOT ones merely coming up in the next
    // hour, which would fire them up to an hour early.
    const dueRuns = await step.run("load-due-agent-runs", async () => {
      return await db
        .select({
          run: AgentRun,
          agentConfig: AgentConfig,
        })
        .from(AgentRun)
        .innerJoin(
          AgentConfig,
          eq(AgentRun.agentId, AgentConfig.agentId),
        )
        .where(
          and(
            eq(AgentRun.status, "scheduled"),
            lte(AgentRun.scheduledFor, now),
            gte(AgentRun.scheduledFor, lookback),
          ),
        )
        .orderBy(asc(AgentRun.scheduledFor))
        .limit(100);
    });

    const results = [];

    for (const { run, agentConfig } of dueRuns) {
      try {
        // Step 2: Atomically claim the run so overlapping cron ticks skip it.
        const startedRun = await step.run(
          `mark-run-started-${run.id}`,
          async () => {
            const result = await db
              .update(AgentRun)
              .set({
                status: "running",
                queuedAt: now,
                startedAt: new Date(),
              })
              .where(
                and(
                  eq(AgentRun.id, run.id),
                  eq(AgentRun.status, "scheduled"),
                ),
              )
              .returning();

            return result[0] ?? null;
          },
        );

        // Step 3: If another worker already claimed this run, skip it safely.
        if (!startedRun) {
          results.push({
            runId: run.id,
            agentId: run.agentId,
            status: "skipped",
          });
          continue;
        }

        // Step 4: Execute the agent using the existing project agent runner.
        const output = await step.run(`execute-agent-${run.id}`, async () => {
          // Normalize nullable DB fields into the stricter UI agent config type.
          const executableAgentConfig: CreatAgentType = {
            id: agentConfig.id,
            userEmail: agentConfig.userEmail ?? run.userEmail,

            agentId: agentConfig.agentId,
            name: agentConfig.name ?? "",
            agentImage: agentConfig.agentImage ?? "",

            description: agentConfig.description ?? "",
            instructions: agentConfig.instructions ?? "",
            objective: agentConfig.objective ?? "",

            tools: Array.isArray(agentConfig.tools)
              ? (agentConfig.tools as string[])
              : [],
            skills: Array.isArray(agentConfig.skills)
              ? (agentConfig.skills as string[])
              : [],
            schedule: (agentConfig.schedule ?? {
              type: "manual",
            }) as CreatAgentType["schedule"],
            outputFormat: agentConfig.outputFormat ?? "",
            status: (agentConfig.status as CreatAgentType["status"]) ?? "active",

            createdAt: String(agentConfig.createdAt),
            updatedAt: String(agentConfig.updatedAt),
          };

          return await executeAgent({
            agentConfig: executableAgentConfig,
            userEmail: run.userEmail,
            input: executableAgentConfig.objective,
          });
        });

        // Step 5: Persist the successful output back to the AgentRun row.
        await step.run(`mark-run-completed-${run.id}`, async () => {
          await db
            .update(AgentRun)
            .set({
              status: "completed",
              output,
              completedAt: new Date(),
            })
            .where(eq(AgentRun.id, run.id));
        });

        const schedule = agentConfig.schedule as {
          type?: string;
          frequency?: string;
          time?: string;
          timezone?: string;
        } | null;

        // Step 6: For daily recurring agents, create the next scheduled run.
        if (
          schedule?.type === "recurring" &&
          schedule.frequency === "daily" &&
          schedule.time
        ) {
          await step.run(`schedule-next-run-${run.id}`, async () => {
            const timezone =
              schedule.timezone ?? run.timezone ?? "UTC";

            const nextRun = calculateNextDailyRun({
              time: schedule.time!,
              timezone,
              after: new Date(run.scheduledFor),
            });

            await db
              .insert(AgentRun)
              .values({
                agentId: run.agentId,
                userEmail: run.userEmail,
                scheduledFor: nextRun,
                timezone,
                status: "scheduled",
              })
              .onConflictDoNothing();
          });
        }

        // Step 7: Track the run result for the Inngest execution summary.
        results.push({
          runId: run.id,
          agentId: run.agentId,
          status: "completed",
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";

        // Step 8: Persist failures so the run does not stay stuck as running.
        await step.run(`mark-run-failed-${run.id}`, async () => {
          await db
            .update(AgentRun)
            .set({
              status: "failed",
              error: message,
              completedAt: new Date(),
            })
            .where(eq(AgentRun.id, run.id));
        });

        // Step 9: Include failure details in the Inngest execution summary.
        results.push({
          runId: run.id,
          agentId: run.agentId,
          status: "failed",
          error: message,
        });
      }
    }

    // Step 10: Return a compact summary for Inngest logs and observability.
    return {
      processed: results.length,
      results,
    };
  },
);

export const ExecuteScheduleAgent = inngest.createFunction(
    {
        id : "execute-scheduled-agent-run",
        triggers : [{event : "agent/run.execute"}],
    },
    async ({ event, step}) => {
        const runId = event.data.runId as string | undefined;

        if (!runId) {
            throw new Error("Mising rundId for scheduled agent executing")
        }

        // Step 1: Load the queued run and its agent configuration.
        const runData = await step.run(`load-agent-run-${runId}`, async () => {
            const result = await db.select({
                run : AgentRun,
                agentConfig : AgentConfig,
            })
            .from(AgentRun)
            .innerJoin(
                AgentConfig,
                eq(AgentRun.agentId, AgentConfig.agentId)
            )
            .where(eq(AgentRun.id, runId))
            .limit(1);

            return result[0] ?? null;
        });

        if(!runData) {
            throw new Error (`Agent run ${runId} was not found.`)
        };

        const {run, agentConfig} = runData;

        try {
            // Step 2: Wait until this run's exact scheduled execution
            await step.sleepUntil(
                `wait-for-scheduled-time-${run.id}`,
                run.scheduledFor
            );

            // Step 3: Mark this queued run ad running before executing
            const startedRun = await step.run(
                `mark-run-started-${run.id}`,
                async () => {
                    const result = await db
                        .update(AgentRun)
                        .set({
                            status : "running",
                            startedAt : new Date()
                        })
                        .where(
                            and(
                                eq(AgentRun.id, run.id),
                                eq(AgentRun.status, "scheduled"),
                            ),
                        )
                        .returning()

                    return result[0] ?? null;
                },
            );

            // Step 4 : If the run is no longer queued, another executing
            if(!startedRun){
                return {
                    runId: run.id,
                    agentId: run.agentId,
                    status: "skipped"
                }
            }

            // Step 5: Execute the agent using the existing project. The
            // "this is an automated run, actually call the tool" framing
            // lives once in executeAgent() (see SCHEDULED_RUN_INSTRUCTION in
            // lib/execute-agent.ts) rather than being duplicated per call
            // site here — see ProcessScheduledAgent above for the same
            // pattern with plain instructions/objective.
            const output = await step.run(`execute-agent-${run.id}`, async () => {
                const executabAgentConfig: CreatAgentType = {
                    id: agentConfig.id,
                    userEmail : agentConfig.userEmail ?? run.userEmail,
                    agentId : agentConfig.agentId,
                    name : agentConfig.name ?? "",
                    agentImage: agentConfig.agentImage ?? "",
                    description : agentConfig.description ?? "",
                    instructions : agentConfig.instructions ?? "",
                    objective: agentConfig.objective ?? "",
                    tools : Array.isArray(agentConfig.tools)
                        ? (agentConfig.tools as string[])
                        : [],
                    skills : Array.isArray(agentConfig.skills)
                        ? (agentConfig.skills as string[])
                        : [],
                    schedule : (agentConfig.schedule ?? {
                        type : "manual"
                    }) as CreatAgentType["schedule"],
                    outputFormat: agentConfig.outputFormat ?? "",
                    status: (agentConfig.status as CreatAgentType["status"]) ?? "active",
                    createdAt : String(agentConfig.createdAt),
                    updatedAt : String(agentConfig.updatedAt),
                };

                return await executeAgent({
                    agentConfig : executabAgentConfig,
                    userEmail : run.userEmail,
                    input : executabAgentConfig.objective,
                });
            });

            // step 6: Resist the successfull output back to the agent
            await step.run(`mark-run-completed-${run.id}`, async () => {
                await db
                .update(AgentRun)
                .set({
                    status : "completed",
                    output,
                    completedAt : new Date(),
                })
                .where(eq(AgentRun.id, run.id))
            });

            const schedule = agentConfig.schedule as {
                type? : string,
                frequency? : string,
                time? : string,
                timezone? : string
            } | null;

            //  step 7: for daily recurrig agents, create the next schedule
            if (
                schedule?.type === "recurring" &&
                schedule.frequency === "daily" &&
                schedule.time
            ){
                await step.run(`schedule-next-run-${run.id}`, async () => {
                    const timezone = schedule.timezone ?? run.timezone;

                    const nextRun = calculateNextDailyRun({
                        time: schedule.time!,
                        timezone,
                        after : new Date(run.scheduledFor)
                    })

                    await db
                        .insert(AgentRun)
                        .values({
                            agentId : run.agentId,
                            userEmail : run.userEmail,
                            scheduledFor : nextRun,
                            timezone, 
                            status : "scheduled"
                        })
                        .onConflictDoNothing()
                });
            }

            // step 8: Return single-run execution summary
            return {
                runId : run.id,
                agentId : run.agentId,
                status : "completed"
            }

        } catch (error) {
            const message = error instanceof Error ? error.message : "Unkown error"

            // step 9 : persist failures so the run does not say

            await step.run(`mark-run-failed-${run.id}`, async () => {
                await db
                    .update(AgentRun)
                    .set({
                        status : "failed",
                        error : message,
                        completedAt : new Date()
                })
                .where(eq(AgentRun.id, run.id))
            })

            // Step 10 : return failed details for the inngest execution

            return {
                runId : run.id,
                agentId : run.agentId,
                status : "failed",
                error : message,
            }
        }
    }
)

// Keep the existing API route import working while using the clearer function name above.
export const processTask = ProcessScheduledAgent;