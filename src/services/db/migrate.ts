import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "./index";

// Boot-time migration runner (called from src/instrumentation.ts). The
// `drizzle/` folder sits next to the server: the repo root in dev, copied into
// the image next to server.js in the standalone Docker build.
export async function runMigrations(): Promise<void> {
  try {
    await migrate(getDb(), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    console.log("Database migrations applied");
  } catch (err) {
    // The standalone server logs a failed register() but keeps serving; exit
    // explicitly so a bad DATABASE_URL or failed migration can't serve traffic.
    console.error("Fatal: database migration failed at boot:", err);
    process.exit(1);
  }
}
