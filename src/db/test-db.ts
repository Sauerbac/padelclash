// Test-only support for the Tier-3 integration band (ADR-0008 / ADR-0012).
//
// Boots a real Postgres connection against the `padelclash_test` database on the
// local compose instance — a sibling of the dev `padelclash` DB, so tests never
// touch dev data. Imported only by *.integration.test.ts; never by app code.
//
// "Real Postgres, not a fake" is the whole point (ADR-0012): replay correctness
// rests on `numeric`, `jsonb`, and transaction semantics behaving exactly as in
// prod, which SQLite or an in-memory store would not.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

const MIGRATIONS_FOLDER = "src/db/migrations";

/** Derive the test DB url + a maintenance url (for `CREATE DATABASE`). */
function resolveUrls(): { url: string; maintenanceUrl: string; dbName: string } {
  // An explicit TEST_DATABASE_URL wins (CI); otherwise derive from the dev
  // DATABASE_URL by swapping the database name, defaulting to the compose url.
  const base =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/padelclash";

  const url = new URL(base);
  if (!process.env.TEST_DATABASE_URL) {
    url.pathname = "/padelclash_test";
  }
  const dbName = url.pathname.slice(1);

  const maintenance = new URL(url.toString());
  maintenance.pathname = "/postgres";

  return { url: url.toString(), maintenanceUrl: maintenance.toString(), dbName };
}

export interface TestDb {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sql: ReturnType<typeof postgres>;
  /** TRUNCATE every domain table — call between tests for a clean slate. */
  reset: () => Promise<void>;
  /** Close the pool. Call in afterAll. */
  close: () => Promise<void>;
}

/**
 * Ensure the test database exists, migrate it to the current schema, and return
 * a connected Drizzle client. Idempotent: safe to call once per test file.
 */
export async function setupTestDb(): Promise<TestDb> {
  const { url, maintenanceUrl, dbName } = resolveUrls();

  // 1. Create the database if it isn't there yet (CREATE DATABASE can't run in a
  //    transaction, so it goes through a one-shot maintenance connection).
  const admin = postgres(maintenanceUrl, { max: 1 });
  try {
    const existing = await admin`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;
    if (existing.length === 0) {
      await admin.unsafe(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }

  // 2. Connect and bring the schema up to date (drizzle migrate is idempotent).
  //    Silence NOTICEs — the reset TRUNCATE … CASCADE is deliberately broad.
  const sql = postgres(url, { max: 5, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  const reset = async () => {
    await sql.unsafe(
      `TRUNCATE TABLE rating_history, current_rating, match_participant,
       match, membership, "group", player RESTART IDENTITY CASCADE`,
    );
  };

  return { db, sql, reset, close: () => sql.end() };
}
