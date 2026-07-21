import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { hasDatabase } from "./test-db";
import { migrationsFolder } from "./migrate";

/**
 * The secure cutover of spec decision 55, exercised the only way that proves
 * anything: seed a database at the *old* schema, then run the real migrations
 * over it.
 *
 * The ordinary test database is migrated from empty, so it can never catch a
 * backfill that fails on existing rows or a collision the new uniqueness rule
 * creates retroactively. This suite migrates in two stages to put legacy data
 * in between.
 */

// Its own database: this one is deliberately mid-migration for part of its life.
const DB_NAME = `padelclash_migration_${process.env.VITEST_POOL_ID ?? "0"}`;

type AnyDb = NodePgDatabase<Record<string, never>>;

let pool: Pool | undefined;
let db: AnyDb;

/**
 * Runs only the migrations up to and including `through`, by pointing the
 * migrator at a temporary folder holding that prefix of the journal.
 */
async function migrateThrough(through: string): Promise<void> {
  const source = migrationsFolder();
  const journal = JSON.parse(
    fs.readFileSync(path.join(source, "meta", "_journal.json"), "utf8"),
  ) as { entries: { tag: string }[] };

  const keep = journal.entries.slice(
    0,
    journal.entries.findIndex((e) => e.tag === through) + 1,
  );
  const staged = fs.mkdtempSync(path.join(os.tmpdir(), "pc-migrations-"));
  fs.mkdirSync(path.join(staged, "meta"));
  fs.writeFileSync(
    path.join(staged, "meta", "_journal.json"),
    JSON.stringify({ ...journal, entries: keep }),
  );
  for (const entry of keep) {
    fs.copyFileSync(
      path.join(source, `${entry.tag}.sql`),
      path.join(staged, `${entry.tag}.sql`),
    );
  }

  await migrate(db, { migrationsFolder: staged });
  fs.rmSync(staged, { recursive: true, force: true });
}

beforeAll(async () => {
  if (!hasDatabase) return;

  const baseUrl = new URL(process.env.DATABASE_URL!);
  const adminUrl = new URL(baseUrl.toString());
  adminUrl.pathname = "/postgres";
  const admin = new Pool({ connectionString: adminUrl.toString(), max: 1 });
  try {
    // Always from scratch: a half-migrated leftover would make this lie.
    await admin.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
    await admin.query(`CREATE DATABASE ${DB_NAME}`);
  } finally {
    await admin.end();
  }

  const testUrl = new URL(baseUrl.toString());
  testUrl.pathname = `/${DB_NAME}`;
  pool = new Pool({ connectionString: testUrl.toString() });
  db = drizzle(pool);

  // Stage 1: the schema as it stood before this slice.
  await migrateThrough("0002_matches_projections");
});

afterAll(async () => {
  await pool?.end();
});

describe.skipIf(!hasDatabase)("secure onboarding migration", () => {
  it("migrates legacy players, resolving names that now collide", async () => {
    // Legacy rows: convenience-grade personal tokens, and three names that
    // were distinct under the old rules but fold together under decision 30.
    // The fourth is "Si<U+202E>mon": a right-to-left override, invisible in a
    // roster row. The runtime strips every Cf character, so the migration has
    // to as well — otherwise this row keeps a key the app would never produce
    // and quietly coexists with the real Simon.
    // chr(8238), not a U&'...' literal: this is a JS template string, where
    // "\202E" is an invalid escape and silently mangles what drizzle sends.
    await db.execute(sql`
      insert into players (name, personal_token, created_at) values
        ('Simon',   'tok-simon',   '2026-01-01T10:00:00Z'),
        ('simon',   'tok-simon-2', '2026-01-02T10:00:00Z'),
        ('  SIMON ','tok-simon-3', '2026-01-03T10:00:00Z'),
        ('Si' || chr(8238) || 'mon', 'tok-simon-4', '2026-01-04T10:00:00Z'),
        ('Alex',    'tok-alex',    '2026-01-05T10:00:00Z')
    `);
    await db.execute(sql`insert into settings (id) values ('singleton')`);

    // Stage 2: everything this slice adds, over that data.
    await migrateThrough("0004_secure_onboarding_cutover");

    const { rows } = (await db.execute(sql`
      select name, normalized_name from players order by created_at
    `)) as unknown as {
      rows: { name: string; normalized_name: string }[];
    };

    // Display names are cleaned the same way domain/player-name.ts cleans
    // them — casing kept, stray whitespace not. The earliest row keeps its
    // name; later collisions get a visible suffix on both the display name and
    // the key, so Admin can see exactly what needs a real rename.
    expect(rows).toEqual([
      { name: "Simon", normalized_name: "simon" },
      { name: "simon (2)", normalized_name: "simon (2)" },
      { name: "SIMON (3)", normalized_name: "simon (3)" },
      // The bidi override is gone, so this collides like any other "Simon"
      // instead of sneaking through as a distinct key.
      { name: "Simon (4)", normalized_name: "simon (4)" },
      { name: "Alex", normalized_name: "alex" },
    ]);
  });

  it("leaves every player not joined, with no invitations", async () => {
    // Spec decision 55: no legacy cookie or link upgrades into a binding, and
    // no General Link is conjured up by the migration.
    const bindings = (await db.execute(
      sql`select count(*)::int as count from device_bindings`,
    )) as unknown as { rows: { count: number }[] };
    const invitations = (await db.execute(
      sql`select count(*)::int as count from onboarding_invitations`,
    )) as unknown as { rows: { count: number }[] };

    expect(bindings.rows[0].count).toBe(0);
    expect(invitations.rows[0].count).toBe(0);
  });

  it("drops the reusable personal token and the name-picker setting", async () => {
    const { rows } = (await db.execute(sql`
      select table_name, column_name
        from information_schema.columns
       where table_schema = 'public'
         and (column_name = 'personal_token' or table_name = 'settings')
    `)) as unknown as { rows: unknown[] };

    // The old reusable join links can't work if the column they lived in is
    // gone — that is what makes the cutover a cutover.
    expect(rows).toEqual([]);
  });

  it("enforces the new uniqueness rule on the migrated data", async () => {
    await expect(
      db.execute(
        sql`insert into players (name, normalized_name) values ('ALEX', 'alex')`,
      ),
    ).rejects.toThrow();
  });
});
