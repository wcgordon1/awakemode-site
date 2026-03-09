import { describe, expect, it } from "vitest";

import { detectBrowserName, detectWakeClientInfo } from "./clientInfo";

describe("clientInfo", () => {
  it("detects Chromium-family browsers from userAgentData brands", () => {
    expect(
      detectBrowserName("", [
        { brand: "Chromium", version: "122" },
        { brand: "Google Chrome", version: "122" },
      ]),
    ).toBe("Chrome");

    expect(
      detectBrowserName("", [
        { brand: "Chromium", version: "122" },
        { brand: "Microsoft Edge", version: "122" },
      ]),
    ).toBe("Edge");

    expect(detectBrowserName("", [{ brand: "Chromium", version: "122" }])).toBe("Chromium");
  });

  it("falls back to Safari and Firefox user agent parsing", () => {
    expect(
      detectBrowserName(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
      ),
    ).toBe("Safari");

    expect(
      detectBrowserName(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.3; rv:123.0) Gecko/20100101 Firefox/123.0",
      ),
    ).toBe("Firefox");
  });

  it("returns unknown browser for empty or unsupported agents", () => {
    expect(detectBrowserName("")).toBe("Unknown browser");
    expect(detectBrowserName("SomeCustomAgent/1.0")).toBe("Unknown browser");
  });

  it("detects machine label from platform and user agent", () => {
    expect(
      detectWakeClientInfo({
        platform: "MacIntel",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
      }),
    ).toMatchObject({
      browser: "Chrome",
      machine: "Mac",
      machineKey: "mac",
    });

    expect(
      detectWakeClientInfo({
        platform: "Win32",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
      }),
    ).toMatchObject({
      browser: "Chrome",
      machine: "Windows",
      machineKey: "windows",
    });

    expect(detectWakeClientInfo({ platform: "Linux x86_64", userAgent: "" })).toMatchObject({
      browser: "Unknown browser",
      machine: "Other",
      machineKey: "other",
    });
  });
});
