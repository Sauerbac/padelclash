Status: done

## What to build

Wire Better Auth with email+password authentication and email verification (Resend). On fresh registration, create both the auth `user` row and a new `player` row, linked via `user.player_id`. Login/session handling, a register form, and a login form. Google sign-in is out of scope for this slice (follows the spine).

## Acceptance criteria

- [x] New visitor can register with email+password → verification email sent — runtime: `POST /api/auth/sign-up/email` → 200, console adapter logs the verification link (no Resend key needed locally)
- [x] After verification, `user` row exists with `player_id` pointing to a `player` row — Tier-3 test + runtime: following the link flips `email_verified=t`; `user.player_id` = `player.id` (`Ada Lovelace`/`Rosa Test`)
- [x] Login with verified credentials creates a session — runtime: `sign-in/email` → 200 + `better-auth.session_token` cookie; authed `/profile` renders the name
- [x] Protected route redirects unauthenticated visitors to login — runtime: `GET /profile` with no cookie → 307 → `/login`
- [x] Logout clears the session — runtime: `sign-out` → 200, then `/profile` with the same cookie → 307 → `/login`

## Done this session

- **`src/env.ts`** — lazy, fail-loud `serverEnv()` validating the three boot-required
  vars (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`), aggregating all
  missing at once. Lazy on purpose: `next build` has no env (Docker builder, no
  `.env`), so it only fires at request time — mirrors `db/client.ts`.
- **`src/services/email/`** — the `EmailSender` port (ADR-0012): `ConsoleEmailSender`
  (prints the link to the server log), `ResendEmailSender`, and a
  `selectEmailSender`/`getEmailSender` factory keyed on `RESEND_API_KEY`. Pure
  selection is unit-tested (`email.test.ts`); no key needed locally.
- **`src/auth/`** — `createAuth({db, emailSender, secret, baseURL, google?})` (Better
  Auth + Drizzle adapter at `better-auth/adapters/drizzle`), email+password with
  `requireEmailVerification`, and a `user.create.before` hook that mints the linked
  `player` row and returns its id as `playerId` (declared `additionalFields`,
  `input:false`; the DB NOT-NULL is the backstop). `getAuth()` is the lazy prod
  singleton; `session.ts` exposes `getSession`/`requireSession`; `client.ts` is the
  browser client. Google provider is wired conditionally (creds present) per ADR-0012;
  no Google button this slice (out of scope).
- **`src/app`** — `api/auth/[...all]/route.ts` (lazy handler), `(auth)/register` +
  `(auth)/login` client forms (ui `Button`/`TextInput`), protected `profile/` page
  (`requireSession` → redirect) with a `LogoutButton`.
- **`auth.integration.test.ts`** (Tier-3) — sign-up creates `player` + linked `user`
  (`player_id` match, `email_verified=false`) and sends the verification email through
  an injected capturing sender. Plus the full HTTP flow exercised end-to-end against a
  dev server (register → verify → login → protected → logout).
- **`.npmrc`** (`legacy-peer-deps=true`) — Better Auth's *optional* `@tanstack/react-start`
  peer wants vite≥7, colliding with vitest 2's vite@5; we use neither. Needed so
  `npm ci` in the Docker build resolves. Added `better-auth`@1.6.18 + `resend`@6.12.4.
  The blunt-vs-narrow fix is deferred to Simon — see
  [open-question 05](../../../docs/open-questions/05-npm-peer-dependency-resolution.md).
- **No schema/migration change** — slice 02 already created the Better Auth tables with
  the `user.player_id` FK; this slice only wires the runtime against them.

### Notes / deferred

- A failed `user` insert after the before-hook would orphan an unclaimed `player`
  row (no membership, no matches → invisible). Better Auth checks email-uniqueness
  before the hook runs, so the realistic path (duplicate email) never reaches it.
  Acceptable for this slice; revisit if hook→insert ever shares a transaction.
- The hardcoded `status: "confirmed"` on logged matches and the trust-mode default
  remain open-question 03's domain (unrelated to this slice).

## Blocked by

- 02-core-schema-migration

## Notes

Build email behind an `EmailSender` port (ADR-0012): a `ResendEmailSender` for
deployed environments and a `ConsoleEmailSender` (prints the verification/claim
link to the server log) selected when `RESEND_API_KEY` is absent — so the
register→verify flow is testable locally with **no Resend key**. A real key is
only needed to exercise live mail delivery. Likewise, offer Google sign-in only
when `GOOGLE_CLIENT_ID`/`_SECRET` are present; email+password is the primary
path. Env vars (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, etc.) are already in
`.env.example`; this slice introduces the env-validation module that makes
`BETTER_AUTH_SECRET` a required, fail-loud var.
