/**
 * Next.js server-start boundary. `register` completes before the server begins
 * accepting requests, so application code cannot observe a pre-migration
 * schema or stale Rating projections.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // PostgreSQL and its Node driver must never enter an Edge bundle.
  const { runMigrations } = await import("./services/db/migrate");
  await runMigrations();
}
