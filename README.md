# KAIRO — Teach with Quality. Learn with Intelligence.

An AI-powered teaching platform for **Royal School – CBSE, Classes 1–5**. KAIRO
gives administrators a management portal and teachers a curriculum-grounded AI
workspace that generates classroom activities, worksheets and quizzes **from the
school's own uploaded materials** — never from hallucinated or unsourced content.

Built with Vite + React 19 + TypeScript + Tailwind, Supabase (Auth, PostgreSQL,
Row-Level Security, private Storage, Edge Functions) and Zod validation end to end.

---

## What it does

- **Two strictly separated portals.** Admins and teachers have distinct layouts,
  navigation and authorization. A teacher can never reach an admin route, read
  admin data, or escalate their own role — enforced in the database, not just the UI.
- **Curriculum-grounded RAG.** Teachers ask questions and generate resources that
  are answered **only** from chapters they are assigned and that an admin has
  published. Citations are validated against the chunks actually retrieved; any
  invented citation is dropped. If a chapter does not cover something, KAIRO says
  so instead of guessing.
- **Generators.** Practical classroom activities (13 types), print-ready
  worksheets with a separate answer key, and quizzes with marks + explanations.
  Every AI payload is validated against a strict Zod schema before it can be saved.
- **Private library.** Each teacher's saved resources and history are visible only
  to them — admin analytics counts them but cannot read their contents.
- **Graceful setup mode.** With no Supabase/AI configured, the app renders clear
  "connect Supabase" / "AI not configured" messages rather than faking data.

---

## Prerequisites

- Node 20+ (developed on Node 24, npm 11)
- A Supabase project (free tier is fine)
- An OpenAI-compatible AI provider key (e.g. OpenRouter) for AI features

---

## 1. Install

```bash
npm install
```

## 2. Configure environment

Copy `.env.example` to `.env` and fill it in.

**Browser-safe (bundled into the frontend — anon key only):**

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

**Server-only (NEVER exposed to the browser — set as Edge Function / script secrets):**

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
AI_PROVIDER_API_KEY=<provider-key>
AI_PROVIDER_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=anthropic/claude-sonnet-5-5
# Optional embeddings (retrieval also works lexically without these):
EMBEDDING_MODEL=
EMBEDDING_BASE_URL=
EMBEDDING_API_KEY=
# First-admin provisioning:
FIRST_ADMIN_EMAIL=principal@royalschool.edu
FIRST_ADMIN_NAME=Principal
```

> The service-role key and AI keys are only ever read by the Edge Functions and
> the provisioning script. They are **never** referenced by any `VITE_` variable
> or any file under `src/`.

## 3. Apply the database migrations

Run the SQL in `supabase/migrations/` in order (`0001` → `0007`). Either paste
each file into the Supabase SQL editor, or with the Supabase CLI:

```bash
supabase db push
```

This creates the schema (grades constrained to 1–5 in the DB), enables RLS on
every table, creates the private `curriculum` storage bucket with its policies,
and seeds the six subjects + Classes 1–5 for 2025-2026. **No admin account or
password is seeded.**

## 4. Deploy the Edge Functions

```bash
supabase functions deploy admin
supabase functions deploy process-document
supabase functions deploy ai-generate
# set the server secrets (never in the frontend):
supabase secrets set AI_PROVIDER_API_KEY=... AI_MODEL=anthropic/claude-sonnet-5-5 AI_PROVIDER_BASE_URL=https://openrouter.ai/api/v1
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into functions by
Supabase automatically.

## 5. Provision the first admin (secure, no hardcoded password)

```bash
node scripts/provision-first-admin.mjs
```

It creates/promotes the admin, sets their profile to `role=admin, status=active`,
and prints a **one-time recovery link** so the admin chooses their own password.
Nothing is printed except that link; no password is ever stored in code.

### Dev-only: quick test logins

For clicking through both portals during development you can seed two fixed
accounts instead of using invites/recovery links:

```bash
ALLOW_DEV_SEED=yes npm run seed:dev
# super@royalschool.test    / KairoDev!2026   (role=super_admin — full control)
# admin@royalschool.test    / KairoDev!2026   (role=admin — principal)
# teacher@royalschool.test  / KairoDev!2026   (role=teacher, assigned Class 1 / A / English)
```

Override the password with `DEV_SEED_PASSWORD`. The script refuses to run unless
`ALLOW_DEV_SEED=yes` is set — **never run it against a production project.**

**No backend at all?** Set `VITE_DEV_AUTH=1` in `.env` (and leave the Supabase
vars blank) to enable a dev-only mock sign-in in `npm run dev`. Any password
works; the role comes from the email — `super@…` → super admin, `admin@…` →
principal, anything else → teacher. This mode is compiled out of production
builds and reads/writes no data.

### Roles

| Role | Who | Powers |
| --- | --- | --- |
| `super_admin` | System owner | Everything a principal can do **plus** the **Administrators** page: invite/promote/demote principals, suspend any account, reset passwords. Cannot change their own role or status. |
| `admin` | Principal | Full school administration: teachers, classes, assignments, curriculum, settings. Cannot touch administrator accounts. |
| `teacher` | Teaching staff | Their own assigned classes/subjects and AI workspace only. |

Roles are enforced server-side: `is_admin()` covers both admin and super_admin,
`is_super_admin()` gates the elevated powers, and a trigger (`guard_profile_privileges`)
blocks principals from granting or editing administrator roles even via direct SQL.

## 6. Run

```bash
npm run dev       # local dev server
```

Open the app, go to the admin portal login, use the recovery link to set a
password, then invite teachers from **Admin → Teachers**.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc --noEmit` typecheck + production build |
| `npm run typecheck` | Type-only check |
| `npm run lint` | ESLint over `src`, `tests`, `supabase/functions` (zero warnings) |
| `npm run test` | Unit + security (RLS) tests via Vitest |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run provision:admin` | Provision the first admin |

---

## How the security model works

- **Authorization lives in the database.** RLS policies and SECURITY DEFINER
  helpers (`is_admin`, `is_active_teacher`, `teacher_can_access_material`) decide
  every read/write. Client-side role checks are only for UX.
- **Role/status escalation is blocked** by a `BEFORE UPDATE` trigger on `profiles`
  (`guard_profile_privileges`): a non-admin cannot change their own role or status.
- **Private content is owner-only.** `activities`, `worksheets`, `quizzes`,
  `generation_history`, `chat_*` have no admin read policy — admin dashboards use
  `count` aggregates only.
- **Object-level authorization (no IDOR).** Owning a row is not enough to
  reference arbitrary objects: `WITH CHECK` clauses (migration `0007`) require a
  teacher's saved content to point only at materials in their assignment scope
  (`teacher_assigned_to_material`), and a chat message to belong to a session
  they own (`teacher_owns_session`). A teacher cannot bind their content to
  another class's material or inject messages into someone else's session.
- **Audit logs are append-only.** No INSERT/UPDATE/DELETE policy exists for
  authenticated users; writes happen through SECURITY DEFINER functions / the
  service role, and admins may only read them.
- **Materials are gated twice:** a teacher sees a chapter only when it is
  `status='ready'` **and** `is_published=true` **and** they hold a live assignment.
  Storage objects inherit the same check.
- **AI is server-side only.** The `ai-generate` function re-verifies the caller,
  enforces assignment access, retrieves only that material's chunks, calls the
  provider with the service-side key, and validates citations before returning.
  Uploaded document text is treated as untrusted — embedded instructions are ignored.

---

## Project layout

```
src/
  app/            router + role guards
  components/     shared UI (Logo, Spinner, Toast, ConfirmDialog, …)
  features/       auth context, curriculum demo/print, ai, history
  layouts/        PublicLayout, AdminLayout, TeacherLayout
  lib/            supabase client, Zod schemas, hooks
  pages/          public / admin / teacher screens
  services/       catalog, admin, materials, generate (call Edge Functions)
  types/          DB row types
supabase/
  migrations/     0001 schema · 0002 RLS · 0003 storage · 0004 seed ·
                  0005–0006 super_admin · 0007 object-level authz
  functions/      admin · process-document · ai-generate · _shared
scripts/          provision-first-admin.mjs
tests/
  unit/           schema + citation + route-guard tests
  security/       pglite harness + real RLS tests
  e2e/            Playwright
```

---

## Testing notes

The security tests run the **real migrations** inside an in-process Postgres
(`@electric-sql/pglite`) and execute queries under a non-owner `authenticated`
role, so RLS and the privilege trigger are genuinely enforced — not mocked. This
lets the authorization model be verified without Docker or the Supabase CLI.
