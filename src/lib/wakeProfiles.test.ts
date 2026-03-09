import { describe, expect, it } from "vitest";

import {
  MAX_PROFILES,
  createWakeProfileService,
  type WakeSessionProfile,
} from "./wakeProfiles";

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

describe("wakeProfiles service", () => {
  it("initializes with one default profile", () => {
    const storage = new MemoryStorage();
    const service = createWakeProfileService({
      storage,
      storageKey: "test:profiles:init",
      now: () => 1,
      idFactory: () => "profile-1",
    });

    const profiles = service.listProfiles();

    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({
      id: "profile-1",
      isDefault: true,
      mode: "timer",
      durationMinutes: 30,
    });
  });

  it("supports create/update/delete/default workflows", () => {
    const storage = new MemoryStorage();
    let idCounter = 0;

    const service = createWakeProfileService({
      storage,
      storageKey: "test:profiles:crud",
      now: () => Date.now(),
      idFactory: () => `profile-${++idCounter}`,
    });

    const baseProfiles = service.listProfiles();
    const starter = baseProfiles[0] as WakeSessionProfile;

    const created = service.createProfile({
      name: "Overnight",
      mode: "timer",
      durationMinutes: 180,
    });

    expect(service.listProfiles().some((profile) => profile.id === created.id)).toBe(true);

    service.updateProfile(created.id, {
      name: "Overnight Render",
      mode: "indefinite",
      durationMinutes: null,
    });

    const updated = service
      .listProfiles()
      .find((profile) => profile.id === created.id)!;
    expect(updated).toMatchObject({
      name: "Overnight Render",
      mode: "indefinite",
      durationMinutes: null,
    });

    service.setDefaultProfile(created.id);
    const defaultProfile = service.listProfiles().find((profile) => profile.isDefault)!;
    expect(defaultProfile.id).toBe(created.id);

    service.deleteProfile(created.id);
    const remaining = service.listProfiles();
    expect(remaining.some((profile) => profile.id === created.id)).toBe(false);
    expect(remaining.some((profile) => profile.id === starter.id)).toBe(true);
    expect(remaining.some((profile) => profile.isDefault)).toBe(true);
  });

  it("enforces max profile count", () => {
    const storage = new MemoryStorage();
    let idCounter = 0;

    const service = createWakeProfileService({
      storage,
      storageKey: "test:profiles:max",
      idFactory: () => `p-${++idCounter}`,
      now: () => idCounter,
    });

    // One starter profile already exists.
    for (let i = 0; i < MAX_PROFILES - 1; i += 1) {
      service.createProfile({
        name: `Profile ${i}`,
        mode: "timer",
        durationMinutes: 30,
      });
    }

    expect(() =>
      service.createProfile({
        name: "Overflow",
        mode: "timer",
        durationMinutes: 30,
      }),
    ).toThrow(`You can store up to ${MAX_PROFILES} profiles.`);
  });

  it("validates timer profile durations", () => {
    const storage = new MemoryStorage();
    const service = createWakeProfileService({
      storage,
      storageKey: "test:profiles:validate",
      idFactory: () => "p-1",
      now: () => 1,
    });

    expect(() =>
      service.createProfile({
        name: "Bad timer",
        mode: "timer",
        durationMinutes: 0,
      }),
    ).toThrow("Timer profiles require duration between 1 and 1440 minutes.");
  });
});
