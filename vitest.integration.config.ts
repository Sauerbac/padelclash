import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tier-3 integration tests (ADR-0008): the narrow band that runs against a real
// Postgres — the `padelclash_test` database on the local compose instance
// (ADR-0012). Kept out of the pure commit gate (vitest.config.ts) because it
// needs Docker. Run with `npm run test:integration`.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.{ts,tsx}"],
    // One shared database: don't run integration files in parallel against it.
    fileParallelism: false,
    // Migrating a fresh test DB can take a moment on first run.
    hookTimeout: 60_000,
  },
});
