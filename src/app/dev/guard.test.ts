import { beforeEach, describe, expect, it, vi } from "vitest";

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  }),
);

vi.mock("next/navigation", () => ({ notFound }));

const { requireDevEnvironment } = await import("./guard");

describe("requireDevEnvironment", () => {
  beforeEach(() => {
    notFound.mockClear();
    vi.unstubAllEnvs();
  });

  it("404s in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => requireDevEnvironment()).toThrow(/404/);
    expect(notFound).toHaveBeenCalled();
  });

  it("renders in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => requireDevEnvironment()).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("renders under test, so gallery fixtures stay unit-testable", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(() => requireDevEnvironment()).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });
});
