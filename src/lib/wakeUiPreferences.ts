import {
  normalizeCustomMinutes,
  type WakeSessionMode,
  type WakeStorage,
} from "./wakeSession";

export interface WakeUiPreferenceKeys {
  settingsOpen: string;
  mode: string;
  customMinutes: string;
  beepAlerts: string;
}

export interface WakeUiPreferences {
  settingsOpen: boolean;
  mode: WakeSessionMode;
  customMinutes: number;
  beepAlerts: boolean;
}

export interface WakeUiPreferenceService {
  read(): WakeUiPreferences;
  write(next: Partial<WakeUiPreferences>): WakeUiPreferences;
}

export interface CreateWakeUiPreferenceServiceOptions {
  storage?: WakeStorage;
  keys?: Partial<WakeUiPreferenceKeys>;
  defaultMode?: WakeSessionMode;
  defaultCustomMinutes?: number;
}

const DEFAULT_KEYS: WakeUiPreferenceKeys = {
  settingsOpen: "awakemode:ui:settings-open",
  mode: "awakemode:ui:mode",
  customMinutes: "awakemode:ui:custom-minutes",
  beepAlerts: "awakemode:ui:beep-alerts",
};

const DEFAULT_MODE: WakeSessionMode = "indefinite";
const DEFAULT_CUSTOM_MINUTES = 30;

function createBrowserStorage(): WakeStorage {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }

  return window.localStorage;
}

function parseMode(value: string | null, fallback: WakeSessionMode): WakeSessionMode {
  if (value === "timer" || value === "indefinite") {
    return value;
  }

  return fallback;
}

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}

function parseCustomMinutes(value: string | null, fallback: number): number {
  const normalized = normalizeCustomMinutes(value);
  return normalized ?? fallback;
}

export function createWakeUiPreferenceService(
  options: CreateWakeUiPreferenceServiceOptions = {},
): WakeUiPreferenceService {
  const storage = options.storage ?? createBrowserStorage();
  const keys: WakeUiPreferenceKeys = {
    settingsOpen: options.keys?.settingsOpen ?? DEFAULT_KEYS.settingsOpen,
    mode: options.keys?.mode ?? DEFAULT_KEYS.mode,
    customMinutes: options.keys?.customMinutes ?? DEFAULT_KEYS.customMinutes,
    beepAlerts: options.keys?.beepAlerts ?? DEFAULT_KEYS.beepAlerts,
  };

  const defaultMode = parseMode(options.defaultMode ?? null, DEFAULT_MODE);
  const defaultCustomMinutes =
    normalizeCustomMinutes(options.defaultCustomMinutes) ?? DEFAULT_CUSTOM_MINUTES;

  const safeRead = (key: string): string | null => {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  };

  const safeWrite = (key: string, value: string): void => {
    try {
      storage.setItem(key, value);
    } catch {
      // Ignore localStorage errors (private mode, blocked storage, quota, etc.).
    }
  };

  const read = (): WakeUiPreferences => {
    return {
      settingsOpen: parseBoolean(safeRead(keys.settingsOpen), false),
      mode: parseMode(safeRead(keys.mode), defaultMode),
      customMinutes: parseCustomMinutes(safeRead(keys.customMinutes), defaultCustomMinutes),
      beepAlerts: parseBoolean(safeRead(keys.beepAlerts), true),
    };
  };

  return {
    read,

    write(next) {
      const current = read();
      const merged: WakeUiPreferences = {
        settingsOpen:
          typeof next.settingsOpen === "boolean"
            ? next.settingsOpen
            : current.settingsOpen,
        mode: parseMode(next.mode ?? null, current.mode),
        customMinutes:
          normalizeCustomMinutes(next.customMinutes) ?? current.customMinutes,
        beepAlerts:
          typeof next.beepAlerts === "boolean"
            ? next.beepAlerts
            : current.beepAlerts,
      };

      safeWrite(keys.settingsOpen, String(merged.settingsOpen));
      safeWrite(keys.mode, merged.mode);
      safeWrite(keys.customMinutes, String(merged.customMinutes));
      safeWrite(keys.beepAlerts, String(merged.beepAlerts));

      return merged;
    },
  };
}
