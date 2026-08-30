import { getDb } from "./services/db";
import { runMigrations } from "./services/db/migrate";
import { rebuildRatingProjections } from "./services/matches";

/** Node-only startup work, conditionally loaded by `instrumentation.ts`. */
export async function registerNodeServer(): Promise<void> {
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
