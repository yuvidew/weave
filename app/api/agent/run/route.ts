import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { AgentConfig, AgentRun, db } from "@/db";
import { inngest } from "@/inngest/client";

// Queues an on-demand run and executes it immediately — a separate row from
// whatever the agent's recurring schedule has queued, so "Run now" never
// disturbs that schedule. `scheduledFor: now` plus sending the same
// "agent/run.execute" event ExecuteScheduleAgent already listens for (see
// inngest/functions.ts) means its `step.sleepUntil(scheduledFor)` resolves
// right away instead of waiting for ProcessScheduledAgent's next 5-minute
// cron tick.
export const POST = async (req: NextRequest) => {
  const { agentId } = await req.json();

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  const user = await currentUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress;

  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized User" }, { status: 400 });
  }

  const [agent] = await db
    .select()
    .from(AgentConfig)
    .where(and(eq(AgentConfig.agentId, agentId), eq(AgentConfig.userEmail, userEmail)));

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  try {
    const schedule = agent.schedule as { timezone?: string } | null;

    const [run] = await db
      .insert(AgentRun)
      .values({
        agentId,
        userEmail,
        scheduledFor: new Date(),
        timezone: schedule?.timezone || "UTC",
        status: "scheduled",
      })
      .returning();

    await inngest.send({ name: "agent/run.execute", data: { runId: run.id } });

    return NextResponse.json({ message: "Agent run started", runId: run.id }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to start the run" }, { status: 500 });
  }
};
