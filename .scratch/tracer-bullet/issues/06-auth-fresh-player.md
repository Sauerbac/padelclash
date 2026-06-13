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

Needs a Resend API key in `.env`. The slice codes AFK but verification requires the key.
