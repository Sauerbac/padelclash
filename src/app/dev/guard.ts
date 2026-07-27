import { notFound } from "next/navigation";

/**
 * The `/dev/*` gate (spec decision 126). The UI state gallery is a review
 * tool, not a feature: it ships in the same tree as the app, so it needs a
 * seam that cannot be switched on by accident in production.
 *
 * Verified against a real `npm run build` + standalone server: every `/dev`
 * path answers 404. What is *not* true — decision 126 claims it, and it was
 * measured to be wrong — is that the comparison dead-code-eliminates the
 * gallery away. Turbopack still prerenders the page and writes the fixtures
 * into `.next/server/app/dev/…` and a client chunk; the 404 comes from the
 * route's prerender metadata, not from the body having been dropped. The
 * fixtures are invented names, and nothing reachable references that chunk, so
 * this is inert weight rather than a leak — but do not repeat the elimination
 * claim as if it were a mechanism you can rely on.
 *
 * An opt-in env flag was rejected regardless: it would live in Coolify, outside
 * the repository, where nobody reviewing this file could see how it was set.
 *
 * `notFound()` throws, so callers do not need to return.
 */
export function requireDevEnvironment(): void {
  if (process.env.NODE_ENV === "production") notFound();
}
