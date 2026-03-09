import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createWakeSessionEngine,
  formatDurationMs,
  normalizeCustomMinutes,
  type WakeSessionEnvironment,
  type WakeStorage,
} from "./wakeSession";

class MemoryStorage implements WakeStorage {
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

type MockWakeLock = {
  release: ReturnType<typeof vi.fn>;
  onRelease: (listener: () => void) => void;
  triggerRelease: () => void;
};

function createMockWakeLock(): MockWakeLock {
  let releaseListener: (() => void) | null = null;

  return {
    release: vi.fn(async () => {
      releaseListener?.();
    }),
    onRelease(listener: () => void) {
      releaseListener = listener;
    },
    triggerRelease() {
      releaseListener?.();
    },
  };
}

function createEnvironment(options?: {
  support?: boolean;
  platform?: string;
  storage?: WakeStorage;
  requestWakeLock?: ReturnType<typeof vi.fn>;
}) {
  const support = options?.support ?? true;
  const platform = options?.platform ?? "MacIntel";
  const storage = options?.storage ?? new MemoryStorage();
  const requestWakeLock =
    options?.requestWakeLock ?? vi.fn(async () => createMockWakeLock());

  let visible = true;
  const visibilityListeners = new Set<() => void>();

  const environment: WakeSessionEnvironment = {
    hasWakeLockSupport() {
      return support;
    },
    requestWakeLock,
    now() {
      return Date.now();
    },
    setInterval(callback, ms) {
      return setInterval(callback, ms);
    },
    clearInterval(handle) {
      clearInterval(handle as ReturnType<typeof setInterval>);
    },
    setTimeout(callback, ms) {
      return setTimeout(callback, ms);
    },
    clearTimeout(handle) {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
    addVisibilityListener(callback) {
      visibilityListeners.add(callback);
      return () => visibilityListeners.delete(callback);
    },
    isVisible() {
      return visible;
    },
    storage() {
      return storage;
    },
    platform() {
      return platform;
    },
  };

  return {
    environment,
    storage,
    requestWakeLock,
    setVisible(nextVisible: boolean) {
      visible = nextVisible;
    },
    emitVisibilityChange() {
      visibilityListeners.forEach((listener) => listener());
    },
  };
}

describe("wakeSession engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts and stops an indefinite session", async () => {
    const lock = createMockWakeLock();
    const requestWakeLock = vi.fn(async () => lock);
    const { environment } = createEnvironment({ requestWakeLock });

    const engine = createWakeSessionEngine({
      environment,
      storageKey: "test:indefinite",
    });

    await engine.start("indefinite");

    expect(requestWakeLock).toHaveBeenCalledTimes(1);
    expect(engine.getState()).toMatchObject({
      intent: true,
      hasActiveLock: true,
      mode: "indefinite",
      supportStatus: "supported",
    });

    await engine.stop();

    expect(lock.release).toHaveBeenCalledTimes(1);
    expect(engine.getState()).toMatchObject({
      intent: false,
      hasActiveLock: false,
      mode: "indefinite",
      supportStatus: "supported",
    });
  });

  it("emits lifecycle events in expected order", async () => {
    const lock = createMockWakeLock();
    const requestWakeLock = vi.fn(async () => lock);
    const { environment } = createEnvironment({ requestWakeLock });

    const engine = createWakeSessionEngine({
      environment,
      storageKey: "test:event-order",
    });

    const events: string[] = [];
    engine.subscribeEvents((event) => events.push(event.type));

    await engine.start("indefinite");
    await engine.stop();

    expect(events).toEqual(["started", "acquired", "stopped", "released"]);
  });

  it("expires timer sessions and emits timer_completed", async () => {
    const lock = createMockWakeLock();
    const requestWakeLock = vi.fn(async () => lock);
    const { environment } = createEnvironment({ requestWakeLock });

    const engine = createWakeSessionEngine({
      environment,
      storageKey: "test:timer-expiry",
    });

    const events: string[] = [];
    engine.subscribeEvents((event) => events.push(event.type));

    await engine.start("timer", 3_000);
    await vi.advanceTimersByTimeAsync(3_000);

    expect(engine.getState()).toMatchObject({
      intent: false,
      hasActiveLock: false,
      remainingMs: 0,
    });
    expect(events).toContain("timer_completed");
    expect(events).toContain("released");
  });

  it("restores persisted intent and reacquires lock on initialization", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "test:restore",
      JSON.stringify({ intent: true, mode: "indefinite", endAt: null }),
    );

    const lock = createMockWakeLock();
    const requestWakeLock = vi.fn(async () => lock);
    const { environment } = createEnvironment({ requestWakeLock, storage });

    const engine = createWakeSessionEngine({
      environment,
      storageKey: "test:restore",
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(requestWakeLock).toHaveBeenCalledTimes(1);
    expect(engine.getState()).toMatchObject({
      intent: true,
      hasActiveLock: true,
      mode: "indefinite",
    });
  });

  it("retries with backoff after unexpected release", async () => {
    const firstLock = createMockWakeLock();
    const requestWakeLock = vi
      .fn()
      .mockResolvedValueOnce(firstLock)
      .mockRejectedValue(new Error("NotAllowedError"));

    const { environment } = createEnvironment({ requestWakeLock });
    const engine = createWakeSessionEngine({
      environment,
      storageKey: "test:backoff",
    });

    await engine.start("indefinite");
    expect(requestWakeLock).toHaveBeenCalledTimes(1);

    firstLock.triggerRelease();

    await vi.advanceTimersByTimeAsync(499);
    expect(requestWakeLock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(requestWakeLock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(requestWakeLock).toHaveBeenCalledTimes(3);
  });

  it("supports explicit manual retry action", async () => {
    const recoveredLock = createMockWakeLock();
    const requestWakeLock = vi
      .fn()
      .mockRejectedValueOnce(new Error("NotAllowedError"))
      .mockResolvedValueOnce(recoveredLock);

    const { environment } = createEnvironment({ requestWakeLock });
    const engine = createWakeSessionEngine({
      environment,
      storageKey: "test:manual-retry",
    });

    const eventTypes: string[] = [];
    engine.subscribeEvents((event) => {
      eventTypes.push(event.type);
    });

    await engine.start("indefinite");
    expect(engine.getState().supportStatus).toBe("blocked");

    await engine.retry();
    expect(engine.getState().hasActiveLock).toBe(true);
    expect(eventTypes).toContain("reacquire_attempt");
    expect(eventTypes).toContain("reacquire_success");
  });

  it("marks unsupported browsers and refuses start", async () => {
    const { environment, requestWakeLock } = createEnvironment({ support: false });
    const engine = createWakeSessionEngine({
      environment,
      storageKey: "test:unsupported",
    });

    await engine.start("indefinite");

    expect(requestWakeLock).not.toHaveBeenCalled();
    expect(engine.getState()).toMatchObject({
      intent: false,
      hasActiveLock: false,
      supportStatus: "unsupported",
    });
  });
});

describe("wakeSession helpers", () => {
  it("normalizes custom minute values", () => {
    expect(normalizeCustomMinutes("45")).toBe(45);
    expect(normalizeCustomMinutes(5)).toBe(5);
    expect(normalizeCustomMinutes("0")).toBeNull();
    expect(normalizeCustomMinutes("2000")).toBeNull();
    expect(normalizeCustomMinutes("bad")).toBeNull();
  });

  it("formats duration text for countdown display", () => {
    expect(formatDurationMs(61_000)).toBe("1:01");
    expect(formatDurationMs(3_661_000)).toBe("1:01:01");
  });
});
