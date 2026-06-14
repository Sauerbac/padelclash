// Fail-loud server environment validation (slice 06).
//
// `.env.example` is the contract (ADR-0012): a handful of vars are *required* and
// the app must refuse to run without them, rather than failing obscurely deep in
// a request. This module is the one place that decision lives.
//
// Validation is LAZY, on first `serverEnv()` call — never at import. `next build`
// runs with no env (the Docker builder has no `.env`, see .dockerignore), and the
// db client defers its own check for the same reason (src/db/client.ts). Auth and
// email wiring call this only at request time, so the build never trips it.
//
// Optional, stub-degrading vars (RESEND_API_KEY, GOOGLE_*) are NOT validated here
// — their features fall back to dev-safe stubs when absent (ADR-0012). Only the
// genuinely required-to-boot vars are enforced.

const REQUIRED = ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"] as const;

export interface ServerEnv {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
}

let cached: ServerEnv | undefined;

/**
 * The validated set of required server env vars. Throws once, listing every
 * missing var, the first time it is called with any absent. Result is cached.
 */
export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const missing = REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Copy .env.example to .env (or see it for the contract).`,
    );
  }

  cached = {
    DATABASE_URL: process.env.DATABASE_URL!,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL!,
  };
  return cached;
}
