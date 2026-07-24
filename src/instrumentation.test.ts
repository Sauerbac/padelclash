import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./services/db/migrate", () => ({
  runMigrations: vi.fn(),
}));

import { register } from "./instrumentation";
import { runMigrations } from "./services/db/migrate";

describe("Next server startup", () => {
  beforeEach(() => {
    vi.mocked(runMigrations).mockReset();
  });

  it("runs database migration and replay before a Node server becomes ready", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    await register();

    expect(runMigrations).toHaveBeenCalledOnce();
  });

  it("does not load PostgreSQL migration code in the Edge runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");

    await register();

    expect(runMigrations).not.toHaveBeenCalled();
  });
});
