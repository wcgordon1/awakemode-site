export type WakeSupportStatus = "supported" | "unsupported" | "blocked";
export type WakeSessionMode = "indefinite" | "timer";
export type WakePlatform = "mac" | "windows" | "other";

export type WakeSessionEventType =
  | "started"
  | "stopped"
  | "acquired"
  | "released"
  | "blocked"
  | "reacquire_attempt"
  | "reacquire_success"
  | "reacquire_failed"
  | "timer_completed";

export interface WakeSessionEvent {
  type: WakeSessionEventType;
  timestamp: number;
  detail?: string;
}

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
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
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
  subscribeEvents(listener: (event: WakeSessionEvent) => void): () => void;
  start(mode: WakeSessionMode, durationMs?: number): Promise<void>;
  stop(): Promise<void>;
  retry(): Promise<void>;
  destroy(): Promise<void>;
}

interface PersistedSessionIntent {
  intent: boolean;
  mode: WakeSessionMode;
  endAt: number | null;
}

const DEFAULT_STORAGE_KEY = "awakemode:wake-session-intent";
const REACQUIRE_BACKOFF_SEQUENCE = [500, 2000, 5000, 10000] as const;

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

    setTimeout(callback, ms) {
      return globalThis.setTimeout(callback, ms);
    },

    clearTimeout(handle) {
      globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
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

  const stateListeners = new Set<(state: WakeSessionState) => void>();
  const eventListeners = new Set<(event: WakeSessionEvent) => void>();

  let wakeLock: WakeLockHandle | null = null;
  let endAt: number | null = null;
  let tickHandle: unknown = null;
  let reacquireTimeoutHandle: unknown = null;
  let reacquireAttempt = 0;
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
    for (const listener of stateListeners) {
      listener({ ...state });
    }
  }

  function emitEvent(type: WakeSessionEventType, detail?: string) {
    const event: WakeSessionEvent = {
      type,
      timestamp: env.now(),
      detail,
    };

    for (const listener of eventListeners) {
      listener(event);
    }
  }

  function shouldAttemptWakeLock(): boolean {
    return state.intent && state.supportStatus !== "unsupported" && env.isVisible();
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

  function clearReacquireTimeout() {
    if (!reacquireTimeoutHandle) {
      return;
    }

    env.clearTimeout(reacquireTimeoutHandle);
    reacquireTimeoutHandle = null;
  }

  function scheduleReacquireAttempt() {
    if (!shouldAttemptWakeLock()) {
      return;
    }

    if (reacquireTimeoutHandle) {
      return;
    }

    const delayMs =
      REACQUIRE_BACKOFF_SEQUENCE[
        Math.min(reacquireAttempt, REACQUIRE_BACKOFF_SEQUENCE.length - 1)
      ];
    reacquireAttempt += 1;

    reacquireTimeoutHandle = env.setTimeout(() => {
      reacquireTimeoutHandle = null;
      void attemptReacquire("auto");
    }, delayMs);
  }

  async function releaseWakeLock(reason: string) {
    const activeLock = wakeLock;
    wakeLock = null;
    clearReacquireTimeout();
    reacquireAttempt = 0;

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
    emitEvent("released", reason);
  }

  function updateRemainingTime() {
    if (state.mode !== "timer" || endAt === null) {
      state.remainingMs = null;
      return;
    }

    state.remainingMs = Math.max(0, endAt - env.now());
  }

  async function completeTimerSession() {
    state.intent = false;
    state.remainingMs = 0;
    state.lastError = null;
    endAt = null;

    persistIntent();
    clearTicker();
    clearReacquireTimeout();
    reacquireAttempt = 0;

    emitEvent("timer_completed");
    emitEvent("stopped", "timer");

    await releaseWakeLock("timer");

    if (state.supportStatus !== "unsupported") {
      state.supportStatus = "supported";
    }

    emitState();
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

  async function acquireWakeLock(reason: string): Promise<boolean> {
    if (!shouldAttemptWakeLock()) {
      return false;
    }

    if (state.hasActiveLock) {
      return true;
    }

    if (state.mode === "timer" && endAt !== null && endAt <= env.now()) {
      await completeTimerSession();
      return false;
    }

    try {
      const requestedLock = await env.requestWakeLock();
      wakeLock = requestedLock;
      state.hasActiveLock = true;
      state.supportStatus = "supported";
      state.lastError = null;
      emitEvent("acquired", reason);

      requestedLock.onRelease?.(() => {
        if (wakeLock !== requestedLock) {
          return;
        }

        wakeLock = null;
        state.hasActiveLock = false;
        emitEvent("released", "sentinel");
        emitState();

        if (state.intent && env.isVisible()) {
          scheduleReacquireAttempt();
        }
      });

      clearReacquireTimeout();
      reacquireAttempt = 0;
      emitState();
      return true;
    } catch (error) {
      wakeLock = null;
      state.hasActiveLock = false;
      state.supportStatus = "blocked";
      state.lastError = normalizeError(error);
      emitEvent("blocked", state.lastError);
      emitState();
      return false;
    }
  }

  async function attemptReacquire(trigger: "auto" | "manual"): Promise<boolean> {
    if (!shouldAttemptWakeLock()) {
      return false;
    }

    emitEvent("reacquire_attempt", trigger);

    const acquired = await acquireWakeLock("reacquire");
    if (acquired) {
      emitEvent("reacquire_success", trigger);
      reacquireAttempt = 0;
      clearReacquireTimeout();
      return true;
    }

    emitEvent("reacquire_failed", state.lastError ?? "Wake lock request failed.");
    scheduleReacquireAttempt();
    return false;
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

    const acquired = await acquireWakeLock("restore");
    if (!acquired) {
      scheduleReacquireAttempt();
    }
  }

  removeVisibilityListener = env.addVisibilityListener(() => {
    if (!state.intent) {
      return;
    }

    if (!env.isVisible()) {
      return;
    }

    if (state.hasActiveLock) {
      return;
    }

    void attemptReacquire("auto");
  });

  void restoreIntentFromStorage();

  return {
    getState() {
      return { ...state };
    },

    subscribe(listener) {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },

    subscribeEvents(listener) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
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
      emitEvent("started", mode);

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

      const acquired = await acquireWakeLock("start");
      if (!acquired) {
        scheduleReacquireAttempt();
      }
    },

    async stop() {
      state.intent = false;
      state.remainingMs = null;
      state.lastError = null;
      endAt = null;

      persistIntent();
      clearTicker();
      clearReacquireTimeout();
      reacquireAttempt = 0;

      emitEvent("stopped", "manual");
      await releaseWakeLock("manual");

      if (state.supportStatus !== "unsupported") {
        state.supportStatus = "supported";
      }

      emitState();
    },

    async retry() {
      if (!state.intent || state.supportStatus === "unsupported") {
        return;
      }

      clearReacquireTimeout();
      reacquireAttempt = 0;
      await attemptReacquire("manual");
    },

    async destroy() {
      clearTicker();
      clearReacquireTimeout();
      removeVisibilityListener?.();
      removeVisibilityListener = null;
      stateListeners.clear();
      eventListeners.clear();
      await releaseWakeLock("destroy");
    },
  };
}
