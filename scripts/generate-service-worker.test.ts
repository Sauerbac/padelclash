import { describe, expect, it } from "vitest";
import { renderServiceWorker } from "./generate-service-worker.mjs";

describe("generated service worker", () => {
  it("versions the shell from the Next build and never pre-caches private pages", () => {
    const source = renderServiceWorker("build-abc");

    expect(source).toContain('const VERSION = "build-abc"');
    expect(source).toContain('const OFFLINE_SHELL = "/offline"');
    expect(source).not.toContain('cache.add("/")');
    expect(source).not.toContain('addAll(["/"]');
    expect(source).toContain('pathname === "/" || pathname === "/log"');
    expect(source).toContain("/^\\/api\\//");
    expect(source).toContain("/^\\/admin/");
    expect(source).toContain("/^\\/join\\//");
  });

  it("bounds cold navigation at five seconds and falls back for every snapshot-capable tab", () => {
    const source = renderServiceWorker("build-abc");

    expect(source).toContain("const NAVIGATION_DEADLINE_MS = 5_000");
    expect(source).not.toContain("AbortController");
    expect(source).toContain('pathname === "/leaderboard"');
    expect(source).toContain("Promise.race([network, deadline])");
    expect(source).toContain('type: "navigation-ready"');
  });
});
