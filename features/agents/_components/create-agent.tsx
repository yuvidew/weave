"use client"

import { useRef, useState } from "react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  ArrowUpIcon,
  BriefcaseIcon,
  MailIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react"

// Quick-start suggestions shown as chips under the composer. Clicking one
// fills the textarea with its example prompt instead of calling any API —
// there's no create-agent backend yet.
const SUGGESTIONS = [
  { label: "Find AI Jobs", prompt: "Search the web for the latest AI jobs matching my profile." },
  { label: "Inbox Summary", prompt: "Summarize important emails and highlight what needs my attention." },
  { label: "Research Topic", prompt: "Search the web and create a useful research summary for me." },
  { label: "Plan My Day", prompt: "Look at my calendar and tasks, then plan out my day." },
  { label: "Reddit Trends", prompt: "Find trending discussions on Reddit relevant to my interests." },
]

// "Get Started" cards — same idea as the chips above, with an icon/title/description.
const GET_STARTED = [
  {
    title: "Find latest jobs",
    description: "Search the web for the latest jobs matching my profile.",
    icon: BriefcaseIcon,
    iconColor: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  },
  {
    title: "Daily inbox summary",
    description: "Summarize important emails and highlight what needs my attention.",
    icon: MailIcon,
    iconColor: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  },
  {
    title: "Research a topic",
    description: "Search the web and create a useful research summary for me.",
    icon: SearchIcon,
    iconColor: "bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
  },
]

/**
 * @component CreateAgent
 * @description Prompt composer for describing a new agent, plus quick-start chips and cards that fill it in.
 * @param onViewAll Called when "View All" is clicked — the parent switches to the My Agents tab.
 */
export const CreateAgent = ({ onViewAll }: { onViewAll?: () => void }) => {
  const [prompt, setPrompt] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fills the composer with a suggestion's prompt and focuses it.
  const fillPrompt = (value: string) => {
    setPrompt(value)
    textareaRef.current?.focus()
  }

  return (
    <div className="flex flex-col gap-6 mt-5">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Create New Agent</h1>
        <p className="text-sm text-muted-foreground">
          Ask what type of agent you want to create, Type your goal, task, or workflow
        </p>
      </div>

      <InputGroup className="rounded-2xl p-1">
        <InputGroupTextarea
          ref={textareaRef}
          placeholder="Describe the agent you want to create…"
          className="min-h-32 px-3 pt-3"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <InputGroupAddon align="block-end" className="justify-between px-2 pb-2">
          <InputGroupButton size="icon-sm" variant="outline" className="rounded-full">
            <PlusIcon />
            <span className="sr-only">Add attachment</span>
          </InputGroupButton>
          {/* No create-agent API exists yet — this is a placeholder until one does. */}
          <InputGroupButton
            size="icon-sm"
            disabled={!prompt.trim()}
            className="rounded-full bg-violet-600 text-white hover:bg-violet-600/90 dark:bg-violet-500 dark:hover:bg-violet-500/90"
          >
            <ArrowUpIcon />
            <span className="sr-only">Create agent</span>
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <Button
            key={suggestion.label}
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => fillPrompt(suggestion.prompt)}
          >
            {suggestion.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Get Started</h2>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={onViewAll}>
            View All
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {GET_STARTED.map(({ title, description, icon: Icon, iconColor }) => (
            <Card
              key={title}
              className="cursor-pointer gap-3 p-5 text-left transition-colors hover:bg-muted/40"
              onClick={() => fillPrompt(description)}
            >
              <div className={`flex size-10 items-center justify-center rounded-xl ${iconColor}`}>
                <Icon className="size-5" />
              </div>
              <div className="font-medium">{title}</div>
              <p className="text-sm text-muted-foreground">{description}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
