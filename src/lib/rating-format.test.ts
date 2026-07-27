import { describe, expect, it } from "vitest";
import { formatRatingDelta } from "./rating-format";

describe("formatRatingDelta", () => {
  it("formats exact positive and negative integer deltas", () => {
    expect(formatRatingDelta(112)).toBe("+112");
    expect(formatRatingDelta(-70)).toBe("−70");
  });
});
