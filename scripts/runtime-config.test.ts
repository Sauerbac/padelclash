import { describe, expect, it } from "vitest";
import { validateRuntimeConfig } from "./runtime-config.mjs";

describe("production runtime configuration", () => {
  it("accepts a database URL and an admin password of at least 20 characters", () => {
    expect(() =>
      validateRuntimeConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:secret@db:5432/padelclash",
        ADMIN_PASSWORD: "01234567890123456789",
      }),
    ).not.toThrow();
  });

  it.each([undefined, "", "short-password"])(
    "rejects a missing or weak production admin password (%s)",
    (adminPassword) => {
      expect(() =>
        validateRuntimeConfig({
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://postgres:secret@db:5432/padelclash",
          ADMIN_PASSWORD: adminPassword,
        }),
      ).toThrow(/ADMIN_PASSWORD.*20/);
    },
  );

  it("rejects a missing production database URL", () => {
    expect(() =>
      validateRuntimeConfig({
        NODE_ENV: "production",
        ADMIN_PASSWORD: "01234567890123456789",
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it("keeps local development usable with a short password", () => {
    expect(() =>
      validateRuntimeConfig({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://localhost/padelclash",
        ADMIN_PASSWORD: "change-me",
      }),
    ).not.toThrow();
  });
});
