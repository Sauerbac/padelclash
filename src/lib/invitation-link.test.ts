import { describe, expect, it } from "vitest";
import { absoluteInvitationUrl } from "./invitation-link";

describe("absoluteInvitationUrl", () => {
  it("builds the full same-site URL copied for an invitation", () => {
    expect(
      absoluteInvitationUrl(
        "/join/fresh-token",
        "https://padel.example",
      ),
    ).toBe("https://padel.example/join/fresh-token");
  });

  it("does not leave a double slash when the origin has a trailing slash", () => {
    expect(
      absoluteInvitationUrl("/join/fresh-token", "https://padel.example/"),
    ).toBe("https://padel.example/join/fresh-token");
  });
});
