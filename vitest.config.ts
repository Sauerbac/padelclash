import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Pure tiers (ADR-0008): no DB, run in milliseconds, gate every commit.
    // The Tier-3 Postgres integration tests (*.integration.test.ts) are excluded
    // here and run separately via `npm run test:integration`.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: [...configDefaults.exclude, "**/*.integration.test.{ts,tsx}"],
  },
});
