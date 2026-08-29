import { describe, expect, it } from "vitest";
import { isPrivatePageCache } from "./private-cache";

describe("revocation cache cleanup", () => {
  it("removes legacy private-page caches without deleting the public offline shell", () => {
    expect(isPrivatePageCache("padelclash-pages-v1")).toBe(true);
    expect(isPrivatePageCache("padelclash-navigation-build-abc")).toBe(true);
    expect(isPrivatePageCache("padelclash-shell-build-abc")).toBe(false);
    expect(isPrivatePageCache("unrelated-cache")).toBe(false);
  });
});
