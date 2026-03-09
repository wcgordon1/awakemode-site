export type WakeSupportStatus = "supported" | "unsupported" | "blocked";
export type WakeSessionMode = "indefinite" | "timer";
export type WakePlatform = "mac" | "windows" | "other";

export interface WakeSessionState {
  intent: boolean;
  hasActiveLock: boolean;
  mode: WakeSessionMode;
  remainingMs: number | null;
  lastError: string | null;
  platform: WakePlatform;
  supportStatus: WakeSupportStatus;
}

export interface WakeLockHandle {
  release(): Promise<void>;
  onRelease?(listener: () => void): void;
}

export interface WakeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface WakeSessionEnvironment {
  hasWakeLockSupport(): boolean;
  requestWakeLock(): Promise<WakeLockHandle>;
  now(): number;
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  addVisibilityListener(callback: () => void): () => void;
  isVisible(): boolean;
  storage(): WakeStorage;
  platform(): string;
}

export interface CreateWakeSessionEngineOptions {
  environment?: WakeSessionEnvironment;
  storageKey?: string;
}

export interface WakeSessionController {
  getState(): WakeSessionState;
  subscribe(listener: (state: WakeSessionState) => void): () => void;
  start(mode: WakeSessionMode, durationMs?: number): Promise<void>;
  stop(): Promise<void>;
  destroy(): Promise<void>;
}

interface PersistedSessionIntent {
  intent: boolean;
  mode: WakeSessionMode;
  endAt: number | null;
}

const DEFAULT_STORAGE_KEY = "awakemode:wake-session-intent";
export const PRESET_MINUTES = [15, 30, 60, 120] as const;

export function normalizeCustomMinutes(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const rounded = Math.floor(parsed);
  if (rounded < 1 || rounded > 1440) {
    return null;
  }

  return rounded;
}

export function formatDurationMs(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedMinutes = String(minutes).padStart(hours > 0 ? 2 : 1, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
}

export function detectPlatform(platformInput: string): WakePlatform {
  const normalized = platformInput.toLowerCase();

  if (normalized.includes("mac")) {
    return "mac";
  }

  if (normalized.includes("win")) {
    return "windows";
  }

  return "other";
}

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Wake lock request failed.";
}

function isValidDuration(durationMs: number | undefined): durationMs is number {
  return (
    typeof durationMs === "number" &&
    Number.isFinite(durationMs) &&
    durationMs > 0
  );
}

function createBrowserEnvironment(): WakeSessionEnvironment {
  return {
    hasWakeLockSupport() {
      if (typeof navigator === "undefined") {
        return false;
      }

      const nav = navigator as Navigator & {
        wakeLock?: {
          request(type: "screen"): Promise<{
            release(): Promise<void>;
            addEventListener?: (
              type: "release",
              listener: () => void,
            ) => void;
            onrelease?: (() => void) | null;
          }>;
        };
      };

      return typeof nav.wakeLock?.request === "function";
    },

    async requestWakeLock() {
      const nav = navigator as Navigator & {
        wakeLock?: {
          request(type: "screen"): Promise<{
            release(): Promise<void>;
            addEventListener?: (
              type: "release",
              listener: () => void,
            ) => void;
            onrelease?: (() => void) | null;
          }>;
        };
      };

      if (!nav.wakeLock?.request) {
        throw new Error("Wake lock is not supported in this browser.");
      }

      const sentinel = await nav.wakeLock.request("screen");

      return {
        release: () => sentinel.release(),
        onRelease(listener) {
          if (typeof sentinel.addEventListener === "function") {
            sentinel.addEventListener("release", listener);
            return;
          }

          sentinel.onrelease = listener;
        },
      } satisfies WakeLockHandle;
    },

    now() {
      return Date.now();
    },

    setInterval(callback, ms) {
      return globalThis.setInterval(callback, ms);
    },

    clearInterval(handle) {
      globalThis.clearInterval(handle as ReturnType<typeof globalThis.setInterval>);
    },

    addVisibilityListener(callback) {
      if (typeof document === "undefined") {
        return () => undefined;
      }

      document.addEventListener("visibilitychange", callback);
      return () => document.removeEventListener("visibilitychange", callback);
    },

    isVisible() {
      if (typeof document === "undefined") {
        return true;
      }

      return document.visibilityState === "visible";
    },

    storage() {
      if (typeof window === "undefined") {
        return {
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined,
        } satisfies WakeStorage;
      }

      return window.localStorage;
    },

    platform() {
      if (typeof navigator === "undefined") {
        return "";
      }

      return `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`;
    },
  };
}

function readPersistedIntent(
  storage: WakeStorage,
  storageKey: string,
): PersistedSessionIntent | null {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedSessionIntent>;
    const validMode =
      parsed.mode === "indefinite" || parsed.mode === "timer" ? parsed.mode : null;
    const validIntent = typeof parsed.intent === "boolean" ? parsed.intent : null;
    const validEndAt =
      parsed.endAt === null || typeof parsed.endAt === "number"
        ? parsed.endAt
        : null;

    if (!validMode || validIntent === null) {
      return null;
    }

    return {
      intent: validIntent,
      mode: validMode,
      endAt: validEndAt,
    };
  } catch {
    return null;
  }
}

export function createWakeSessionEngine(
  options: CreateWakeSessionEngineOptions = {},
): WakeSessionController {
  const env = options.environment ?? createBrowserEnvironment();
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const listeners = new Set<(state: WakeSessionState) => void>();

  let wakeLock: WakeLockHandle | null = null;
  let endAt: number | null = null;
  let tickHandle: unknown = null;
  let removeVisibilityListener: (() => void) | null = null;

  const state: WakeSessionState = {
    intent: false,
    hasActiveLock: false,
    mode: "indefinite",
    remainingMs: null,
    lastError: null,
    platform: detectPlatform(env.platform()),
    supportStatus: env.hasWakeLockSupport() ? "supported" : "unsupported",
  };

  function emitState() {
    for (const listener of listeners) {
      listener({ ...state });
    }
  }

  function persistIntent() {
    if (!state.intent) {
      env.storage().removeItem(storageKey);
      return;
    }

    const payload: PersistedSessionIntent = {
      intent: state.intent,
      mode: state.mode,
      endAt,
    };

    env.storage().setItem(storageKey, JSON.stringify(payload));
  }

  function clearTicker() {
    if (!tickHandle) {
      return;
    }

    env.clearInterval(tickHandle);
    tickHandle = null;
  }

  async function releaseWakeLock() {
    const activeLock = wakeLock;
    wakeLock = null;

    if (!activeLock) {
      state.hasActiveLock = false;
      return;
    }

    try {
      await activeLock.release();
    } catch (error) {
      if (!state.lastError) {
        state.lastError = normalizeError(error);
      }
    }

    state.hasActiveLock = false;
  }

  async function completeTimerSession() {
    state.intent = false;
    state.remainingMs = 0;
    state.lastError = null;
    endAt = null;
    persistIntent();

    clearTicker();
    await releaseWakeLock();

    if (state.supportStatus !== "unsupported") {
      state.supportStatus = "supported";
    }

    emitState();
  }

  function updateRemainingTime() {
    if (state.mode !== "timer" || endAt === null) {
      state.remainingMs = null;
      return;
    }

    state.remainingMs = Math.max(0, endAt - env.now());
  }

  function ensureTicker() {
    if (state.mode !== "timer" || endAt === null || !state.intent) {
      clearTicker();
      return;
    }

    if (tickHandle) {
      return;
    }

    tickHandle = env.setInterval(() => {
      if (state.mode !== "timer" || endAt === null || !state.intent) {
        clearTicker();
        return;
      }

      updateRemainingTime();

      if (state.remainingMs === 0) {
        void completeTimerSession();
        return;
      }

      emitState();
    }, 1000);
  }

  async function acquireWakeLock() {
    if (!state.intent || state.supportStatus === "unsupported") {
      return;
    }

    if (state.hasActiveLock) {
      return;
    }

    if (!env.isVisible()) {
      return;
    }

    if (state.mode === "timer" && endAt !== null && endAt <= env.now()) {
      await completeTimerSession();
      return;
    }

    try {
      const requestedLock = await env.requestWakeLock();
      wakeLock = requestedLock;
      state.hasActiveLock = true;
      state.supportStatus = "supported";
      state.lastError = null;

      requestedLock.onRelease?.(() => {
        wakeLock = null;
        state.hasActiveLock = false;
        emitState();

        if (!state.intent) {
          return;
        }

        if (!env.isVisible()) {
          return;
        }

        void acquireWakeLock();
      });
    } catch (error) {
      wakeLock = null;
      state.hasActiveLock = false;
      state.supportStatus = "blocked";
      state.lastError = normalizeError(error);
    }

    emitState();
  }

  async function restoreIntentFromStorage() {
    if (state.supportStatus === "unsupported") {
      emitState();
      return;
    }

    const persisted = readPersistedIntent(env.storage(), storageKey);
    if (!persisted || !persisted.intent) {
      emitState();
      return;
    }

    state.intent = true;
    state.mode = persisted.mode;
    endAt = persisted.mode === "timer" ? persisted.endAt : null;

    if (state.mode === "timer") {
      updateRemainingTime();
      if (state.remainingMs === 0) {
        state.intent = false;
        endAt = null;
        persistIntent();
        emitState();
        return;
      }
      ensureTicker();
    } else {
      state.remainingMs = null;
      clearTicker();
    }

    emitState();
    await acquireWakeLock();
  }

  removeVisibilityListener = env.addVisibilityListener(() => {
    if (!state.intent) {
      return;
    }

    if (!env.isVisible()) {
      return;
    }

    void acquireWakeLock();
  });

  void restoreIntentFromStorage();

  return {
    getState() {
      return { ...state };
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async start(mode, durationMs) {
      state.mode = mode;
      state.lastError = null;

      if (state.supportStatus === "unsupported") {
        state.intent = false;
        state.hasActiveLock = false;
        state.lastError = "Screen wake lock is not supported in this browser.";
        emitState();
        return;
      }

      state.intent = true;

      if (mode === "timer") {
        if (!isValidDuration(durationMs)) {
          throw new Error("Timer duration must be greater than zero.");
        }

        endAt = env.now() + durationMs;
        updateRemainingTime();
        ensureTicker();
      } else {
        endAt = null;
        state.remainingMs = null;
        clearTicker();
      }

      persistIntent();
      emitState();
      await acquireWakeLock();
    },

    async stop() {
      state.intent = false;
      state.remainingMs = null;
      state.lastError = null;
      endAt = null;
      persistIntent();

      clearTicker();
      await releaseWakeLock();

      if (state.supportStatus !== "unsupported") {
        state.supportStatus = "supported";
      }

      emitState();
    },

    async destroy() {
      clearTicker();
      removeVisibilityListener?.();
      removeVisibilityListener = null;
      listeners.clear();
      await releaseWakeLock();
    },
  };
}
