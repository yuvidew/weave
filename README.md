# Weave

**Build & connect your own AI agents.**

Weave lets you create custom AI agents and connect them directly to the tools you already use — Notion, Gmail, Slack, Google Calendar, and more — so agents can actually get work done instead of just chatting about it. Describe what you want in plain language, Weave configures the agent (instructions, tools, schedule), and it runs on autopilot — on-demand or on a recurring schedule — with every run's chat history, tool calls, and output kept for review.

## Features

- **Natural-language agent creation** — describe a goal ("summarize my inbox every morning") and an LLM configures the agent's instructions, tools, and schedule for you.
- **Tool-using agents** — agents can call real actions (Gmail, Notion, Slack, Google Docs/Calendar, web search, browser automation) via a curated, hand-verified action catalog, not an open-ended tool sandbox.
- **Per-user tool connections** — connect an app once (OAuth via Pipedream Connect) and every agent you own can use it; a few tools (Browserbase, SerpAPI) run on a shared server credential with no connect step.
- **Scheduling** — agents run on a cron-like recurring schedule or on-demand ("Run now"), executed reliably in the background via Inngest, independent of any browser tab being open.
- **Run history & logs** — every run (scheduled or manual) is tracked end-to-end: queued → started → completed/failed, with full output and error detail.
- **Authenticated, user-scoped data** — Clerk handles sign-in; every agent, run, and tool connection is scoped to the signed-in user's account.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) — note: this major version renames `middleware.ts` → `proxy.ts` and has other breaking changes from earlier Next.js docs/training data |
| Language | TypeScript |
| UI | React 19, Tailwind CSS 4, shadcn/ui, Radix/Base UI primitives |
| Auth | [Clerk](https://clerk.com) |
| Database | [Neon](https://neon.tech) (serverless Postgres) via [Drizzle ORM](https://orm.drizzle.team) |
| Background jobs / scheduling | [Inngest](https://www.inngest.com) |
| LLM | Groq (`groq-sdk`) |
| Tool integrations | [Pipedream Connect](https://pipedream.com/docs/connect) (OAuth + action execution), Browserbase (managed browser automation), SerpAPI (web search) |

## Project structure

```
app/
  (auth)/          # sign-in / sign-up (Clerk)
  (root)/           # signed-in app shell: dashboard, agents, plugins, runs
  api/
    agent/          # create/configure/run agents, chat turns, tool connect
    plugin/         # tool catalog + per-user Pipedream connections
    users/          # user upsert on first sign-in
    inngest/        # Inngest's serve() webhook endpoint
    logs/           # paginated run history for the UI
features/          # feature-scoped UI: agents, dashboard, plugin, runs
components/ui/     # shadcn-generated primitives (left in generated style)
lib/               # agent execution loop, tool clients (Pipedream/Browserbase/SerpAPI/Groq)
constant/          # curated tool-action catalog, prompts, response schemas
db/                # Drizzle schema, client, seed script
inngest/           # Inngest client + scheduled/on-demand agent-run functions
proxy.ts           # Next 16's proxy (formerly middleware) — wires up Clerk's request context
```

Route protection lives in `app/(root)/layout.tsx` (one `auth()` check gates every signed-in route), not in `proxy.ts` — Clerk's `createRouteMatcher`-based middleware pattern is deprecated as of the installed `@clerk/nextjs` version in favor of per-layout/route checks.

## Getting started

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) Postgres database
- Accounts/API keys for the services you want enabled (see below) — Clerk and a database are required; everything else degrades gracefully or gates that one feature.

### Setup

```bash
git clone https://github.com/yuvidew/weave.git
cd weave
npm install
```

Create a `.env` file in the project root:

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database (Neon + Drizzle)
DATABASE_URL=postgresql://...

# Clerk auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# LLM
GROQ_API_KEY=gsk_...

# Pipedream Connect (per-user tool OAuth)
PIPEDREAM_CLIENT_ID=...
PIPEDREAM_CLIENT_SECRET=...
PIPEDREAM_PROJECT_ID=...
PIPEDREAM_ENVIRONMENT=development   # or "production"

# Direct-auth tools (shared server credential, no per-user OAuth)
BROWSERBASE_API_KEY=...
BROWSERBASE_AGENT_ID=...
SERPAPI_API_KEY=...

# Inngest — only set this locally, never in a deployed environment
# (it forces the SDK into local dev-server mode; see Deployment notes below)
INNGEST_DEV=1
```

Push the schema to your database:

```bash
npm run db:push
```

`db/seed.ts` exports a `seedTools()` helper for populating the `tools` catalog table, but it isn't wired to an npm script yet — run it manually (e.g. via `tsx db/seed.ts` with a small entrypoint, or call it from `db:studio`/a one-off script) if you need catalog rows beyond what's already in your database.

Run the dev server (and, in a separate terminal, `npx inngest-cli@latest dev` to run Inngest's local dev server, which `INNGEST_DEV=1` points the app at):

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start the production build |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:push` | Push the current schema straight to the database |
| `npm run db:studio` | Open Drizzle Studio to browse the database |

## Deployment

Deployed on [Vercel](https://vercel.com). A few things that aren't obvious from a first deploy:

- **`INNGEST_DEV` must never be set in Production/Preview.** It's meant for local dev only (points the SDK at a local Inngest dev server); left on in production it silently breaks scheduled/background runs.
- **Install the [Inngest Vercel integration](https://vercel.com/integrations/inngest)** and connect this project — it provisions `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` and re-syncs `/api/inngest` on every deploy.
- **If Vercel Authentication (deployment protection) is on and there's no custom production domain**, Inngest's sync requests to `/api/inngest` will be blocked by the auth wall. Add a [Protection Bypass for Automation secret](https://vercel.com/docs/security/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation) and paste it into the Inngest integration's "Deployment protection key" field for this project.
- **`NEXT_PUBLIC_*` env vars are inlined into the client bundle** — only mark a variable `Secret` in Vercel if it has no `NEXT_PUBLIC_` prefix; `NEXT_PUBLIC_APP_URL` and the Clerk publishable/redirect vars should be type `Config`, everything else `Secret`.
- Env var changes only apply to the **next** deployment/build — redeploy after changing one for it to take effect.
