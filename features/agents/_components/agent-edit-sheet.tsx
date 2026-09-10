"use client"

import { ReactElement, useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import {
    CalendarIcon,
    Loader2Icon,
    LinkIcon,
    MailIcon,
    MessageSquareIcon,
    NotebookIcon,
    PlusIcon,
    SearchIcon,
    ShuffleIcon,
    WavesIcon,
    XIcon,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage } from '@/components/ui/avatar';
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldTitle,
} from '@/components/ui/field';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from '@/components/ui/item';
import { useEditAgent } from '../hook/use-agent';
import type { AgentFormState, CreatAgentType, ScheduleFrequency, ScheduleType } from "../types"

interface AgentEditSheetProps {
    // Rendered as the trigger element itself (via SheetTrigger's `render`) rather
    // than wrapped in an extra <button>, so a <Button> child doesn't nest <button>s.
    children: ReactElement
    agent: CreatAgentType
    // Called with the freshly-saved row once the update succeeds, so a parent
    // holding its own copy of this agent (e.g. a list) can stay in sync.
    onUpdated?: (agent: CreatAgentType) => void
}



// Seeds the form object from an agent — used both for the initial state and to
// discard edits back to their original values on Cancel. Every text field is
// coalesced to "" — the DB/LLM can hand back null for an unset column, and a
// null `value` on a controlled input/select throws.
const buildFormState = (agent: CreatAgentType): AgentFormState => ({
    name: agent.name ?? "",
    agentImage: agent.agentImage ?? "",
    prompt: agent.description ?? "",
    instructions: agent.instructions ?? "",
    outputFormat: agent.outputFormat ?? "",
    schedule: {
        ...agent.schedule,
        time: agent.schedule.time ?? "",
        frequency: agent.schedule.frequency ?? "daily",
    },
    skills: agent.skills ?? [],
    newSkill: "",
    connectedTools: Object.fromEntries((agent.tools ?? []).map((slug) => [slug, true])),
})

// Known tool slugs mapped to a display label and icon — falls back to a
// generic link icon/capitalized slug for anything not in this list.
const TOOL_DISPLAY: Record<string, { label: string; icon: typeof MailIcon }> = {
    gmail: { label: "Gmail", icon: MailIcon },
    slack: { label: "Slack", icon: MessageSquareIcon },
    notion: { label: "Notion", icon: NotebookIcon },
    google_calendar: { label: "Google Calendar", icon: CalendarIcon },
    google_search: { label: "Google Search", icon: SearchIcon },
    serp_search: { label: "SERP Search", icon: SearchIcon },
    browserbase: { label: "Browserbase", icon: LinkIcon },
}

// Builds a fresh dicebear "voxel-bot" avatar URL from a random seed — mirrors
// the convention used server-side when an agent is first created (see
// app/api/agent/configure/route.ts). Purely client-side/preview for now.
const randomAgentImage = () =>
    `https://api.dicebear.com/10.x/voxel-bot/svg?tags=animation&seed=${crypto.randomUUID()}`

/**
 * @component AgentEditSheet
 * @description Side sheet for editing an existing agent's look, prompt, schedule, skills, and output format. "Save changes" persists edits via useEditAgent; connected-tools status stays visual only for now.
 * @param agent The agent whose values seed the form.
 * @param children The element that opens the sheet (rendered as the trigger itself via SheetTrigger's `render`).
 * @param onUpdated Called with the saved agent once the update succeeds.
 */
export const AgentEditSheet = ({ children, agent, onUpdated }: AgentEditSheetProps) => {
    const [open, setOpen] = useState(false)
    const [form, setForm] = useState<AgentFormState>(() => buildFormState(agent))
    const { mutate: saveAgent, isPending, error } = useEditAgent()

    // Restores every field to the agent's original values.
    const resetForm = () => setForm(buildFormState(agent))

    // Sends the current form back to the API, scoped to this agent's id.
    // Only closes/resets on success — on failure the sheet stays open with
    // the entered values so the user can retry without retyping anything.
    const onSave = () => {
        saveAgent(
            {
                agentId: agent.agentId,
                agentConfig: {
                    name: form.name,
                    agentImage: form.agentImage,
                    description: form.prompt,
                    instructions: form.instructions,
                    skills: form.skills,
                    schedule: form.schedule,
                    outputFormat: form.outputFormat,
                },
            },
            {
                onSuccess: (updatedAgent) => {
                    onUpdated?.(updatedAgent)
                    setOpen(false)
                    // Success toast itself is handled by useEditAgent — it
                    // fires for every caller, not just this one.
                },
            }
        )
    }

    // Adds the trimmed skill input as a new chip, ignoring blanks/duplicates.
    const addSkill = () => {
        const value = form.newSkill.trim()
        if (!value || form.skills.includes(value)) return
        setForm((prev) => ({ ...prev, skills: [...prev.skills, value], newSkill: "" }))
    }

    const removeSkill = (skill: string) => {
        setForm((prev) => ({ ...prev, skills: prev.skills.filter((s) => s !== skill) }))
    }

    const connectedCount = Object.values(form.connectedTools).filter(Boolean).length

    return (
        <Sheet
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) resetForm()
                setOpen(nextOpen)
            }}
        >
            <SheetTrigger render={children} />
            <SheetContent className="sm:max-w-md">
                <SheetHeader className='border-b px-5 py-4'>
                    <div className="flex items-center gap-2.5">
                        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                            <WavesIcon className="size-4" />
                        </div>
                        <div>
                            <SheetTitle>Edit agent</SheetTitle>
                            <SheetDescription>Update how this agent looks, works, and runs.</SheetDescription>
                        </div>
                    </div>
                </SheetHeader>
                <ScrollArea className="min-h-0 flex-1">
                    <FieldGroup className="px-5 py-4">
                        {/* Agent image */}
                        <div className="flex items-start gap-5  ">
                            <div className="relative shrink-0">
                                <Avatar className={"size-16 rounded-sm!"}>
                                    <AvatarImage src={form.agentImage} alt={form.name} className={"rounded-sm!"} />
                                </Avatar>
                            </div>
                            <div className="flex-1 space-y-1">
                                <FieldTitle>Agent image</FieldTitle>
                                <FieldDescription className='mt-1.5'>Shuffle to generate a new look.</FieldDescription>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setForm((prev) => ({ ...prev, agentImage: randomAgentImage() }))}
                                    className={"mt-1"}
                                >
                                    <ShuffleIcon />
                                    Shuffle image
                                </Button>
                            </div>
                        </div>

                        {/* Agent name */}
                        <Field>
                            <FieldLabel htmlFor="agent-name">Agent name</FieldLabel>
                            <Input
                                id="agent-name"
                                value={form.name}
                                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            />
                        </Field>

                        {/* Prompt */}
                        <Field>
                            <FieldLabel htmlFor="agent-prompt">Prompt</FieldLabel>
                            <Textarea
                                id="agent-prompt"
                                value={form.prompt}
                                onChange={(e) => setForm((prev) => ({ ...prev, prompt: e.target.value }))}
                                className=' resize-none'
                            />
                        </Field>

                        {/* Instructions */}
                        <Field>
                            <FieldLabel htmlFor="agent-instructions">Instructions</FieldLabel>
                            <Textarea
                                id="agent-instructions"
                                value={form.instructions}
                                onChange={(e) => setForm((prev) => ({ ...prev, instructions: e.target.value }))}
                                className=' resize-none min-h-28'
                            />
                        </Field>

                        {/* Schedule */}
                        <div className="rounded-lg border p-4 flex flex-col space-y-1">
                            <FieldTitle>Schedule</FieldTitle>
                            <FieldDescription>Choose when and how often this agent runs.</FieldDescription>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                                <Field>
                                    <FieldLabel htmlFor="schedule-type">Run type</FieldLabel>
                                    <Select
                                        value={form.schedule.type}
                                        onValueChange={(value) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                schedule: { ...prev.schedule, type: value as ScheduleType },
                                            }))
                                        }
                                    >
                                        <SelectTrigger id="schedule-type" className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="manual">Manual</SelectItem>
                                            <SelectItem value="once">Once</SelectItem>
                                            <SelectItem value="recurring">Recurring</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="schedule-time">Time</FieldLabel>
                                    <Input
                                        id="schedule-time"
                                        type="time"
                                        value={form.schedule.time}
                                        onChange={(e) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                schedule: { ...prev.schedule, time: e.target.value },
                                            }))
                                        }
                                    />
                                </Field>
                            </div>
                            <Field className="mt-3">
                                <FieldLabel htmlFor="schedule-frequency">Frequency</FieldLabel>
                                <Select
                                    value={form.schedule.frequency}
                                    disabled={form.schedule.type === "manual"}
                                    onValueChange={(value) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            schedule: { ...prev.schedule, frequency: value as ScheduleFrequency },
                                        }))
                                    }
                                >
                                    <SelectTrigger id="schedule-frequency" className="w-full">
                                        <SelectValue placeholder="manual" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hourly">Hourly</SelectItem>
                                        <SelectItem value="daily">Daily</SelectItem>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>

                        {/* Skills */}
                        <div className='flex flex-col space-y-1'>
                            <FieldTitle>Skills</FieldTitle>
                            <FieldDescription>Add or remove the capabilities this agent should use.</FieldDescription>
                            <div className="mt-3 flex flex-wrap gap-2 border p-2  rounded-lg">
                                {form.skills.map((skill) => (
                                    <Badge key={skill} variant="secondary" className="gap-1 pr-1 p-2">
                                        {skill}
                                        <button
                                            type="button"
                                            onClick={() => removeSkill(skill)}
                                            className="rounded-full p-0.5 hover:bg-foreground/10"
                                        >
                                            <XIcon className="size-3" />
                                            <span className="sr-only">Remove {skill}</span>
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                            {/* Plain Input + Button (not InputGroup) — InputGroup's focus ring lives on
                                the wrapping capsule (`has-[...]:ring-3`), which lit up the whole row
                                instead of just the input once it had its own border. */}
                            <div className="mt-3 flex items-center gap-2">
                                <Input
                                    placeholder="Add a skill"
                                    value={form.newSkill}
                                    onChange={(e) => setForm((prev) => ({ ...prev, newSkill: e.target.value }))}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault()
                                            addSkill()
                                        }
                                    }}
                                />
                                <Button type="button" variant="outline" size="sm" onClick={addSkill}>
                                    <PlusIcon />
                                    Add
                                </Button>
                            </div>
                        </div>

                        {/* Connected tools */}
                        <div className='flex flex-col space-y-1'>
                            <FieldTitle>Connected tools</FieldTitle>
                            <FieldDescription>
                                {connectedCount} of {(agent.tools ?? []).length} connected
                            </FieldDescription>
                            <div className="mt-3 flex flex-col gap-2">
                                {(agent.tools ?? []).map((slug) => {
                                    const display = TOOL_DISPLAY[slug]
                                    const Icon = display?.icon ?? LinkIcon
                                    const isConnected = form.connectedTools[slug]
                                    return (
                                        <Item key={slug} variant="outline">
                                            <ItemMedia variant="icon">
                                                <Icon />
                                            </ItemMedia>
                                            <ItemContent>
                                                <ItemTitle>{display?.label ?? slug}</ItemTitle>
                                                <span className={isConnected ? "text-xs text-emerald-600 dark:text-emerald-400" : "text-xs text-muted-foreground"}>
                                                    {isConnected ? "Connected" : "Disconnected"}
                                                </span>
                                            </ItemContent>
                                            <ItemActions>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() =>
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            connectedTools: {
                                                                ...prev.connectedTools,
                                                                [slug]: !prev.connectedTools[slug],
                                                            },
                                                        }))
                                                    }
                                                >
                                                    {isConnected ? "Disconnect" : "Connect"}
                                                </Button>
                                            </ItemActions>
                                        </Item>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Output format */}
                        <Field>
                            <FieldLabel htmlFor="agent-output-format">Output format</FieldLabel>
                            <Textarea
                                id="agent-output-format"
                                value={form.outputFormat}
                                onChange={(e) => setForm((prev) => ({ ...prev, outputFormat: e.target.value }))}
                                className=' resize-none min-h-36'
                            />
                        </Field>
                    </FieldGroup>
                </ScrollArea>
                {error && (
                    <div className="mx-5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                        {isAxiosError<{ error?: string }>(error) && error.response?.data?.error
                            ? error.response.data.error
                            : "Something went wrong saving your changes. Please try again."}
                    </div>
                )}
                <SheetFooter className='flex-row justify-end gap-2.5 border-t'>
                    <Button variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button disabled={isPending} onClick={onSave}>
                        {isPending && <Loader2Icon className="animate-spin" />}
                        {isPending ? "Saving…" : "Save changes"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
