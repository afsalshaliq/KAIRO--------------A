# KAIRO — Final Build & Verification Report

_Generated 2026-10-12. All results below come from commands actually executed on
this checkout, not estimates. See [README.md](README.md) for full setup/deploy steps._

## 1. Quality gates — actual results

Every gate was run against the current merged working tree and its real exit code
captured (not masked by a trailing `echo`/pipe).

| Gate | Command | Result |
|------|---------|--------|
| Type check | `npm run typecheck` (`tsc --noEmit`) | **PASS** — exit 0, 0 errors |
| Lint | `npm run lint` (`eslint src tests supabase/functions --max-warnings 0`) | **PASS** — exit 0, 0 errors, 0 warnings |
| Unit + security tests | `npm run test` (`vitest run`) | **PASS** — 4 files, **70/70 tests passed** |
| Production build | `npm run build` (`tsc --noEmit && vite build`) | **PASS** — exit 0, 229 modules |

Build output:

```
dist/index.html                   0.93 kB │ gzip:   0.50 kB
dist/assets/index-*.css          34.73 kB │ gzip:   6.71 kB
dist/assets/index-*.js          851.33 kB │ gzip: 233.03 kB
```

> The 851 kB JS bundle exceeds Vite's 500 kB advisory (a warning, not a failure).
> It is a single eager chunk; route-level `React.lazy`/dynamic `import()` would
> split it. Logged under Limitations.

## 2. Tests executed (what actually ran)

| File | Tests | Covers |
|------|------:|--------|
| `tests/security/rls.test.ts` | 30 | Real migrations in in-process Postgres (`@electric-sql/pglite`) under a non-owner `authenticated` role. Grade 1–5 CHECK; teacher material visibility (assigned + ready + published only); chunk access; cross-teacher privacy of activities/history/chats; admin cannot read private generated content; role/status escalation blocked by trigger + RLS; `full_name` self-update allowed; suspended account loses access; owner-spoof blocked; audit-log immutability (INSERT rejected; UPDATE/DELETE no-op 0 rows). |
| `tests/security/multi_tenant.test.ts` | 17 | Tenant isolation across schools; cross-tenant read/write denial; `super_admin` cross-tenant reach; principal/teacher_admin scoping. |
| `tests/unit/schemas.test.ts` | 18 | Zod validation for login/invite/class/upload, AI activity/worksheet/quiz output (MCQ answer ∈ options, true/false constraints, ≥2 options), citation validation (drops invented citations), multi-tenant schemas, educational-topic classifier, bulk CSV import. |
| `tests/unit/guards.test.tsx` | 5 | `RequireRole` guard: spinner while loading, unauthenticated → matching portal login, teacher blocked from admin, admin blocked from teacher, matching role admitted. |
| **Total** | **70** | |

Security tests enforce RLS genuinely (no mocks, no Docker/Supabase CLI). Run just
those with `npm run test:rls`.

Playwright e2e config exists (`npm run test:e2e`); browser specs are **not yet
written** (Limitations).

## 3. Backend / AI / realtime status

- **Database:** 11 versioned migrations (`supabase/migrations/0001_…`→`0011_…`),
  27 tables, `user_role` enum `super_admin | admin | principal | teacher_admin | teacher`.
- **Edge Functions (Deno):** `admin/` (invite/status/recovery, re-verifies admin
  per request), `process-document/` (extract → chunk → optional embed), and
  `ai-generate/` — the **only** AI path; gated by live teacher assignment, grade
  forced to the DB value (1–5), citations validated server-side, returns a clear
  503 setup message when no AI key is configured, and 422 (no silent fallback)
  when there is no grounded context.
- **AI provider:** server-side only via `AI_PROVIDER_API_KEY`. No secret ships in
  the client bundle. If unset, the UI shows a setup message rather than faking.
- **Realtime:** not yet wired to Supabase channels (polling/`load()` refresh in
  place). Listed under Limitations.

## 4. Environment variables still needing real values

Copy `.env.example` → `.env` (client) and set Edge Function secrets server-side:

- **Client (browser-safe):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Server-only (never `VITE_`-prefixed, never committed):**
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_PROVIDER_API_KEY`,
  `AI_PROVIDER_BASE_URL`, `AI_MODEL`, and optionally
  `EMBEDDING_PROVIDER_API_KEY`, `EMBEDDING_MODEL`
- **First-admin provisioning (local/CI only):** `FIRST_ADMIN_EMAIL`, `FIRST_ADMIN_NAME`

Without Supabase configured, the app runs in DEV auth mode (mock logins) and AI
generation is disabled with a visible setup notice.

## 5. Limitations / follow-ups

1. **Bundle size** — single ~851 kB JS chunk; add route-level code splitting.
2. **Realtime** — materials/assignments/processing-status updates are refreshed by
   re-query, not Supabase Realtime subscriptions.
3. **E2E** — Playwright config present; no specs authored yet.
4. **Document extraction** — PDF/OOXML extraction is heuristic (operator/tag
   scraping), not a full parser; scanned/image PDFs are not OCR'd.
5. **Embeddings optional** — retrieval falls back to lexical overlap when no
   embedding model is configured.

## 6. Exact local run commands

```bash
npm install
cp .env.example .env            # then fill in the values from §4
npm run typecheck               # tsc --noEmit
npm run lint                    # eslint, --max-warnings 0
npm run test                    # vitest run (unit + security)
npm run test:rls                # security/RLS suite only
npm run build                   # tsc --noEmit && vite build
npm run dev                     # Vite dev server
npm run provision:admin         # secure first-admin (one-time recovery link)
npm run seed:dev                # optional dev test users
```
