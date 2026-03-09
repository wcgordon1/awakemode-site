import { describe, expect, it } from "vitest";

import { createWakeUiPreferenceService } from "./wakeUiPreferences";

class MemoryStorage {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

class ThrowingStorage {
  getItem(): string | null {
    throw new Error("read blocked");
  }

  setItem(): void {
    throw new Error("write blocked");
  }

  removeItem(): void {
    throw new Error("remove blocked");
  }
}

describe("wakeUiPreferences", () => {
  it("returns defaults when preferences are missing", () => {
    const service = createWakeUiPreferenceService({
      storage: new MemoryStorage(),
      defaultCustomMinutes: 30,
    });

    expect(service.read()).toEqual({
      settingsOpen: false,
      mode: "indefinite",
      customMinutes: 30,
    });
  });

  it("reads valid persisted preferences", () => {
    const storage = new MemoryStorage();
    storage.setItem("awakemode:ui:settings-open", "true");
    storage.setItem("awakemode:ui:mode", "timer");
    storage.setItem("awakemode:ui:custom-minutes", "90");

    const service = createWakeUiPreferenceService({ storage });

    expect(service.read()).toEqual({
      settingsOpen: true,
      mode: "timer",
      customMinutes: 90,
    });
  });

  it("falls back to defaults for invalid persisted values", () => {
    const storage = new MemoryStorage();
    storage.setItem("awakemode:ui:settings-open", "yes");
    storage.setItem("awakemode:ui:mode", "snooze");
    storage.setItem("awakemode:ui:custom-minutes", "2001");

    const service = createWakeUiPreferenceService({
      storage,
      defaultMode: "indefinite",
      defaultCustomMinutes: 45,
    });

    expect(service.read()).toEqual({
      settingsOpen: false,
      mode: "indefinite",
      customMinutes: 45,
    });
  });

  it("writes partial updates and keeps valid existing state", () => {
    const storage = new MemoryStorage();
    const service = createWakeUiPreferenceService({ storage });

    service.write({ mode: "timer", customMinutes: 120 });
    const updated = service.write({ settingsOpen: true, customMinutes: 0 });

    expect(updated).toEqual({
      settingsOpen: true,
      mode: "timer",
      customMinutes: 120,
    });
    expect(storage.getItem("awakemode:ui:settings-open")).toBe("true");
    expect(storage.getItem("awakemode:ui:mode")).toBe("timer");
    expect(storage.getItem("awakemode:ui:custom-minutes")).toBe("120");
  });

  it("gracefully handles storage read/write failures", () => {
    const service = createWakeUiPreferenceService({
      storage: new ThrowingStorage(),
      defaultCustomMinutes: 30,
    });

    expect(service.read()).toEqual({
      settingsOpen: false,
      mode: "indefinite",
      customMinutes: 30,
    });

    expect(() => service.write({ mode: "timer", customMinutes: 25 })).not.toThrow();
  });
});
