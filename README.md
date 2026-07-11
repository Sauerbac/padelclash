# PadelClash Lite

A padel match tracker for one private circle: log matches, watch the Elo
leaderboard move. Installable as a PWA on iOS. Single circle, no accounts —
devices are bound to players; one admin login.

The full design lives in **[docs/padelclash-lite-spec.md](docs/padelclash-lite-spec.md)**.

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 + shadcn/ui · PostgreSQL + Drizzle ·
self-hosted on Coolify.

## Development

```bash
npm install
npm run dev
```

Rating-engine tests (pure, no infrastructure):

```bash
npm test
```
