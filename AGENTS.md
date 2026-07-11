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

## Git

- Multi-line commit messages: use the **Bash** tool with a POSIX heredoc —
  `git commit -F - <<'EOF' … EOF`. The Bash tool is Git Bash (POSIX sh), **not**
  PowerShell, so PowerShell here-strings (`@'…'@`) leak a literal `@` into the
  message. (If you use the PowerShell tool instead, its `@'…'@` here-string is
  correct there.)
