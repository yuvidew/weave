"use client"

import { ReactElement, useState } from "react"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import {
    MessageScroller,
    MessageScrollerContent,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { Message, MessageAvatar, MessageContent } from "@/components/ui/message"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Avatar, AvatarImage } from "@/components/ui/avatar"
import { Item, ItemActions, ItemContent, ItemTitle } from "@/components/ui/item"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupTextarea,
} from "@/components/ui/input-group"
import { AlertCircleIcon, ArrowUpIcon, PaperclipIcon, SparklesIcon } from "lucide-react"
import { ChatMarkdown } from "./chat-markdown"
import { useChatMessages, usePendingChatMessage, useResolveToolCall, useSendChatMessage } from "../hook/use-chat"
import type { ChatMessageRow, ChatToolCall, CreatAgentType } from "../types"

interface ChatSheetProps {
    // Rendered as the trigger element itself (via SheetTrigger's `render`), same
    // convention as AgentEditSheet — pass a real button-like element here.
    children?: ReactElement
    agent: CreatAgentType
    // Controlled open state, for callers that don't open this from `children`.
    // Uncontrolled (self-managed) when omitted.
    open?: boolean
    onOpenChange?: (open: boolean) => void
}

// Short status line shown under a bubble once its tool call has settled —
// an approval card only renders while `status === "pending"` (see ToolCallCard).
const STATUS_LABEL: Record<Exclude<ChatToolCall["status"], "pending">, string> = {
    approved: "Approved",
    rejected: "Cancelled",
    done: "Done",
    error: "Failed",
}

/**
 * @component ToolCallCard
 * @description Renders one requested tool call inside an assistant message — an
 * Approve/Cancel card while pending, or a short status line once resolved.
 * @param agentId Needed to scope the approve/reject mutation to this agent.
 * @param messageId The assistant row this call belongs to.
 */
const ToolCallCard = ({ agentId, messageId, call }: { agentId: string; messageId: number; call: ChatToolCall }) => {
    const resolveToolCall = useResolveToolCall()

    if (call.status !== "pending") {
        return (
            <p className="px-1 text-xs text-muted-foreground">
                {STATUS_LABEL[call.status]} — {call.label}
                {call.status === "error" && call.error ? `: ${call.error}` : ""}
            </p>
        )
    }

    return (
        <Item variant="outline">
            <ItemContent>
                <ItemTitle>{call.label}</ItemTitle>
            </ItemContent>
            <ItemActions>
                <Button
                    size="sm"
                    variant="success"
                    disabled={resolveToolCall.isPending}
                    onClick={() => resolveToolCall.mutate({ agentId, messageId, toolCallId: call.id, decision: "approve" })}
                >
                    Approve
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={resolveToolCall.isPending}
                    onClick={() => resolveToolCall.mutate({ agentId, messageId, toolCallId: call.id, decision: "reject" })}
                >
                    Cancel
                </Button>
            </ItemActions>
        </Item>
    )
}

/**
 * @component ChatBubble
 * @description One row in the transcript — a user/assistant bubble, plus any tool-call
 * cards attached to that turn.
 */
const ChatBubble = ({ agent, message }: { agent: CreatAgentType; message: ChatMessageRow }) => {
    if (message.role === "tool") return null // raw tool results are context for the model, not shown to the user

    const isUser = message.role === "user"

    return (
        <Message align={isUser ? "end" : "start"}>
            {!isUser && (
                <MessageAvatar>
                    <Avatar className="size-8">
                        <AvatarImage src={agent.agentImage} alt={agent.name} />
                    </Avatar>
                </MessageAvatar>
            )}
            <MessageContent>
                {message.content && (
                    <Bubble variant={isUser ? "default" : "secondary"}>
                        <BubbleContent>
                            {/* Only the agent's own replies are rendered as Markdown — the
                                user isn't composing formatting on purpose, so their bubble
                                stays plain text even if it contains *"literal asterisks"*. */}
                            {isUser ? message.content : <ChatMarkdown>{message.content}</ChatMarkdown>}
                        </BubbleContent>
                    </Bubble>
                )}
                {message.toolCalls?.map((call) => (
                    <ToolCallCard key={call.id} agentId={agent.agentId} messageId={message.id} call={call} />
                ))}
            </MessageContent>
        </Message>
    )
}

/**
 * @component ChatSheet
 * @description Side sheet for chatting with an agent — persisted history, a real Groq
 * reply per turn, and an approval card for any write action (send email, create event,
 * etc.) the agent wants to run before it actually executes.
 * @param agent The agent being chatted with — supplies the header avatar/name and drives the system prompt/tool set server-side.
 * @param children The element that opens the sheet (rendered as the trigger itself via SheetTrigger's `render`).
 */
export const ChatSheet = ({ children, agent, open: openProp, onOpenChange }: ChatSheetProps) => {
    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = openProp !== undefined
    const open = isControlled ? openProp : internalOpen
    const setOpen = isControlled ? (onOpenChange ?? (() => { })) : setInternalOpen

    const [draft, setDraft] = useState("")
    // Only fetches while the sheet is actually open, same pattern as
    // useAgentTools(agent.agentId, open) in AgentEditSheet.
    const { data: history, isFetching, isError, refetch } = useChatMessages(agent.agentId, open)
    const sendChatMessage = useSendChatMessage()
    // Reflects an in-flight send for THIS agent even if this ChatSheet
    // instance remounted after the request was kicked off (see
    // usePendingChatMessage) — a plain sendChatMessage.isPending would reset
    // to false on remount despite the request still running server-side.
    const pendingMessage = usePendingChatMessage(agent.agentId)
    const isSending = pendingMessage !== null

    // Real history is empty and nothing is in flight yet — show the empty
    // state instead of a blank scroller.
    const hasStarted = (history?.length ?? 0) > 0 || isSending
    // True only for the very first load (no cached data yet) — `isFetching`
    // also flips on for the quiet background refetch after sending a
    // message/resolving a tool call, which shouldn't trigger this full-pane
    // loading state since the optimistic bubbles already cover that.
    const isInitialLoading = isFetching && history === undefined
    const isComposerDisabled = isSending || isInitialLoading || isError

    const onSend = () => {
        const content = draft.trim()
        if (!content || isComposerDisabled) return
        setDraft("")
        sendChatMessage.mutate({ agentId: agent.agentId, message: content })
    }

    return (
        <Sheet open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setDraft("") }}>
            {children && <SheetTrigger render={children} />}
            <SheetContent className="sm:max-w-md">
                <SheetHeader className="flex-row items-center gap-2.5 border-b px-5 py-4">
                    <Avatar className="size-9">
                        <AvatarImage src={agent.agentImage} alt={agent.name} />
                    </Avatar>
                    <div>
                        <SheetTitle>{agent.name}</SheetTitle>
                        <SheetDescription>Chat with your agent and give it a task.</SheetDescription>
                    </div>
                </SheetHeader>

                {/* MessageScroller's Viewport/Content children read scroll state off this
                    provider via context. `autoScroll` keeps the view pinned to the newest
                    message as the user's own bubble, the "Thinking…" indicator, and the
                    agent's reply are appended (it backs off if the user scrolls up to read
                    older messages); `defaultScrollPosition="end"` opens straight to the
                    bottom of existing history instead of the top. */}
                <MessageScrollerProvider autoScroll defaultScrollPosition="end">
                    <MessageScroller className="min-h-0 flex-1">
                        <MessageScrollerViewport>
                            <MessageScrollerContent className="justify-end px-5 py-4">
                                {isError ? (
                                    <Empty className="flex-none border-none p-2">
                                        <EmptyMedia className="mx-auto size-12 rounded-full bg-destructive/10 text-destructive">
                                            <AlertCircleIcon className="size-5" />
                                        </EmptyMedia>
                                        <EmptyContent>
                                            <EmptyTitle>Couldn't load this conversation</EmptyTitle>
                                            <EmptyDescription>
                                                Something went wrong fetching the chat history. Check your connection and try again.
                                            </EmptyDescription>
                                            <Button size="sm" variant="outline" onClick={() => refetch()}>
                                                Retry
                                            </Button>
                                        </EmptyContent>
                                    </Empty>
                                ) : isInitialLoading ? (
                                    <div className="flex flex-1 items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                                        <Spinner className="size-4" />
                                        Loading conversation…
                                    </div>
                                ) : (
                                    <>
                                        {!hasStarted && (
                                            <Empty className="flex-none border-none p-2">
                                                <EmptyMedia className="mx-auto size-12 rounded-full bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
                                                    <SparklesIcon className="size-5" />
                                                </EmptyMedia>
                                                <EmptyContent>
                                                    <EmptyTitle>Start a chat with {agent.name}</EmptyTitle>
                                                    <EmptyDescription>
                                                        {agent.description || "Give this agent a task and it'll get to work."}
                                                    </EmptyDescription>
                                                </EmptyContent>
                                            </Empty>
                                        )}

                                        {history?.map((message) => (
                                            <ChatBubble key={message.id} agent={agent} message={message} />
                                        ))}

                                        {/* Optimistic: render the just-sent text immediately from the
                                            shared mutation cache (not the query cache, and not this
                                            component's own mutation instance — see
                                            usePendingChatMessage) — it disappears the moment the real
                                            history refetch lands it for real, replaced by a persisted
                                            row with a real id. */}
                                        {pendingMessage && (
                                            <Message align="end">
                                                <MessageContent>
                                                    <Bubble variant="default">
                                                        <BubbleContent>{pendingMessage.message}</BubbleContent>
                                                    </Bubble>
                                                </MessageContent>
                                            </Message>
                                        )}
                                        {isSending && (
                                            <Message align="start">
                                                <MessageAvatar>
                                                    <Avatar className="size-8">
                                                        <AvatarImage src={agent.agentImage} alt={agent.name} />
                                                    </Avatar>
                                                </MessageAvatar>
                                                <MessageContent>
                                                    <Bubble variant="secondary">
                                                        <BubbleContent className="flex items-center gap-2">
                                                            <Spinner className="size-3.5" />
                                                            Thinking…
                                                        </BubbleContent>
                                                    </Bubble>
                                                </MessageContent>
                                            </Message>
                                        )}
                                    </>
                                )}
                            </MessageScrollerContent>
                        </MessageScrollerViewport>
                    </MessageScroller>
                </MessageScrollerProvider>

                <div className="border-t p-4">
                    <InputGroup className="rounded-2xl p-1">
                        <InputGroupTextarea
                            placeholder={`Message ${agent.name}...`}
                            className="min-h-11 px-3 pt-2.5"
                            value={draft}
                            disabled={isComposerDisabled}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault()
                                    onSend()
                                }
                            }}
                        />
                        <InputGroupAddon align="block-end" className="justify-between px-2 pb-2">
                            <InputGroupButton size="icon-sm" variant="ghost" className="rounded-full">
                                <PaperclipIcon />
                                <span className="sr-only">Add attachment</span>
                            </InputGroupButton>
                            <InputGroupButton
                                size="icon-sm"
                                disabled={!draft.trim() || isComposerDisabled}
                                onClick={onSend}
                                variant={"default"}
                                className="rounded-full"
                            >
                                {isSending ? <Spinner className="size-4" /> : <ArrowUpIcon />}
                                <span className="sr-only">Send message</span>
                            </InputGroupButton>
                        </InputGroupAddon>
                    </InputGroup>
                </div>
            </SheetContent>
        </Sheet>
    )
}
