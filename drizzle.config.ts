import { defineConfig } from "drizzle-kit";

// Versioned migrations (generate + migrate), not push — see handoff/ADR-0010.
// Tables arrive in slice 02; this wires the toolchain now.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
