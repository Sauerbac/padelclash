Status: ready-for-agent

## What to build

Scaffold the whole delivery pipeline before any feature code exists. A Next.js 15 App Router project with the four-folder layout (`src/domain/`, `src/services/`, `src/db/`, `src/ui/`, `src/app/`), ESLint boundary rules enforcing that `domain` imports nothing of `next`/`drizzle`/`src/db` and `ui` imports nothing of `services`/`db`/`domain`/`next` (except `next/image`), Drizzle ORM wired to a PostgreSQL connection string, a Dockerfile (`output: standalone`) that builds a deployable image, a trivial health route that pings the DB, and a GitHub Actions workflow that runs lint + test on every push. Deploy to Coolify and confirm green.

## Acceptance criteria

- [ ] `npm run dev` starts the Next.js dev server
- [ ] `npm run lint` passes with the two boundary rules active (domain fence, ui fence)
- [ ] `npm run build` produces a standalone Docker image that starts and serves a health route
- [ ] GitHub Actions workflow runs lint on push and passes
- [ ] Coolify deploys the image and the health route returns 200

## Blocked by

None — can start immediately.
