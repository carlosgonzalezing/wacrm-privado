<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Commands

Always run in this order for CI parity:

```
npm run lint        # ESLint (eslint-config-next core-web-vitals + typescript)
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run build       # next build (TS errors ignored at build — typecheck separately)
```

- `npm run dev` — dev server at http://localhost:3000
- `npm run format` / `npm run format:check` — Prettier (single quotes, trailing commas es5, LF, 80 cols, tailwindcss plugin)
- `npm test -- path/to/file.test.ts` — run a single test file
- `npm run test:watch` — vitest in watch mode

## Stack

- **Next.js 16** (App Router, React 19, TypeScript 6, Tailwind CSS v4)
- **Supabase** — Postgres + Auth (cookie-based via `@supabase/ssr`) + Storage + RLS
- **shadcn/ui** — base-nova style, CSS variables, neutral base. Components at `@/components/ui`, utils at `@/lib/utils`
- **next-intl** — locale defaults to `es`, fallback to `en`. i18n messages in `messages/`

## Architecture

Route groups (no URL segment):
- `src/app/(auth)/` — login, signup, forgot-password. Redirects to `/dashboard` if already signed in.
- `src/app/(dashboard)/` — all authenticated pages (inbox, contacts, pipelines, broadcasts, automations, settings, flows, leads, agents, dashboard, notifications). Wrapped in `DashboardShell`.
- `src/app/api/` — API routes including `/api/v1` public REST API and WhatsApp webhooks.
- `src/middleware.ts` — auth guard. Protected routes: `/dashboard`, `/inbox`, `/contacts`, `/pipelines`, `/broadcasts`, `/automations`, `/settings`.
- `src/lib/` — business logic organized by domain (ai, auth, automations, contacts, inbox, flows, webhooks, whatsapp, etc.)
- `src/components/` — React components (UI primitives in `ui/`, feature components co-located by domain)

## Supabase client pattern

- **Browser**: singleton via `src/lib/supabase/client.ts` — create only one instance per page session (multiple instances cause auth-lock contention)
- **Server** (Server Components / Route Handlers): `src/lib/supabase/server.ts` — uses `cookies()` from `next/headers`
- **Middleware**: inline `createServerClient` with request/response cookie passthrough — never import the server client here
- Database types: `supabase/database.types.ts` (auto-generated)
- Migrations: `supabase/migrations/` (sorted by numeric prefix, prettier-ignored)
- RLS is on every table. Service role key (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS — server-side only, never in client code.

## Environment variables

**Required** (app won't start without them):
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public, baked at build time
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only, bypasses RLS
- `ENCRYPTION_KEY` — 64 hex chars (AES-256-GCM). Rotating orphans all tokens.
- `META_APP_SECRET` — verifies HMAC-SHA256 on WhatsApp webhook POSTs

**Key optional vars**:
- `NEXT_PUBLIC_SITE_URL` — canonical URL for sitemap/OG
- `NEXT_PUBLIC_APP_LOCALE` — default locale (defaults to `es`)
- `AUTOMATION_CRON_SECRET` — required for Wait steps in automations
- `WHATSAPP_TEMPLATES_DRY_RUN=true` — use in dev/CI to skip real Meta API calls
- AI assistant is bring-your-own-key per account (stored encrypted) — no global AI env var

## Testing

- Framework: Vitest, node environment, tests at `src/**/*.test.ts` / `src/**/*.test.tsx`
- Vitest config sets dummy `ENCRYPTION_KEY` and `META_APP_SECRET` — tests that import `lib/whatsapp/*` need these at module load
- CI env vars must match vitest.config.ts values
- `tsconfigPaths: true` so `@/` imports resolve in tests

## Conventions

- `.editorconfig`: 2-space indent, UTF-8, LF, trailing whitespace stripped (except `.md`)
- Prettier ignored: `supabase/migrations`, `public/opus`
- shadcn/ui component registries defined in `components.json` — use `npx shadcn add` to add UI components
- Next.js `typescript.ignoreBuildErrors: true` — build ignores TS errors; always run `npm run typecheck` separately
- TS `strict: false` — codebase is not fully strict-typed
- `postcss.config.mjs` uses `@tailwindcss/postcss` (Tailwind v4 plugin), not the old `tailwindcss` PostCSS plugin

## MCP server

Separate package in `mcp-server/` with its own `package.json`, `tsconfig.json`, and dependencies. Built with `tsc`, run with `node dist/index.js`. Not part of the Next.js app — it connects to the same Supabase backend via REST API.

## Important gotchas

- **Cookie refresh in middleware** (issue #288): When `supabase.auth.getUser()` refreshes the session, it writes new cookies to the `supabaseResponse`. Any redirect or JSON response you return must copy those cookies back (`withRefreshedCookies` helper) or the session wedges.
- **Server Component cookie writes**: `supabase/ssr` `setAll()` throws in Server Components — the server client catches this silently. Auth token refresh only works in middleware and Route Handlers.
- **Next.js 16 breaking changes**: APIs, conventions, and file structure differ from older Next.js versions. Check `node_modules/next/dist/docs/` before writing framework code.
- No global AI provider key — each account sets its own OpenAI/Anthropic key under Settings → AI Assistant.
- This is a **template repo** — contributions flow is fork → customize → deploy. Feature PRs generally belong in forks.
