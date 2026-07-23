import { describe, expect, it } from "vitest";
import { invitationDestination } from "./invitation-entry";

const TOKEN = "Abcdefghijklmnopqrstuvwxyz0123456789_-ABCDE";

describe("invitationDestination", () => {
  it("accepts the existing raw 256-bit invitation token", () => {
    expect(invitationDestination(TOKEN, "https://padel.example")).toEqual({
      ok: true,
      href: `/join/${TOKEN}`,
    });
  });

  it("accepts a full invitation URL from this installation's origin", () => {
    expect(
      invitationDestination(
        `  https://padel.example/join/${TOKEN}  `,
        "https://padel.example",
      ),
    ).toEqual({ ok: true, href: `/join/${TOKEN}` });
  });

  it.each([
    ["", "Paste the full invite link or invitation token."],
    [
      "https://outside.example/join/Abcdefghijklmnopqrstuvwxyz0123456789_-ABCDE",
      "That invite belongs to a different site.",
    ],
    [
      "https://padel.example/admin",
      "Paste a PadelClash invite link ending in /join/…",
    ],
    ["short-code", "That invitation token doesn't look complete."],
  ])("keeps malformed or foreign input local: %s", (input, message) => {
    expect(invitationDestination(input, "https://padel.example")).toEqual({
      ok: false,
      message,
    });
  });
});
