import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

/**
 * Liveness probe for the database. Lives in `services` because that is the only
 * layer permitted to touch `db` (module-structure.md); the route handler stays
 * thin and calls through here.
 */
export async function pingDb(): Promise<void> {
  await getDb().execute(sql`select 1`);
}
