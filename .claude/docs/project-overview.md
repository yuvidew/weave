# Project overview — Weave

This documents what Weave is, the tutorial it's being built from, and how far
the codebase currently is against that plan. Written for Claude Code (and
future-you) to get oriented without re-deriving it from scratch each session.

## What Weave is

Weave is a full-stack AI agent platform: a user describes a recurring task in
plain English ("find the top 5 AI trends on Reddit, summarize them into a
Google Doc, and notify me on Slack every day at 8am"), and the platform turns
that into a configured, schedulable agent — with its own objective,
instructions, required tools, and a run schedule — without the user filling
out any forms by hand.

**Branding note:** the app is called **Weave** (see `app/layout.tsx` metadata
and `components/app-sidebar.tsx`), not "Groove AI"/"Groovy AI" — that's the
name used in the tutorial this project is following. Don't reintroduce the
tutorial's branding into code or copy.

## Source tutorial

The codebase is being built along **TubeGuruji — "Build Full-Stack AI Agent
Platform for Daily Tasks with Next.js, React, Tailwindcss & Browserbase"**
(YouTube: `LC8Ebjq9m6U`, published 2026-09-03). Chapters, for reference when a
branch/task name lines up with one:

| Timestamp | Chapter |
|---|---|
| 0:00:00 | Introduction |
| 0:14:18 | Project Architecture |
| 0:16:20 | Project Setup |
| 0:25:12 | Auth & DB Setup |
| 0:47:56 | Dashboard Layout |
| 1:09:44 | Create Agent Page UI |
| 1:36:01 | Create Agent Configuration & Save |
| 2:55:20 | Edit Agent Feature |
| 3:31:34 | Display My Agents |
| 4:00:10 | Connect Agent to App/Tools |
| 5:01:29 | Chat with Agent |
| 5:33:27 | Browserbase Custom Agent |
| 5:57:45 | Schedule Agent |

The video's intended end-to-end flow: user enters a prompt → AI clarifies
missing details by asking questions → AI generates a full agent config → user
can edit/save it → agent can be run on demand or on a recurring schedule using
tool integrations (Gmail, Slack, Notion, GitHub, Google Calendar, Browserbase,
web/SERP search, etc.) → results land on a dashboard with run history/status.

## Tech stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4** + shadcn/ui (`components/ui/*` — CLI-generated, see
  [`code-style.md`](code-style.md) for why it's excluded from the arrow-const
  convention)
- **Clerk** for auth (`app/(auth)/sign-in`, `sign-up`, `proxy.ts` middleware)
- **Neon Postgres** + **Drizzle ORM** (`db/`, `drizzle.config.ts`)
- **groq-sdk** (Groq) for agent-config generation — the tutorial itself uses
  Gemini (`@google/genai`); this project went Gemini → Mistral (`@mistralai/mistralai`)
  → Groq chasing provider reliability, so don't reach for either of those
  packages' patterns when following along with the video here. If Groq also
  turns out to be flaky, the swap points are exactly `app/api/agent/configure/route.ts`
  (client + call shape) and `constant/response_schema.ts` (schema dialect) —
  everything else (prompt, contract, client wiring) is provider-agnostic.
- **@tanstack/react-query** for client-side data fetching/mutations
  (`components/providers/query-provider.tsx`)
- Planned per the tutorial but not yet integrated here: **Browserbase**
  (cloud browser automation tool), scheduling/cron for recurring runs

## Current implementation status

Past the "Create Agent Configuration & Save" chapter's core generate step —
the full request chain works (composer → TanStack mutation → API route →
Groq → structured JSON back to the UI). What's left in that chapter is
the clarification-question UI and the save-to-DB step.

### Done
- **Auth & DB Setup**: Clerk sign-in/up, `users` table, `POST /api/users`
  upserts the signed-in Clerk user on first load via
  `RoolLayoutProvider` → `UserDetailContext`.
- **Dashboard Layout**: sidebar shell (`AppSidebar`, `NavMain`, `NavUser`),
  `(root)` route group with `SidebarProvider`. Nav links to `/dashboard`,
  `/agents`, `/runs`, `/plugins`, `/templates` — only `dashboard` and `agents`
  have real pages; the rest 404 until built.
- **Create Agent Page UI**: `/agents` renders `AgentView` (tabs: "Create
  Agent" / "My Agents"). `CreateAgent` has the prompt composer, quick-start
  suggestion chips, and "Get Started" cards. `MyAgents` is still an empty
  placeholder.
- **Tools table**: `db/schema.ts` has the `tools` table (slug, category,
  type, provider, auth requirements, capabilities, permissions,
  approval rules, risk level, CRUD flags). `db/seed.ts` seeds 7 tools:
  `serp_search`, `web_search`, `github`, `browserbase`, `slack`, `gmail`,
  `notion` (seeded manually via a throwaway runner script — there's no
  `db:seed` npm script yet).
- **Agent config system prompt**: `constant/prompts.ts` exports
  `agent_config_system_prompt`, matching this project's `tools` schema and
  the structured-output contract below.
- **Response schema**: `constant/response_schema.ts` exports
  `agent_config_response`, a plain JSON Schema matching the same contract,
  `strict: true`. Groq's strict mode requires every property in `required`
  and `additionalProperties: false` on every object — a value that can be
  absent is instead typed `["<type>", "null"]` and always present.
- **`POST /api/agent/configure`**: fetches live tool slugs, fills both prompt
  placeholders, calls Groq (`openai/gpt-oss-120b` — one of the models Groq
  supports strict structured outputs on, alongside `openai/gpt-oss-20b` for
  a faster/cheaper option) with
  `response_format: { type: "json_schema", json_schema: agent_config_response }`,
  retries `503`/`429` (both transient) up to 3 times with a short backoff via
  `generateWithRetry`, and returns the parsed JSON or a proper error status.
  **Requires `GROQ_API_KEY` in `.env`** (get one at
  console.groq.com/keys) — not yet added. Note: neither the earlier Gemini
  nor Mistral attempt ever had a key in `.env` either, so if a fresh provider
  swap "doesn't work" again, check for a missing/blank API key before
  assuming the provider itself is the problem.
- **Client wiring** (TanStack Query): `features/agents/api/index.ts`
  (`agentConfigure`) → `features/agents/hook/use-agent-configure.ts`
  (`useAgentConfigure`, a `useMutation`) → `CreateAgent`'s submit button,
  which shows a spinner while pending, a friendly error banner (prefers the
  server's message, e.g. an overload notice, over a generic one), and — as a
  temporary placeholder — dumps the raw JSON response in a `<pre>` block.
  Types for the response shape live in `features/agents/types.ts`.
  `QueryProvider` (`components/providers/query-provider.tsx`) wraps the app
  in `app/layout.tsx`.

### Not yet wired
- No clarification-question UI (tutorial's "AI agent questionary" step) —
  `components/ui/questionnaire.tsx` exists as a shadcn-style primitive but
  isn't wired into the create-agent flow yet. Right now a
  `needs_clarification` response just shows up in the raw JSON dump.
- No re-POST-with-answers flow for the clarification follow-up.
- No `agent_config`/`agents` table to persist a generated config, and no save
  step/UI for reviewing+editing the generated config before saving.
- Everything from "Edit Agent Feature" onward (tool connections, chat with
  agent, Browserbase custom agent, scheduling, run history) is not started.

## The agent-configuration flow (as implemented)

`POST /api/agent/configure`:

1. **Fetch available tools**: `db.select({ slug: tools.slug }).from(tools)` —
   keeps the tool list DB-driven instead of hardcoded in the prompt, so new
   tools don't need a prompt/code change.
2. **Build the prompt**: take `constant/prompts.ts`'s
   `agent_config_system_prompt` and replace its two placeholders:
   - `{{AVAILABLE_TOOLS}}` → the fetched tool slugs
   - `{{USER_REQUEST}}` → the request body's `prompt` (on a clarification
     follow-up call, the previous prompt + `JSON.stringify(answers)` appended
     — the append step itself isn't built yet, see "Not yet wired" above)
3. **Call Groq** (`groq.chat.completions.create`, model `openai/gpt-oss-120b`)
   with that filled-in prompt as a single user message, and
   `response_format: { type: "json_schema", json_schema: agent_config_response }`
   (from `constant/response_schema.ts`) so the output always matches the
   contract below. Wrapped in `generateWithRetry`, which retries transient
   `503`/`429` failures a couple times before giving up.
4. **Response contract** (see `constant/prompts.ts` for the authoritative
   copy):
   ```ts
   {
     status: "ready" | "needs_clarification",
     clarificationQuestions: {
       id: string
       question: string
       type: "text" | "single_select" | "multi_select"
       options: string[]
       allowCustom: boolean
       customPlaceholder: string
     }[],
     config: {
       name: string
       description: string
       objective: string
       instructions: string
       tools: string[]        // slugs, subset of AVAILABLE_TOOLS
       skills: string[]
       schedule: { type: "manual" | "once" | "recurring"; frequency: "daily" | "weekly" | "monthly" | null; time: string | null }
       outputFormat: string
     } | null
   }
   ```
5. **If `needs_clarification`**: the client renders the questions (one at a
   time or as a stepper), collects answers, and re-POSTs with the answers
   appended to the original prompt as described above.
6. **If `ready`**: the client shows the generated config (editable), and on
   save, inserts it into an `agent_config`/`agents` table — columns per the
   tutorial: `id` (serial), `userEmail` (references `users.email`), `agentId`
   (unique), `name`, `agentImage`, `description`, `instructions`, `objective`,
   `tools` (jsonb), `skills` (jsonb), `schedule` (jsonb), `outputFormat`
   (text), `createdAt`. This table doesn't exist in `db/schema.ts` yet.

## File map

| Area | Path |
|---|---|
| DB connection | `db/index.ts` |
| DB schema (`users`, `tools`) | `db/schema.ts` |
| DB seed (tools) | `db/seed.ts` |
| Agent-config system prompt | `constant/prompts.ts` |
| Agent-config response schema (JSON Schema, Groq strict mode) | `constant/response_schema.ts` |
| Agent-config API route | `app/api/agent/configure/route.ts` |
| Agent-config API call | `features/agents/api/index.ts` (`agentConfigure`) |
| Agent-config mutation hook | `features/agents/hook/use-agent-configure.ts` (`useAgentConfigure`) |
| Agent-config response types | `features/agents/types.ts` |
| TanStack Query client provider | `components/providers/query-provider.tsx` |
| User upsert API route | `app/api/users/route.ts` |
| Root providers (user sync, theme) | `components/providers/root-layout-provider.tsx` |
| Dashboard shell | `app/(root)/layout.tsx`, `components/app-sidebar.tsx` |
| Agents page | `app/(root)/agents/page.tsx` → `features/agents/_components/agents-view.tsx` |
| Create-agent composer UI | `features/agents/_components/create-agent.tsx` |
| My-agents list (placeholder) | `features/agents/_components/my-agents.tsx` |
| Agent usage/limit dialog | `components/agent-usage-dialog.tsx` (uses `AGENT_LIMIT` from `db/schema.ts`) |
| Code style conventions | `.claude/docs/code-style.md` |

## Open questions / next steps

Roughly in the order the tutorial tackles them from here:
1. Add `GROQ_API_KEY` to `.env` so `/api/agent/configure` actually works.
2. Replace `CreateAgent`'s raw JSON dump with real UI: render
   `clarificationQuestions` (wiring in `components/ui/questionnaire.tsx`),
   collect answers, and re-POST with them appended to the prompt; render a
   `ready` `config` as an editable review step.
3. Add the `agent_config` table + save endpoint.
4. Build out `MyAgents`, then the remaining chapters (tool connections, chat,
   Browserbase custom agent, scheduling, run history/dashboard).
