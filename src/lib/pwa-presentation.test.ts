import { describe, expect, it } from "vitest";
import { shouldShowIosBrowserGuidance } from "./pwa-presentation";

describe("shouldShowIosBrowserGuidance", () => {
  it("shows guidance for iOS outside standalone display mode", () => {
    expect(
      shouldShowIosBrowserGuidance({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1",
        platform: "iPhone",
        maxTouchPoints: 5,
        standalone: false,
      }),
    ).toBe(true);
  });

  it("also shows guidance in a non-Safari iOS browser", () => {
    expect(
      shouldShowIosBrowserGuidance({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 CriOS/138.0.0.0 Mobile/15E148 Safari/604.1",
        platform: "iPhone",
        maxTouchPoints: 5,
        standalone: false,
      }),
    ).toBe(true);
  });

  it("does not show browser recovery guidance in an installed iOS PWA", () => {
    expect(
      shouldShowIosBrowserGuidance({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        platform: "iPhone",
        maxTouchPoints: 5,
        standalone: true,
      }),
    ).toBe(false);
  });

  it("recognizes iPadOS desktop-class user agents", () => {
    expect(
      shouldShowIosBrowserGuidance({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.5 Safari/605.1.15",
        platform: "MacIntel",
        maxTouchPoints: 5,
        standalone: false,
      }),
    ).toBe(true);
  });

  it("does not show uninstall guidance in an Android browser", () => {
    expect(
      shouldShowIosBrowserGuidance({
        userAgent:
          "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/138.0.0.0 Mobile Safari/537.36",
        platform: "Linux armv8l",
        maxTouchPoints: 5,
        standalone: false,
      }),
    ).toBe(false);
  });
});

