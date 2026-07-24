import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "./index";
import {
  ratingRolloutPreflight,
  rebuildRatingProjections,
} from "../matches";

// The `drizzle/` folder sits next to the server: the repo root in dev, copied
// into the image next to server.js in the standalone Docker build. Also used
// by the integration-test database (test-db.ts).
export function migrationsFolder(): string {
  return path.join(process.cwd(), "drizzle");
}

// Boot-time migration runner (called from src/instrumentation.ts).
export async function runMigrations(): Promise<void> {
  try {
    const db = getDb();
    await migrate(db, {
      migrationsFolder: migrationsFolder(),
    });
    const preflight = await ratingRolloutPreflight(db);
    await rebuildRatingProjections(db);
    console.log(
      `Database migrations applied; replayed ${preflight.matches} Matches (${preflight.scoredMatches} scored)`,
    );
  } catch (err) {
    // The standalone server logs a failed register() but keeps serving; exit
    // explicitly so a bad DATABASE_URL or failed migration can't serve traffic.
    console.error("Fatal: database migration failed at boot:", err);
    process.exit(1);
  }
}
