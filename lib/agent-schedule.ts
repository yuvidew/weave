import {
    fromZonedTime,
    toZonedTime,
} from "date-fns-tz";
import { AgentRun, db } from "@/db";
import { and, eq } from "drizzle-orm";

export const calculateNextDailyRun = ({
    time,
    timezone,
    after = new Date(),
}: {
    time: string;
    timezone: string;
    after?: Date;
}) => {
    const [hour, minute] = time
        .split(":")
        .map(Number);

    const localAfter = toZonedTime(
        after,
        timezone,
    );

    const localCandidate = new Date(localAfter);

    localCandidate.setHours(
        hour,
        minute,
        0,
        0,
    );

    let candidateUtc = fromZonedTime(
        localCandidate,
        timezone,
    );

    // Today's scheduled time has passed.
    if (candidateUtc <= after) {
        localCandidate.setDate(
            localCandidate.getDate() + 1,
        );

        candidateUtc = fromZonedTime(
            localCandidate,
            timezone,
        );
    }

    return candidateUtc;
}

// Guarantees a fully-populated, runnable schedule regardless of what the
// model actually returned — the prompt/schema ask it to default missing
// timing to "recurring" daily at 09:00, but structured-output models don't
// always follow free-text defaults (e.g. picking "once" with no frequency),
// so this backstops it server-side. "time" and "frequency" are never left
// null, even for "manual" — there's always a sensible value to fall back to.
// Shared by both agent creation and every schedule edit (see
// `rescheduleAgentRuns` below) so the two can never drift apart.
export const normalizeSchedule = (schedule: { type?: string; time?: string | null; frequency?: string | null } | undefined) => {
    const type = schedule?.type === "manual" || schedule?.type === "once" ? schedule.type : "recurring"

    return {
        type,
        time: schedule?.time || "09:00",
        frequency: schedule?.frequency || "daily",
    }
}

// Keeps an agent's queued `agentRun` row in sync with its current schedule —
// called both right after an agent is created and on every schedule edit.
// Without this, editing a schedule (e.g. via AgentEditSheet) would silently
// do nothing: the previously-queued run stays fixed at whatever time was
// computed when it was first created/last synced, permanently out of sync
// with whatever the agent's config now says. Drops any run that hasn't
// started yet (it reflects the stale schedule) and, only for a daily
// recurring schedule, queues a fresh one at the next occurrence.
export const rescheduleAgentRuns = async ({
    agentId,
    userEmail,
    schedule,
}: {
    agentId: string
    userEmail: string
    schedule: { type: string; time: string; frequency: string; timezone?: string }
}) => {
    // A run already "running"/"completed"/"failed" is history — only a
    // still-"scheduled" run reflects a schedule that might now be stale.
    await db.delete(AgentRun).where(
        and(eq(AgentRun.agentId, agentId), eq(AgentRun.status, "scheduled")),
    )

    if (schedule.type !== "recurring" || schedule.frequency !== "daily") {
        return null
    }

    const timezone = schedule.timezone || "UTC"
    const nextRun = calculateNextDailyRun({ time: schedule.time, timezone })

    const [run] = await db.insert(AgentRun).values({
        agentId,
        userEmail,
        scheduledFor: nextRun,
        timezone,
        status: "scheduled",
    }).returning()

    return run
}