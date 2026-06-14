// Pure tier (ADR-0008): the EmailSender selection is the ADR-0012 seam, so it
// gets a fast, DB-free test. No real mail, no Resend key, no process.env.

import { describe, expect, it, vi } from "vitest";
import {
  ConsoleEmailSender,
  ResendEmailSender,
  selectEmailSender,
} from "./index";

describe("selectEmailSender", () => {
  it("picks the console stub when no Resend key is present", () => {
    const sender = selectEmailSender({ emailFrom: "x@y.z" });
    expect(sender).toBeInstanceOf(ConsoleEmailSender);
  });

  it("picks Resend when a key is present", () => {
    const sender = selectEmailSender({
      resendApiKey: "re_test_key",
      emailFrom: "x@y.z",
    });
    expect(sender).toBeInstanceOf(ResendEmailSender);
  });
});

describe("ConsoleEmailSender", () => {
  it("logs the message (including the link in text) instead of sending", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await new ConsoleEmailSender().send({
        to: "ada@example.com",
        subject: "Verify your email",
        text: "Follow: https://example.com/verify?token=abc123",
      });
      const logged = spy.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(logged).toContain("ada@example.com");
      expect(logged).toContain("https://example.com/verify?token=abc123");
    } finally {
      spy.mockRestore();
    }
  });
});
