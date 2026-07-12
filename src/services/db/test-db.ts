import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";
import { migrationsFolder } from "./migrate";
import type { Db } from "./index";

// Integration-test database: a separate `padelclash_test` database on the same
// Postgres server as DATABASE_URL (the local compose db, or a CI service).
// Created on demand, migrated with the real migrations, truncated per test.

const TEST_DB_NAME = "padelclash_test";

export const hasDatabase = Boolean(process.env.DATABASE_URL);

let db: Db | undefined;
let pool: Pool | undefined;

export async function getTestDb(): Promise<Db> {
  if (db) return db;
  const baseUrl = new URL(process.env.DATABASE_URL!);

  const adminUrl = new URL(baseUrl.toString());
  adminUrl.pathname = "/postgres";
  const admin = new Pool({ connectionString: adminUrl.toString(), max: 1 });
  try {
    await admin.query(`CREATE DATABASE ${TEST_DB_NAME}`);
  } catch (err) {
    const duplicateDatabase = "42P04";
    if ((err as { code?: string }).code !== duplicateDatabase) throw err;
  } finally {
    await admin.end();
  }

  const testUrl = new URL(baseUrl.toString());
  testUrl.pathname = `/${TEST_DB_NAME}`;
  pool = new Pool({ connectionString: testUrl.toString() });
  db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: migrationsFolder() });
  return db;
}

export async function truncateAll(): Promise<void> {
  // Derived from the schema module so new tables are reset automatically.
  const tables: string[] = [];
  for (const value of Object.values(schema)) {
    if (is(value, PgTable)) tables.push(`"${getTableName(value)}"`);
  }
  await db?.execute(sql.raw(`TRUNCATE TABLE ${tables.join(", ")} CASCADE`));
}

export async function closeTestDb(): Promise<void> {
  await pool?.end();
  db = undefined;
  pool = undefined;
}
