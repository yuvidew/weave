# CLAUDE.md

Instructions for Claude Code when working in this repository.

## Function/component declaration style

Full rules live in [`.claude/docs/code-style.md`](.claude/docs/code-style.md) — read it before writing or editing any hand-written `.ts`/`.tsx` file. Summary:

| What you're writing | Style |
|---|---|
| React component | `const` + arrow, exported directly — `export const NavUser = () => { ... }` |
| Custom hook | `const` + arrow — `export const useIsMobile = () => { ... }` |
| Plain helper/utility function | `const` + arrow — `const getInitials = (name) => { ... }` |
| Default-exported page/layout component | named `const` first, then `export default` — `const Page = () => {...}; export default Page;` |
| Next.js route handler (`app/api/**/route.ts`) | `const` + arrow, exported directly — `export const POST = async (req) => { ... }` |
| Inline/anonymous (event handlers, `.map`/`.filter`, `useEffect`/`useState` bodies) | arrow function |

**Exception:** `components/ui/` is shadcn CLI output (`function ComponentName(props) { ... }`). Never convert it — leave it in generated style so future `npx shadcn add`/updates don't get overwritten or diverge.

## Comment style

The codebase has historically been under-commented. Every new component, hook, function, and non-obvious variable should carry a short comment explaining intent — not restating the code.

- **Components** get a JSDoc-style block above the declaration, using `@` tags:

  ```tsx
  /**
   * @component NavUser
   * @description Renders the signed-in user's avatar and account dropdown in the sidebar footer.
   */
  export const NavUser = () => { ... }
  ```

  Add `@param` for non-trivial props when it clarifies usage.

- **Hooks, plain functions, and important/non-obvious variables** get a single `//` line directly above them, stating *why*/*what*, not a restatement of the syntax:

  ```ts
  // Tracks whether the viewport is below the mobile breakpoint.
  export const useIsMobile = () => { ... }

  // Extracts up to two initials from a full name for the avatar fallback.
  const getInitials = (name: string) => { ... }

  // Debounce timer id — cleared on unmount to avoid a stray state update.
  const timeoutRef = useRef<NodeJS.Timeout>();
  ```

- Skip comments only for self-evident local variables (loop indices, trivial destructures) and for generated code under `components/ui/`.
