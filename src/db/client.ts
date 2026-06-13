import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let cached: Database | undefined;

/**
 * Lazily-initialised Drizzle client over a long-lived connection pool.
 *
 * A long-lived container on a strong server (ADR-0010) means a real pool with
 * no serverless cold-start concerns. Initialisation is deferred so `next build`
 * — which has no DATABASE_URL — never touches a connection.
 */
export function getDb(): Database {
  if (!cached) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    cached = drizzle(postgres(connectionString, { max: 10 }), { schema });
  }
  return cached;
}
