import { describe, expect, it } from "vitest";
import { uuidv7 } from "./uuidv7";

describe("uuidv7", () => {
  it("produces RFC 9562 v7 ids", () => {
    const id = uuidv7();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("is unique across calls", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7()));
    expect(ids.size).toBe(1000);
  });

  it("sorts lexicographically by creation time", () => {
    // Timestamps a millisecond apart must order the ids — that is what makes
    // the id usable as the final replay tiebreaker.
    const earlier = uuidv7(1_700_000_000_000);
    const later = uuidv7(1_700_000_000_001);
    expect(earlier < later).toBe(true);
  });

  it("encodes the timestamp in the first 48 bits", () => {
    const at = 1_700_000_000_000;
    const id = uuidv7(at);
    const encoded = parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
    expect(encoded).toBe(at);
  });
});
