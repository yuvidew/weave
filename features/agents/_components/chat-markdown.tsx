import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

// Tight block-element spacing for every renderer below — the browser
// defaults (large paragraph/list margins) look broken inside a narrow chat
// bubble, so every block collapses to a small vertical rhythm instead.
const BLOCK_SPACING = "my-1.5 first:mt-0 last:mb-0"

// Maps Markdown elements to the same text sizing/tone as BubbleContent
// (text-sm leading-relaxed) plus the app's existing link/code/border
// conventions — underlined links matching EmptyDescription's `[&>a]:underline`
// rule, a muted rounded background for code matching Badge's bg-muted style,
// and border-border for table rules matching the app's card/separator borders.
const components: Components = {
    p: ({ className, ...props }) => <p className={cn(BLOCK_SPACING, className)} {...props} />,
    ul: ({ className, ...props }) => <ul className={cn(BLOCK_SPACING, "list-disc space-y-1 pl-5", className)} {...props} />,
    ol: ({ className, ...props }) => <ol className={cn(BLOCK_SPACING, "list-decimal space-y-1 pl-5", className)} {...props} />,
    li: ({ className, ...props }) => <li className={cn("leading-relaxed", className)} {...props} />,
    a: ({ className, ...props }) => (
        <a
            className={cn("text-primary underline underline-offset-2 hover:no-underline", className)}
            target="_blank"
            rel="noopener noreferrer"
            {...props}
        />
    ),
    strong: ({ className, ...props }) => <strong className={cn("font-semibold", className)} {...props} />,
    blockquote: ({ className, ...props }) => (
        <blockquote className={cn(BLOCK_SPACING, "border-l-2 border-border pl-3 text-muted-foreground", className)} {...props} />
    ),
    // A fenced code block's <code> carries a `language-*` className (added by
    // remark) and sits inside <pre>, which already has its own background —
    // only bare inline `code` gets the pill-style background here, or a
    // fenced block would end up with two nested backgrounds/paddings.
    code: ({ className, ...props }) =>
        className?.includes("language-") ? (
            <code className={className} {...props} />
        ) : (
            <code className={cn("rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]", className)} {...props} />
        ),
    pre: ({ className, ...props }) => (
        <pre className={cn(BLOCK_SPACING, "overflow-x-auto rounded-md bg-muted p-2.5 font-mono text-[0.85em]", className)} {...props} />
    ),
    h1: ({ className, ...props }) => <h1 className={cn(BLOCK_SPACING, "text-base font-semibold", className)} {...props} />,
    h2: ({ className, ...props }) => <h2 className={cn(BLOCK_SPACING, "text-sm font-semibold", className)} {...props} />,
    h3: ({ className, ...props }) => <h3 className={cn(BLOCK_SPACING, "text-sm font-semibold", className)} {...props} />,
    hr: ({ className, ...props }) => <hr className={cn("my-2 border-border", className)} {...props} />,
    // A GFM table is often wider than the bubble (e.g. a subject/sender/date/
    // link table) — scope the horizontal scroll to just the table itself
    // rather than letting it blow out the bubble/sheet width.
    table: ({ className, ...props }) => (
        <div className={cn(BLOCK_SPACING, "overflow-x-auto rounded-md border border-border")}>
            <table className={cn("w-full border-collapse text-xs", className)} {...props} />
        </div>
    ),
    thead: ({ className, ...props }) => <thead className={cn("bg-muted", className)} {...props} />,
    th: ({ className, ...props }) => (
        <th className={cn("border-b border-border px-2 py-1.5 text-left font-medium whitespace-nowrap", className)} {...props} />
    ),
    td: ({ className, ...props }) => (
        <td className={cn("border-b border-border px-2 py-1.5 align-top last:whitespace-nowrap", className)} {...props} />
    ),
}

/**
 * @component ChatMarkdown
 * @description Renders an agent's chat reply as formatted Markdown (bold, links, lists, tables,
 * etc.) instead of raw syntax, styled to fit inside a narrow chat bubble. Only meant for
 * assistant messages — user-typed text is shown as plain text in ChatSheet.
 */
export const ChatMarkdown = ({ children }: { children: string }) => (
    <div className="text-sm leading-relaxed wrap-break-word">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {children}
        </ReactMarkdown>
    </div>
)
