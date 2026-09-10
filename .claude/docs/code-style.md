# Function declaration style

This documents the project's convention for how to write a named
function/component. It reflects a deliberate switch made across the
hand-written codebase — not what shadcn's generator outputs (see the
exclusion note below).

## The rule

| What you're writing | Style | Example |
|---|---|---|
| A React component | `const` + arrow, exported directly | `export const NavUser = () => { ... }` |
| A custom hook | `const` + arrow | `export const useIsMobile = () => { ... }` |
| A plain helper/utility function | `const` + arrow | `const getInitials = (name) => { ... }` |
| A component that's the default export of a page/layout file | named `const` + separate `export default` | `const Page = () => {...}; export default Page;` (keeps a real name for React DevTools/stack traces — avoid `export default () => {}`) |
| A Next.js route handler (`app/api/**/route.ts`) | `const` + arrow, exported directly | `export const POST = async (req) => { ... }` |
| Anything inline/anonymous (event handlers, `.map`/`.filter` callbacks, `useEffect`/`useState` bodies) | arrow function | `onClick={() => setOpen(true)}`, `items.map((item) => ...)` |

In short: **everything gets `const Name = (...) => { ... }`. The only
exception is a default-exported page/layout component, which still needs a
named `const` first so the export keeps a real display name.**

## Where this applies

Converted to this style: every component in `components/*.tsx` (excluding
`components/ui/`), `components/providers/root-layout-provider.tsx`,
`context/user-detail-context.tsx`, `hooks/use-mobile.ts`, `lib/utils.ts`,
and the page/layout entry points in `app/` (`app/layout.tsx`,
`app/(dashboard)/page.tsx`, `app/sign-in/[[...sign-in]]/page.tsx`,
`app/sign-up/[[...sign-up]]/page.tsx`).

Route handlers (`app/api/users/route.ts`) and inline callbacks already used
this form before the switch — no change needed there.

## `components/ui/` is intentionally excluded

The ~150+ files under `components/ui/` (button, dialog, card, sidebar,
progress, etc.) are shadcn CLI output and are written as `function
ComponentName(props) { ... }`. **Do not convert them.** Any future `npx
shadcn add <component>` (or updating an existing one) re-generates the file
from shadcn's template, which uses `function` declarations — converting them
here would just get overwritten, or silently diverge from what the CLI
regenerates. Leave that directory in its generated style; the arrow-const
rule above applies only to code you write by hand in this project.
