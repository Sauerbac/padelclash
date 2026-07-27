/**
 * Next.js server-start boundary. `register` completes before the server begins
 * accepting requests, so application code cannot observe a pre-migration
 * schema or stale Rating projections.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // PostgreSQL and its Node driver must never enter an Edge bundle.
  const { runMigrations } = await import("./services/db/migrate");
  const { rebuildRatingProjections } = await import("./services/matches");
  const { getDb } = await import("./services/db");

  await runMigrations();

  // Projections are cache, the log is the truth (AGENTS.md), so a rebuild here
  // makes a Rating formula change deployable without a data migration — the
  // whole history is re-derived under whatever engine this build ships.
  // Fatal on failure: serving silently stale Ratings is worse than not booting.
  try {
    await rebuildRatingProjections(getDb());
    console.log("Rating projections rebuilt");
  } catch (err) {
    console.error("Fatal: Rating projection rebuild failed at boot:", err);
    process.exit(1);
  }
}
