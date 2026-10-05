# Code Style

- TypeScript **strict** (+ `noUncheckedIndexedAccess`). No `any`; prefer `unknown` + narrowing.
- Formatting: Prettier (`npm run format`), Tailwind class sorting via plugin.
- Lint: ESLint flat config extending `next/core-web-vitals` + `next/typescript`.
- Imports use the `@/` alias for `src/`.
- Files: `kebab-case.ts(x)`; components `PascalCase` exports; one component per file
  for design-system primitives.
- Server-only modules import `"server-only"` at the top.
- Business logic lives in `src/features/<domain>/server/`, never in components.
- Server actions return `ActionState` (`{ ok, message?, fieldErrors? }`) for forms,
  or `redirect()` on success.
- Validation schemas live in `src/features/<domain>/schemas.ts` and are reused by
  client and server.
- Never log secrets, tokens, passwords or full request bodies. Use `logger`.
- Prefer small pure functions that are unit-testable (cost math, permissions,
  status transitions).
- Comments explain _why_, not _what_.
