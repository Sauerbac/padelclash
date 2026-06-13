// Apply versioned Drizzle migrations on container boot, before the server starts.
//
// Uses the runtime migrator (drizzle-orm + postgres, already production deps) so
// the slim image carries no drizzle-kit. Guarded: with no migrations folder yet
// (slice 01 has no schema), this is a clean no-op — and the ORM modules are
// imported lazily, *after* the guard, so a slice-01 image need not even ship
// them. The first real migrations arrive in slice 02.
import { existsSync, readdirSync } from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL is not set");
  process.exit(1);
}

const folder = "src/db/migrations";
if (!existsSync(folder) || readdirSync(folder).length === 0) {
  console.log("[migrate] no migrations to apply, skipping");
  process.exit(0);
}

const { drizzle } = await import("drizzle-orm/postgres-js");
const { migrate } = await import("drizzle-orm/postgres-js/migrator");
const { default: postgres } = await import("postgres");

const sql = postgres(url, { max: 1 });
try {
  await migrate(drizzle(sql), { migrationsFolder: folder });
  console.log("[migrate] migrations applied");
} finally {
  await sql.end();
}
