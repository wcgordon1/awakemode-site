import type { WakePlatform } from "./wakeSession";

export interface UserAgentBrand {
  brand: string;
  version?: string;
}

export interface DetectWakeClientInfoInput {
  userAgent?: string | null;
  platform?: string | null;
  userAgentDataBrands?: UserAgentBrand[] | null;
}

export interface WakeClientInfo {
  browser: string;
  machine: "Mac" | "Windows" | "Other";
  machineKey: WakePlatform;
}

function detectMachine(platform = "", userAgent = ""): WakePlatform {
  const combined = `${platform} ${userAgent}`.toLowerCase();

  if (combined.includes("mac")) {
    return "mac";
  }

  if (combined.includes("win")) {
    return "windows";
  }

  return "other";
}

function detectFromBrands(brands: UserAgentBrand[] | null | undefined): string | null {
  if (!brands || brands.length === 0) {
    return null;
  }

  const normalized = brands.map((entry) => entry.brand.toLowerCase());

  if (normalized.some((brand) => brand.includes("microsoft edge"))) {
    return "Edge";
  }

  if (normalized.some((brand) => brand.includes("brave"))) {
    return "Brave";
  }

  if (normalized.some((brand) => brand.includes("opera"))) {
    return "Opera";
  }

  if (normalized.some((brand) => brand.includes("arc"))) {
    return "Arc";
  }

  if (normalized.some((brand) => brand.includes("google chrome"))) {
    return "Chrome";
  }

  if (normalized.some((brand) => brand.includes("chromium"))) {
    return "Chromium";
  }

  return null;
}

export function detectBrowserName(
  userAgent?: string | null,
  brands?: UserAgentBrand[] | null,
): string {
  const fromBrands = detectFromBrands(brands);
  if (fromBrands) {
    return fromBrands;
  }

  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) {
    return "Unknown browser";
  }

  if (ua.includes("edg/")) {
    return "Edge";
  }

  if (ua.includes("brave/")) {
    return "Brave";
  }

  if (ua.includes("opr/") || ua.includes("opera")) {
    return "Opera";
  }

  if (ua.includes("arc/")) {
    return "Arc";
  }

  if (ua.includes("firefox/")) {
    return "Firefox";
  }

  if (
    ua.includes("safari/") &&
    !ua.includes("chrome/") &&
    !ua.includes("crios/") &&
    !ua.includes("chromium/") &&
    !ua.includes("edg/") &&
    !ua.includes("opr/")
  ) {
    return "Safari";
  }

  if (ua.includes("chrome/") || ua.includes("crios/")) {
    return "Chrome";
  }

  if (ua.includes("chromium/")) {
    return "Chromium";
  }

  return "Unknown browser";
}

export function detectWakeClientInfo(
  input: DetectWakeClientInfoInput = {},
): WakeClientInfo {
  const machineKey = detectMachine(input.platform ?? "", input.userAgent ?? "");

  return {
    browser: detectBrowserName(input.userAgent, input.userAgentDataBrands),
    machine:
      machineKey === "mac" ? "Mac" : machineKey === "windows" ? "Windows" : "Other",
    machineKey,
  };
}
