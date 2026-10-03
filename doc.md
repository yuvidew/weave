# Weave — Full Project Documentation

**Weave** lets a user create their own AI agents in plain language and connect them to real tools (Gmail, Notion, Slack, Google Calendar, web search, browser automation, etc.), so an agent can actually take action — not just describe what it would do. Agents run on a recurring schedule or on-demand, execute in the background via a durable job engine, and every run's full output is kept for review.

- Live: `https://weave-sepia.vercel.app`
- Repo: `https://github.com/yuvidew/weave`

---

## 0. What Is Weave, and What Problem Does It Solve?

### The problem

Today, if you want an "AI agent" that actually does something useful for you on a schedule, you're stuck between two bad options:

1. **A chatbot.** ChatGPT/Claude/Gemini can *tell you* how to summarize your inbox or draft a Slack update, but it can't log into Gmail, read your actual messages, or post to your actual Slack. You still do the work — the AI just talks about it. Nothing runs unless you're there, typing, every single time.
2. **A developer project.** Frameworks like LangChain or a hand-rolled script *can* actually call Gmail/Slack/Notion APIs — but only if you can write code, register OAuth apps with each provider yourself, host a server or cron job somewhere, handle retries when something fails, and build your own way to check whether last night's run actually worked. That's a multi-day engineering project just to get one automation running, and it's completely out of reach for a non-developer.

There's no accessible middle ground: describe what you want in plain English, and have it *actually happen*, on its own, safely, with your real accounts — without writing code or standing up infrastructure.

### What Weave does about it

Weave is that middle ground — a no-code personal AI automation platform:

1. **You describe the job in plain English** — "summarize my inbox every morning and post the highlights to Slack." An LLM (Groq) turns that into a working agent: its instructions, which tools it needs, and its schedule — no code, no config files.
2. **You connect your real accounts once** — Gmail, Notion, Slack, Google Calendar, etc., through a secure OAuth flow (Pipedream Connect). Connect an app once and *every* agent you own can use it.
3. **The agent actually runs the job** — on a recurring schedule or on-demand — using a durable background job engine (Inngest), not a browser tab you have to keep open. It calls the real Gmail/Slack/Notion APIs and does the real work.
4. **You can trust and verify what happened** — every run is logged end-to-end (queued → running → completed/failed) with its full output kept for review, so "the agent did something" is never a black box.

### Who it's for

- Someone who wants a personal automation (inbox triage, a daily research digest, meeting prep, a recurring status post) and doesn't want to hire a developer or learn to code to get it.
- A builder who wants to see a real, working AI-agent product — end to end, from "type a sentence" to "a scheduled job actually fires and does the thing" — without stitching that infrastructure together themselves.

### What makes it more than "a chatbot with extra steps"

- **It actually executes**, via real, curated, hand-verified integrations — not just an LLM narrating intended actions.
- **It runs unattended.** A scheduled agent fires on its own; the user doesn't need to be present, remember to ask, or keep a tab open.
- **Tool access is per-user, not per-agent.** Connect Gmail once and it's immediately available to every agent that user creates — no re-authenticating per automation.
- **Every run is auditable.** Status, timestamps, and full output are persisted per run, not just visible in a fleeting chat window.

---

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | Renames `middleware.ts` → `proxy.ts`; other breaking changes vs. older Next docs/training data |
| Language | TypeScript | |
| UI | React 19, Tailwind CSS 4, shadcn/ui, Radix/Base UI primitives | `components/ui/` is shadcn CLI output, left in generated style |
| Auth | Clerk (`@clerk/nextjs`) | Session/user management, hosted sign-in/sign-up UI |
| Database | Neon (serverless Postgres) via Drizzle ORM | `db/schema.ts` |
| Background jobs / scheduling | Inngest | Durable step functions; cron + event-triggered |
| LLM | Groq (`groq-sdk`) | Used for both agent-config generation and the chat tool-calling loop |
| Tool integrations | Pipedream Connect (OAuth + action execution), Browserbase (managed browser automation), SerpAPI (web search) | |
| Data fetching (client) | TanStack Query | |

---

## 2. High-Level Architecture

```
Browser (Next.js UI)
   │
   ├─ Clerk session ──────────────► app/(root)/layout.tsx: auth() gate
   │
   ├─ POST /api/agent/configure ──► Groq (structured output) ──► AgentConfig row (Drizzle → Neon)
   │
   ├─ POST /api/plugin/connect ───► Pipedream Connect (OAuth) ──► connected account (per-user)
   │
   ├─ POST /api/agent/run ────────► AgentRun row (status=scheduled) ──► Inngest event "agent/run.execute"
   │
   └─ GET /api/logs ───────────────► AgentRun rows ──► Runs UI (status/output)

Inngest (background, independent of any open tab)
   ├─ ProcessScheduledAgent   (cron: */5 * * * *)   — sweeps due AgentRun rows
   └─ ExecuteScheduleAgent    (event: agent/run.execute) — runs one specific queued run
        └─ lib/execute-agent.ts → runChatTurn() → Groq tool-calling loop → Pipedream/Browserbase/SerpAPI actions
             └─ writes result back to AgentRun.output / .error
```

Two independent paths queue a run, both converge on the same executor:
1. **Recurring schedule** — a schedule is saved on `AgentConfig.schedule`; `ProcessScheduledAgent` (cron, every 5 minutes) finds `AgentRun` rows whose `scheduledFor` has passed and are still `status = "scheduled"`, claims them, and calls `executeAgent()` directly.
2. **On-demand ("Run now")** — `POST /api/agent/run` inserts an `AgentRun` row and fires an `agent/run.execute` Inngest event; `ExecuteScheduleAgent` (event-triggered) picks it up, waits until `scheduledFor` (usually "now"), claims it the same way, and calls the same `executeAgent()`.

Both functions then, for daily-recurring agents, insert the *next* occurrence's `AgentRun` row before returning — so the schedule perpetuates itself one occurrence at a time rather than needing a separate recurring-event mechanism.

---

## 3. Directory Structure

```
app/
  (auth)/sign-in, (auth)/sign-up      Clerk-hosted auth screens (no custom logic)
  (root)/layout.tsx                    Auth gate for every signed-in route (see §4)
  (root)/dashboard                     Stat tiles + recent activity
  (root)/agents                        Create Agent / My Agents
  (root)/agents/edit-preview           Preview route for the agent-edit flow
  (root)/plugins                       Tool catalog + per-user connections
  (root)/runs                          Run history table + result viewer
  api/
    agent/configure   POST/PUT/GET/DELETE  create, update, fetch, delete an agent
    agent/run         POST                  queue an immediate ("Run now") execution
    agent/chat        GET/POST              chat history, send a chat turn
    agent/chat/resolve POST                 approve/reject a pending tool call
    agent/tools       GET                    per-agent tool connection status
    agent/tools/connect POST/DELETE          connect/disconnect a tool for one agent
    plugin            GET                    full tool catalog + this user's connection status
    plugin/connect    POST/DELETE            connect/disconnect a tool (Plugins page)
    users             POST                   upsert the signed-in user on first sign-in
    logs              GET                    paginated run history + status counts
    inngest           (Inngest serve() handler — GET/PUT/POST via the SDK)
proxy.ts                                Next 16's proxy (renamed middleware) — wires Clerk's request context only
features/
  agents/    create-agent.tsx, agent-card.tsx, agent-edit-sheet.tsx, hook/use-agent.ts, types.ts
  dashboard/ dashboard-view.tsx, dashboard-stat-cards.tsx, recent-agent-card.tsx
  plugin/    plugin-view.tsx, plugin-card.tsx
  runs/      runs-view.tsx, runs-table.tsx, runs-stats.tsx, run-result-sheet.tsx, run-status-badge.tsx
lib/
  execute-agent.ts     Shared entry point that actually runs one agent turn (chat UI + both Inngest functions use it)
  agent-tools.ts       Resolves which of an agent's allowed tools are actually connected right now
  agent-schedule.ts    calculateNextDailyRun() + reschedule helpers
  groq.ts              Groq client + retry/overload/rate-limit helpers
  pipedream.ts         Pipedream Connect client (server-side)
  browserbase-tool.ts  Managed browser automation tool
  serpapi-tool.ts      Web search tool
constant/
  agent-actions.ts     Curated, hand-verified catalog of Pipedream actions an agent may call
  direct-auth-tools.ts Tools using one shared server credential (Browserbase, SerpAPI, Google Search) — no OAuth
  prompts.ts           System prompts for config-generation and chat
  response_schema.ts   Structured-output schema Groq must return for agent config
db/
  schema.ts   Drizzle table definitions (see §5)
  index.ts    DB client + re-exports
  seed.ts     seedTools() — NOT wired to an npm script (see §8, Known Gaps)
inngest/
  client.ts      Inngest client (`id: "weave"`)
  functions.ts   ProcessScheduledAgent (cron) + ExecuteScheduleAgent (event) — see §6
```

---

## 4. Authentication & Route Protection

- **Clerk** handles sign-in/sign-up (`app/(auth)/sign-in`, `app/(auth)/sign-up` — both just render Clerk's hosted `<SignIn />`/`<SignUp />`, no custom UI code).
- **`proxy.ts`** (this Next.js version's renamed `middleware.ts`) only calls `clerkMiddleware()` — it wires up Clerk's request context so `auth()` works elsewhere, but does **not** gate any routes itself.
- **Route protection lives in `app/(root)/layout.tsx`**: a single `auth()` check there gates every route under the `(root)` group (`dashboard`, `agents`, `plugins`, `runs`) at once, redirecting to `/sign-in?redirect_url=...` if there's no session.
  - This is deliberate: the installed `@clerk/nextjs` version deprecates `createRouteMatcher`-based middleware protection ("Middleware-based auth checks rely on path matching, which can diverge from how Next.js routes requests") in favor of checking auth in the resource that actually needs it.
- **API routes self-check** via `currentUser()` from `@clerk/nextjs/server` and reject with an error if signed out — this was already true independent of the layout-level check.
- **`/api/inngest` is intentionally public** — it's a webhook Inngest itself calls and signs with its own signing key, not a Clerk session.

Both an `isClerkConfigured` guard (checks `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` are set) in `proxy.ts` and a mirrored one in `app/(root)/layout.tsx` let local dev run without Clerk keys configured, instead of `auth()` throwing.

---

## 5. Database Schema (`db/schema.ts`)

Postgres via Neon, accessed through Drizzle ORM.

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `name` | text | |
| `email` | text, unique, not null | Clerk-verified email — the app's user key everywhere |
| `agentCredits` | integer, default 5 | Remaining agent-creation credits (`AGENT_LIMIT = 5`) |
| `usageCredits` | integer, default 100 | |
| `createdAt` | timestamp | |

### `tools`
The catalog of every tool an agent could use (both Pipedream-backed and direct-auth).
| Column | Notes |
|---|---|
| `slug` | unique — must match the Pipedream app slug for OAuth tools |
| `name`, `description`, `category`, `type`, `provider`, `icon` | display metadata |
| `requireAuth`, `authType`, `authProvider` | how this tool authenticates |
| `capabilities`, `useCases` (jsonb arrays) | |
| `permissions`, `approvalRules` (jsonb) | which actions need user approval before running |
| `riskLevel`, `canRead`, `canWrite`, `canDelete`, `canExecute` | |
| `status` | `"active"` by default — inactive rows are filtered out of the catalog |

### `agentConfig`
One row per created agent.
| Column | Notes |
|---|---|
| `agentId` | unique string id (not the serial `id`) — used everywhere else as the FK target |
| `userEmail` | FK → `users.email` |
| `name`, `agentImage`, `description`, `instructions`, `objective` | |
| `tools`, `skills` (jsonb arrays) | allowed tool slugs / skill tags |
| `schedule` (jsonb) | `{ type: "manual" \| "once" \| "recurring", frequency, time, timezone, ... }` |
| `outputFormat` | |
| `toolDefaults` (jsonb) | per-action defaults an agent has learned mid-chat (e.g. a discovered Notion parent page id), keyed by action name → arg name → value |
| `status` | `"active"` \| `"inactive"` (pause/resume) |

### `chatMessages`
Row-per-message chat transcript (not one JSON blob per agent), so a single pending tool call inside one assistant turn can be updated with a plain `UPDATE ... WHERE id = ?`.
| Column | Notes |
|---|---|
| `agentId` | FK → `agentConfig.agentId` |
| `role` | `"user"` \| `"assistant"` \| `"tool"` |
| `content` | nullable — an assistant turn that's only tool calls has no content yet |
| `toolCallId` | set on `role="tool"` rows — which call this result answers |
| `toolCalls` (jsonb) | set on `role="assistant"` rows that requested calls; array of `{ id, name, arguments, label, needsApproval, status, result?, error? }` |

### `agentRun`
One row per scheduled or on-demand execution.
| Column | Notes |
|---|---|
| `id` | uuid PK |
| `agentId` | FK → `agentConfig.agentId` |
| `userEmail` | |
| `scheduledFor`, `timezone` | when this occurrence should run |
| `status` | `"scheduled"` → `"running"` → `"completed"` \| `"failed"` (`"skipped"` also modeled) |
| `output` (jsonb), `error` (text) | |
| `queuedAt`, `startedAt`, `completedAt`, `createdAt` | |
| Unique index | `(agentId, scheduledFor)` — prevents double-inserting the same occurrence |
| Index | `(status, scheduledFor)` — for the cron sweep's `WHERE status = 'scheduled' AND scheduledFor <= now()` |

---

## 6. Background Jobs (`inngest/functions.ts`)

### `ProcessScheduledAgent` — cron `*/5 * * * *`
1. Loads up to 100 `AgentRun` rows with `status = "scheduled"` and `scheduledFor` between (now − 1h) and now — the 1-hour lookback catches a stuck/missed run without re-firing something arbitrarily old.
2. For each: atomically claims it (`UPDATE ... WHERE status = 'scheduled'` — if another tick already claimed it, this `UPDATE` returns nothing and the row is skipped).
3. Calls `executeAgent()` (shared with the chat UI) with the agent's `objective` as input.
4. Writes `status = "completed"` + `output`, or `status = "failed"` + `error`.
5. For `schedule.type === "recurring" && frequency === "daily"`, inserts the next day's `AgentRun` row (`onConflictDoNothing` guards against a duplicate from a concurrent tick).

### `ExecuteScheduleAgent` — event `agent/run.execute`
Fired by `POST /api/agent/run` (the "Run now" button) with `{ runId }`. Same claim → execute → persist → reschedule-if-daily pattern as above, but for exactly one run, and calls `step.sleepUntil(run.scheduledFor)` first — for an immediate run this resolves right away since `scheduledFor` is already "now."

Both functions are intentionally near-duplicates rather than one shared step-function, so the cron sweep (many rows per tick) and the single-event path (one row, precise wake time) can each use the Inngest primitive suited to them (`step.run` loop vs. `step.sleepUntil` + single execution) without complicating either.

### `lib/execute-agent.ts` — the actual executor
- Re-fetches the live `AgentConfig` row (never trusts a possibly-stale snapshot the caller has), so a scheduled run always reflects the agent's *current* instructions/tools.
- Calls `runChatTurn()` — the same tool-calling loop the interactive chat UI uses — so a scheduled run behaves identically to a manual chat message and appears in the agent's chat history.
- Prepends `SCHEDULED_RUN_INSTRUCTION`, a fixed system instruction telling the model this is a fire-and-forget automated run (no user present to reply to, must actually call tools rather than just describe doing so, must not try to re-schedule itself).

---

## 7. Agent Creation Flow

1. User types a goal into the "Create Agent" composer (`features/agents/_components/create-agent.tsx`).
2. `POST /api/agent/configure` sends the prompt + `agent_config_system_prompt` (`constant/prompts.ts`) to Groq, constrained to `agent_config_response`'s structured-output schema (`constant/response_schema.ts`).
3. Groq's response is one of two shapes:
   - `status: "needs_clarification"` — returns `clarificationQuestions` (each with a type: text/single_select/multi_select/number/date/time) for the UI to ask before finishing.
   - `status: "ready"` — returns a full `config` (name, description, objective, instructions, tools, skills, schedule, outputFormat), which is saved as a new `agentConfig` row and returned as `agent`.
4. The new agent card auto-opens the connect flow for its first not-yet-connected tool (see §8), so the user isn't left with a working agent that can't actually call anything yet.

`PUT`/`GET`/`DELETE` on the same route handle editing, fetching, and deleting an agent.

---

## 8. Tool Connections

Two distinct authentication models, both surfaced identically in the UI (`PluginCard`):

- **Pipedream-backed tools** (Gmail, Notion, Slack, Google Calendar, etc.) — per-user OAuth via **Pipedream Connect**. `externalUserId` = the signed-in user's email. Connecting an app once (from the Plugins page, or an agent's own "Connect your tools" section) makes it available to *every* agent that user owns — connections are per-user, not per-agent.
- **Direct-auth tools** (`constant/direct-auth-tools.ts`: `browserbase`, `google_search`, `serpapi`) — one shared server-side credential from `.env`, no OAuth flow, always "Available." `google_search` and `serpapi` are two separate catalog rows that are functionally the same search capability, both marked direct-auth so an LLM picking either name still resolves correctly.

`lib/agent-tools.ts`'s `getConnectedTools()` is the single source of truth both the chat loop and the tools UI use to decide which of an agent's allowed slugs are actually usable right now.

---

## 9. Chat & Tool-Calling Loop

- `runChatTurn()` (`app/api/agent/chat/_lib.ts`) builds the system prompt (`buildAgentChatSystemPrompt`), resolves which curated actions (`constant/agent-actions.ts`) are available given the agent's connected tools, and calls Groq with function-calling enabled.
- Each requested tool call is stored as a `StoredToolCall` (`id, name, arguments, label, needsApproval, status`) inside the assistant's `chatMessages.toolCalls` jsonb — statuses: `pending → approved/rejected → done/error`.
- Actions flagged `needsApproval` (per `tools.approvalRules` in the catalog) surface an approval card in the chat UI; `POST /api/agent/chat/resolve` applies the user's approve/reject decision and, if approved, actually runs the Pipedream action.
- `constant/agent-actions.ts` is a **curated, hand-verified** catalog — each `componentId`/`configurableProps` was confirmed live against Pipedream's action registry — not the full open-ended Pipedream action set, since dynamic remote-option props (e.g. picking a specific Slack channel) aren't resolved by this pass.
- A scheduled/automated run (from either Inngest function) reuses this exact loop with `SCHEDULED_RUN_INSTRUCTION` prepended, so its tool calls execute immediately without waiting for approval-in-chat semantics that assume a live user.

---

## 10. Runs & Logs

- `GET /api/logs` returns a paginated page of `AgentRun` rows plus `statusCounts` (completed/failed/scheduled) across *all* of the user's runs, not just the current page.
- `features/runs/_components/runs-view.tsx` renders the "Agent Runs" heading, `RunsStats` (the 3 colored-dot summary cards), and `RunsTable` (columns: Agent, Task, Status, Updated, Result — with a "View" button opening `RunResultSheet`, showing the run's full output).
- `RunStatusBadge` colors: `completed` emerald, `running` sky blue, `scheduled` neutral gray, `failed` red/destructive, `skipped` neutral gray.
- The dashboard (`features/dashboard`) shows the same completed/running/scheduled counts plus a 4th "Attention" (amber) tile for runs needing review, and a "Recent Agents" panel.

---

## 11. Environment Variables

Only variables actually referenced in code are required; others some `.env` files may carry are unused leftovers.

| Variable | Used for | Required |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Base app URL (Config, not Secret, in Vercel — no `NEXT_PUBLIC_` var should ever be marked Secret) | Yes |
| `DATABASE_URL` | Neon Postgres connection (Drizzle) | Yes |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk auth | Yes |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Clerk redirect routes | Yes |
| `GROQ_API_KEY` | Groq LLM (`lib/groq.ts`) | Yes |
| `PIPEDREAM_CLIENT_ID`, `PIPEDREAM_CLIENT_SECRET`, `PIPEDREAM_PROJECT_ID`, `PIPEDREAM_ENVIRONMENT` | Pipedream Connect (`lib/pipedream.ts`) | Yes, for OAuth tools |
| `BROWSERBASE_API_KEY`, `BROWSERBASE_AGENT_ID` | Browserbase direct-auth tool | Yes, for browser-research |
| `SERPAPI_API_KEY` | SerpAPI direct-auth tool | Yes, for web search |
| `INNGEST_DEV` | Forces the Inngest SDK into local dev-server mode | **Development only** — never set in Production/Preview (see §12) |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Auto-provisioned by the Inngest Vercel integration | Production/Preview only, managed automatically |

Not referenced anywhere in code (confirmed via full-repo grep) despite appearing in some `.env` files — safe to omit for a fresh setup: `GOOGLE_GEMINI_API`, `OPEN_API_KEY`, `OPENAI_MODEL`, `COMPOSIO_API_KEY`.

---

## 12. Deployment (Vercel)

Things that aren't obvious from a first deploy, all encountered and fixed on this project directly:

1. **`INNGEST_DEV` must never be set in Production/Preview.** Vercel env vars are baked in per-deployment at build time, not read live — changing/removing this variable only takes effect on the *next* deployment, so a redeploy is required immediately after fixing it.
2. **Install the [Inngest Vercel integration](https://vercel.com/integrations/inngest)** and connect this project — it provisions `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` automatically and re-syncs `/api/inngest` on every deploy.
3. **If Vercel Authentication (deployment protection) is on and there's no custom production domain** (i.e. still on the default `*.vercel.app` URL), Inngest's automated sync requests to `/api/inngest` get blocked by that auth wall. Fix: add a "Protection Bypass for Automation" secret in Vercel (Settings → Deployment Protection) and paste it into the Inngest integration's "Deployment protection key" field for this project.
4. **Signing-key rotation is zero-downtime if done in order:** create a new key on Inngest → set `INNGEST_SIGNING_KEY` to it and `INNGEST_SIGNING_KEY_FALLBACK` to the old key → **redeploy** (env changes aren't retroactive) → verify a sync succeeds → only then click "Rotate key" on Inngest to finalize (permanently deletes the old key) → clean up the now-unneeded `INNGEST_SIGNING_KEY_FALLBACK` var and redeploy once more.
5. Manual sync trigger, if ever needed outside a deploy: `curl -X PUT https://<domain>/api/inngest` — a `{"message":"Successfully registered","modified":true}` response confirms success; `{"message":"Unauthorized"}` on a plain `GET` to the same URL is *expected* in production mode (Inngest only exposes free introspection in dev mode).

---

## 13. Known Gaps / Technical Debt

- `db/seed.ts`'s `seedTools()` is not wired to any npm script — there's no `db:seed` command. Populating the `tools` catalog beyond what's already in the database currently requires calling it manually (e.g. a one-off `tsx db/seed.ts` entrypoint).
- Several `.env` variables (`GOOGLE_GEMINI_API`, `OPEN_API_KEY`, `OPENAI_MODEL`, `COMPOSIO_API_KEY`) are unused leftovers from an earlier iteration of the project (the code comment in `lib/pipedream.ts` notes Pipedream "replaces the old Composio client").
- `Trusted Sources`/OIDC bypass, Password Protection, and other advanced Vercel deployment-protection features are unused/unconfigured on this project as of this documentation.

---

## 14. Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start the production build |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:push` | Push the current schema straight to the database |
| `npm run db:studio` | Open Drizzle Studio to browse the database |

Local dev also needs `npx inngest-cli@latest dev` running alongside `npm run dev` (with `INNGEST_DEV=1` set) so the app has a local Inngest dev server to talk to.
