import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./services/db/migrate", () => ({
  runMigrations: vi.fn(),
}));
vi.mock("./services/db", () => ({
  getDb: vi.fn(() => ({}) as never),
}));
vi.mock("./services/matches", () => ({
  rebuildRatingProjections: vi.fn(),
}));

import { register } from "./instrumentation";
import { runMigrations } from "./services/db/migrate";
import { rebuildRatingProjections } from "./services/matches";

describe("Next server startup", () => {
  beforeEach(() => {
    vi.mocked(runMigrations).mockReset();
    vi.mocked(rebuildRatingProjections).mockReset();
  });

  it("runs database migration and replay before a Node server becomes ready", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    await register();

    expect(runMigrations).toHaveBeenCalledOnce();
    expect(rebuildRatingProjections).toHaveBeenCalledOnce();
  });

  it("replays Ratings only after the schema is migrated", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const order: string[] = [];
    vi.mocked(runMigrations).mockImplementation(async () => {
      order.push("migrate");
    });
    vi.mocked(rebuildRatingProjections).mockImplementation(async () => {
      order.push("replay");
    });

    await register();

    // The replay reads through the current Drizzle schema, so a rebuild ahead
    // of the migration would query columns that do not exist yet.
    expect(order).toEqual(["migrate", "replay"]);
  });

  it("refuses to serve when the Rating replay fails", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.mocked(rebuildRatingProjections).mockRejectedValue(
      new Error("replay exploded"),
    );
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await register();

    // Stale projections mean silently wrong Ratings on every surface, which is
    // worse than a container that will not start.
    expect(exit).toHaveBeenCalledWith(1);
    exit.mockRestore();
    error.mockRestore();
  });

  it("does not load PostgreSQL migration code in the Edge runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");

    await register();

    expect(runMigrations).not.toHaveBeenCalled();
    expect(rebuildRatingProjections).not.toHaveBeenCalled();
  });
});
