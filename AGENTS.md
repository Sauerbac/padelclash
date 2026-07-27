<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PadelClash Lite

A padel match tracker for one private circle — iOS-installable PWA. This branch
(`lite-rewrite`) is a clean-slate rewrite; the old app is archived on `main`.

**Source of truth: [docs/padelclash-lite-spec.md](docs/padelclash-lite-spec.md).**
All decisions predating the spec are void unless restated there. New decisions get
added to the spec's decision log.

## Architecture rules

- `src/domain/` is framework-free (no Next, no Drizzle, no DB) — pure, fast-testable.
  The rating engine in `src/domain/rating/` is the carried-over crown jewel; its
  tests must stay green.
- Persistence lives in `src/services/`, UI in `src/app/` + `src/components/`.
- UI components come from shadcn/ui (`npx shadcn@latest add <component>`); custom
  components build on those primitives.
- The match log is the source of truth — ratings/stats are derived by replay,
  never patched in place.
- Application route pages that load private or persisted data are an `async`
  loader plus a pure view component taking props. The loader does auth and
  queries; the view renders. Screen states must be reachable without a database
  (decision 127). Fixture-only `/dev/gallery` pages are already pure views and
  are exempt from manufacturing empty async loaders.
- Interactive components take their server action as an optional prop defaulting
  to the real import — `deleteMatch = deleteMatchAction`. Production never
  passes it; the gallery passes stubs. Do not "clean up" these defaults.

## UI states

- Every UI state documented in `docs/ui/` has a case in `/dev/gallery`. A change
  that adds or alters a state updates both in the same commit — this is the only
  guard against the catalogue quietly becoming a lie (decisions 126–128,
  [ADR 0004](docs/adr/0004-dev-only-ui-state-gallery.md)).
- Closed unions (`InvitationState`, `PlayerStatus`, `MatchSyncRefusal`, CVA
  variant keys) are galleried as `Record<Union, Case>` so `tsc` fails on an
  unhandled member. Never widen these to `Partial<>` or an array to silence a
  build — that deletes the only mechanical completeness check in the system.
- The gallery's own chrome uses plain unstyled HTML, never `src/components/ui/`
  primitives. A broken `Button` must not break the tool that reveals it.
- `/dev/gallery` renders fixtures only and never queries the database.

## Git

- Multi-line commit messages: use the **Bash** tool with a POSIX heredoc —
  `git commit -F - <<'EOF' … EOF`. The Bash tool is Git Bash (POSIX sh), **not**
  PowerShell, so PowerShell here-strings (`@'…'@`) leak a literal `@` into the
  message. (If you use the PowerShell tool instead, its `@'…'@` here-string is
  correct there.)
