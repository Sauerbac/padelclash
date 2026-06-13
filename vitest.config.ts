import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Pure tiers (ADR-0008): no DB, run in milliseconds, gate every commit.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
