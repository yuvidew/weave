import { formatDistanceToNow } from "date-fns"
import { SparklesIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import type { CreatAgentType } from "@/features/agents/types"

// Same emerald/muted chip colors as agent-card.tsx's STATUS_BADGE — kept in
// sync manually since this is a read-only summary, not the editable card.
const STATUS_BADGE: Record<CreatAgentType["status"], { label: string; className: string }> = {
  active: {
    label: "Active",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  inactive: {
    label: "Inactive",
    className: "border-border text-muted-foreground",
  },
}

interface RecentAgentCardProps {
  agent: CreatAgentType | undefined
  isPending: boolean
  isError: boolean
}

/**
 * @component RecentAgentCard
 * @description Spotlight card for the most recently created/updated agent —
 * read-only avatar/name/status/description plus a link to the full Agents
 * page. Falls back to a loading skeleton or a "create your first agent" empty
 * state when there's nothing to show yet.
 */
export const RecentAgentCard = ({ agent, isPending, isError }: RecentAgentCardProps) => {
  return (
    <div className="flex flex-col gap-3 rounded-xl border p-5">
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <SparklesIcon className="size-4" />
        Recently updated
      </div>

      {isPending ? (
        <div className="flex items-center gap-3">
          <Skeleton className="size-16 rounded-sm" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3.5 w-64" />
          </div>
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">Something went wrong loading your agents. Please try again.</p>
      ) : !agent ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">No agents yet</p>
          <p className="text-sm text-muted-foreground">Create your first agent to see it here.</p>
          <Button size="sm" nativeButton={false} render={<a href="/agents" />}>
            Create an agent
          </Button>
        </div>
      ) : (
        <Item variant="outline">
          <ItemMedia variant="image" className="h-16 w-16 bg-muted">
            <img src={agent.agentImage} alt={agent.name} width={50} height={50} />
          </ItemMedia>

          <ItemContent>
            <ItemTitle>
              {agent.name}
              <Badge variant="outline" className={STATUS_BADGE[agent.status].className}>
                {STATUS_BADGE[agent.status].label}
              </Badge>
            </ItemTitle>
            <ItemDescription>{agent.description}</ItemDescription>
            <p className="text-xs text-muted-foreground">
              Last updated {formatDistanceToNow(new Date(agent.updatedAt), { addSuffix: true })}
            </p>
          </ItemContent>

          <Button variant="outline" size="sm" nativeButton={false} render={<a href="/agents" />}>
            View agent
          </Button>
        </Item>
      )}
    </div>
  )
}
