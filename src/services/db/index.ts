import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

// Lazy singleton: `next build` imports route modules with no DATABASE_URL set
// (e.g. in the Docker build stage), so nothing may connect or throw at import
// time. Cached on globalThis because `next dev` re-evaluates modules on hot
// reload and would otherwise leak pools.
const globalForDb = globalThis as unknown as { db?: Db };

export function getDb(): Db {
  if (globalForDb.db) return globalForDb.db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const pool = new Pool({ connectionString });
  // Without a listener, an idle client dying (e.g. Postgres restart) emits an
  // unhandled 'error' event and kills the whole server process.
  pool.on("error", (err) => {
    console.error("Unexpected error on idle database client:", err);
  });
  globalForDb.db = drizzle(pool, { schema });
  return globalForDb.db;
}
