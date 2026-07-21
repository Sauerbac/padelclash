import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

// No database and no clock of its own — `now` is injected, so these stay in
// the fast pure-test tier.
const START = new Date("2026-07-21T12:00:00Z");
const at = (ms: number) => new Date(START.getTime() + ms);

describe("createRateLimiter", () => {
  it("allows up to the limit, then refuses", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000 });

    expect(limiter.check("a", START).allowed).toBe(true);
    expect(limiter.check("a", START).allowed).toBe(true);
    expect(limiter.check("a", START).allowed).toBe(true);
    expect(limiter.check("a", START).allowed).toBe(false);
  });

  it("keys are independent", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });

    expect(limiter.check("a", START).allowed).toBe(true);
    expect(limiter.check("a", START).allowed).toBe(false);
    expect(limiter.check("b", START).allowed).toBe(true);
  });

  it("frees a slot as each attempt leaves the window", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });

    limiter.check("a", START);
    limiter.check("a", at(400));
    expect(limiter.check("a", at(900)).allowed).toBe(false);

    // The first attempt has now aged out, but the second has not: one slot.
    expect(limiter.check("a", at(1001)).allowed).toBe(true);
    expect(limiter.check("a", at(1001)).allowed).toBe(false);
    expect(limiter.check("a", at(1401)).allowed).toBe(true);
  });

  it("reports how long until the next attempt could succeed", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });

    limiter.check("a", START);
    expect(limiter.check("a", at(300)).retryAfterMs).toBe(700);
    expect(limiter.check("a", START).retryAfterMs).toBe(1000);
  });

  it("a refused attempt doesn't extend the block", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });

    limiter.check("a", START);
    // Hammering while blocked must not keep pushing the window out, or a bot
    // would lock a shared IP out indefinitely.
    limiter.check("a", at(500));
    limiter.check("a", at(900));
    expect(limiter.check("a", at(1001)).allowed).toBe(true);
  });

  it("reset clears all state", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });

    limiter.check("a", START);
    limiter.reset();
    expect(limiter.check("a", START).allowed).toBe(true);
  });
});
