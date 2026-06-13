Status: ready-for-agent

## What to build

Wire Better Auth with email+password authentication and email verification (Resend). On fresh registration, create both the auth `user` row and a new `player` row, linked via `user.player_id`. Login/session handling, a register form, and a login form. Google sign-in is out of scope for this slice (follows the spine).

## Acceptance criteria

- [ ] New visitor can register with email+password → verification email sent (Resend)
- [ ] After verification, `user` row exists with `player_id` pointing to a `player` row
- [ ] Login with verified credentials creates a session
- [ ] Protected route redirects unauthenticated visitors to login
- [ ] Logout clears the session

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
