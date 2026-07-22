import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { validateRuntimeConfig } from "./runtime-config.mjs";

validateRuntimeConfig(process.env);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("Database migrations applied");
} catch (error) {
  console.error("Fatal: database migration failed at boot:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
