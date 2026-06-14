## Agent skills

### Issue tracker

Local markdown — issues live in `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Git

- Multi-line commit messages: use the **Bash** tool with a POSIX heredoc — `git commit -F - <<'EOF' … EOF`. The Bash tool is Git Bash (POSIX sh), **not** PowerShell, so PowerShell here-strings (`@'…'@`) leak a literal `@` into the message. (If you use the PowerShell tool instead, its `@'…'@` here-string is correct there.)
