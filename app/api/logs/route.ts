import { AgentConfig, AgentRun, db } from "@/db";
import { currentUser } from "@clerk/nextjs/server";
import { and, count, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Picks the most recent non-null timestamp off a run — used as the table's
// "Updated" column since a run's most meaningful moment moves from
// queued -> started -> completed as it progresses.
const latestTimestamp = (run: typeof AgentRun.$inferSelect) =>
    (run.completedAt ?? run.startedAt ?? run.queuedAt ?? run.createdAt).toISOString();

// Shape of the assistant's reply persisted onto `AgentRun.output` by
// executeAgent (see lib/execute-agent.ts) — only `content` is needed here.
type RunOutput = { content?: string | null };

export const GET = async (req: NextRequest) => {
    const user = await currentUser();
    const userEmail = user?.primaryEmailAddress?.emailAddress;

    if (!userEmail) {
        return NextResponse.json({ error: "Unauthorized User" }, { status: 400 });
    }

    const searchParams = req.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.max(1, Number(searchParams.get("pageSize")) || 10);

    const whereClause = eq(AgentRun.userEmail, userEmail);

    const rows = await db
        .select({ run: AgentRun, agent: AgentConfig })
        .from(AgentRun)
        .innerJoin(AgentConfig, eq(AgentRun.agentId, AgentConfig.agentId))
        .where(whereClause)
        .orderBy(desc(AgentRun.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

    const logs = rows.map(({ run, agent }) => ({
        id: run.id,
        agentId: run.agentId,
        agentName: agent.name ?? "",
        agentImage: agent.agentImage ?? "",
        task: agent.objective ?? "",
        status: run.status,
        updatedAt: latestTimestamp(run),
        result: run.status === "failed" ? run.error : (run.output as RunOutput | null)?.content ?? null,
    }));

    // Total count (for pagination) plus a per-status count (for the summary
    // cards) — both scoped to the same where clause so they stay in sync
    // with `logs` regardless of which page is being viewed.
    const [{ totalCount }] = await db
        .select({ totalCount: count() })
        .from(AgentRun)
        .where(whereClause);

    const [{ completed }] = await db
        .select({ completed: count() })
        .from(AgentRun)
        .where(and(whereClause, eq(AgentRun.status, "completed")));

    const [{ failed }] = await db
        .select({ failed: count() })
        .from(AgentRun)
        .where(and(whereClause, eq(AgentRun.status, "failed")));

    const [{ scheduled }] = await db
        .select({ scheduled: count() })
        .from(AgentRun)
        .where(and(whereClause, eq(AgentRun.status, "scheduled")));

    return NextResponse.json({
        logs,
        totalCount,
        page,
        pageSize,
        statusCounts: { completed, failed, scheduled },
    });
};
