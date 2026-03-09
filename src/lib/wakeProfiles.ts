import { normalizeCustomMinutes, type WakeSessionMode, type WakeStorage } from "./wakeSession";

export interface WakeSessionProfile {
  id: string;
  name: string;
  mode: WakeSessionMode;
  durationMinutes: number | null;
  isDefault: boolean;
  updatedAt: number;
}

export interface WakeSessionProfileInput {
  name: string;
  mode: WakeSessionMode;
  durationMinutes: number | null;
  isDefault?: boolean;
}

export interface WakeProfileService {
  listProfiles(): WakeSessionProfile[];
  createProfile(input: WakeSessionProfileInput): WakeSessionProfile;
  updateProfile(id: string, input: WakeSessionProfileInput): WakeSessionProfile;
  deleteProfile(id: string): void;
  setDefaultProfile(id: string): WakeSessionProfile;
}

export interface CreateWakeProfileServiceOptions {
  storage?: WakeStorage;
  storageKey?: string;
  now?: () => number;
  idFactory?: () => string;
}

const DEFAULT_STORAGE_KEY = "awakemode:session-profiles";
export const MAX_PROFILES = 8;
export const MAX_PROFILE_NAME_LENGTH = 24;

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

function createIdFactory(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `profile-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function normalizeInput(input: WakeSessionProfileInput): WakeSessionProfileInput {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Profile name is required.");
  }

  if (name.length > MAX_PROFILE_NAME_LENGTH) {
    throw new Error(`Profile name must be ${MAX_PROFILE_NAME_LENGTH} characters or fewer.`);
  }

  if (input.mode !== "indefinite" && input.mode !== "timer") {
    throw new Error("Profile mode must be indefinite or timer.");
  }

  if (input.mode === "indefinite") {
    return {
      name,
      mode: "indefinite",
      durationMinutes: null,
      isDefault: Boolean(input.isDefault),
    };
  }

  const normalizedMinutes = normalizeCustomMinutes(input.durationMinutes);
  if (normalizedMinutes === null) {
    throw new Error("Timer profiles require duration between 1 and 1440 minutes.");
  }

  return {
    name,
    mode: "timer",
    durationMinutes: normalizedMinutes,
    isDefault: Boolean(input.isDefault),
  };
}

function sortProfiles(profiles: WakeSessionProfile[]): WakeSessionProfile[] {
  return [...profiles].sort((a, b) => {
    if (a.isDefault !== b.isDefault) {
      return a.isDefault ? -1 : 1;
    }

    return b.updatedAt - a.updatedAt;
  });
}

function ensureSingleDefault(profiles: WakeSessionProfile[]): WakeSessionProfile[] {
  if (profiles.length === 0) {
    return [];
  }

  let defaultFound = false;
  const normalized = profiles.map((profile) => {
    if (!defaultFound && profile.isDefault) {
      defaultFound = true;
      return { ...profile, isDefault: true };
    }

    return { ...profile, isDefault: false };
  });

  if (!defaultFound) {
    normalized[0] = { ...normalized[0], isDefault: true };
  }

  return normalized;
}

function deserializeProfiles(raw: string | null): WakeSessionProfile[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as WakeSessionProfile[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    const cleaned = parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const mode = item.mode === "timer" ? "timer" : "indefinite";
        const durationMinutes =
          mode === "timer"
            ? normalizeCustomMinutes(item.durationMinutes)
            : null;

        if (mode === "timer" && durationMinutes === null) {
          return null;
        }

        if (typeof item.id !== "string" || typeof item.name !== "string") {
          return null;
        }

        const trimmedName = item.name.trim();
        if (!trimmedName || trimmedName.length > MAX_PROFILE_NAME_LENGTH) {
          return null;
        }

        return {
          id: item.id,
          name: trimmedName,
          mode,
          durationMinutes,
          isDefault: Boolean(item.isDefault),
          updatedAt:
            typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt)
              ? item.updatedAt
              : Date.now(),
        } satisfies WakeSessionProfile;
      })
      .filter(Boolean) as WakeSessionProfile[];

    return ensureSingleDefault(sortProfiles(cleaned)).slice(0, MAX_PROFILES);
  } catch {
    return [];
  }
}

export function createWakeProfileService(
  options: CreateWakeProfileServiceOptions = {},
): WakeProfileService {
  const storage = options.storage ?? createBrowserStorage();
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const now = options.now ?? (() => Date.now());
  const idFactory = options.idFactory ?? createIdFactory;

  function persistProfiles(profiles: WakeSessionProfile[]) {
    const normalized = ensureSingleDefault(sortProfiles(profiles)).slice(0, MAX_PROFILES);
    storage.setItem(storageKey, JSON.stringify(normalized));
  }

  function readProfiles(): WakeSessionProfile[] {
    const profiles = deserializeProfiles(storage.getItem(storageKey));

    if (profiles.length > 0) {
      const normalized = ensureSingleDefault(sortProfiles(profiles));
      persistProfiles(normalized);
      return normalized;
    }

    const starterProfile: WakeSessionProfile = {
      id: idFactory(),
      name: "Focus 30m",
      mode: "timer",
      durationMinutes: 30,
      isDefault: true,
      updatedAt: now(),
    };

    persistProfiles([starterProfile]);
    return [starterProfile];
  }

  function setDefaultOnProfiles(
    profiles: WakeSessionProfile[],
    defaultId: string,
  ): WakeSessionProfile[] {
    let found = false;
    const updated = profiles.map((profile) => {
      const shouldBeDefault = profile.id === defaultId;
      if (shouldBeDefault) {
        found = true;
      }

      return {
        ...profile,
        isDefault: shouldBeDefault,
      };
    });

    if (!found) {
      throw new Error("Profile not found.");
    }

    return updated;
  }

  return {
    listProfiles() {
      return readProfiles().map((profile) => ({ ...profile }));
    },

    createProfile(input) {
      const profiles = readProfiles();
      if (profiles.length >= MAX_PROFILES) {
        throw new Error(`You can store up to ${MAX_PROFILES} profiles.`);
      }

      const normalizedInput = normalizeInput(input);
      const profile: WakeSessionProfile = {
        id: idFactory(),
        name: normalizedInput.name,
        mode: normalizedInput.mode,
        durationMinutes: normalizedInput.durationMinutes,
        isDefault:
          normalizedInput.isDefault === true || profiles.every((item) => !item.isDefault),
        updatedAt: now(),
      };

      let nextProfiles = [...profiles, profile];
      if (profile.isDefault) {
        nextProfiles = setDefaultOnProfiles(nextProfiles, profile.id);
      }

      persistProfiles(nextProfiles);

      return { ...profile };
    },

    updateProfile(id, input) {
      const profiles = readProfiles();
      const index = profiles.findIndex((profile) => profile.id === id);
      if (index < 0) {
        throw new Error("Profile not found.");
      }

      const normalizedInput = normalizeInput(input);
      const existing = profiles[index];

      const updatedProfile: WakeSessionProfile = {
        ...existing,
        name: normalizedInput.name,
        mode: normalizedInput.mode,
        durationMinutes: normalizedInput.durationMinutes,
        updatedAt: now(),
      };

      let nextProfiles = [...profiles];
      nextProfiles[index] = updatedProfile;

      if (normalizedInput.isDefault === true) {
        nextProfiles = setDefaultOnProfiles(nextProfiles, id);
      }

      persistProfiles(nextProfiles);
      return { ...updatedProfile };
    },

    deleteProfile(id) {
      const profiles = readProfiles();
      const profileToDelete = profiles.find((profile) => profile.id === id);
      if (!profileToDelete) {
        throw new Error("Profile not found.");
      }

      const nextProfiles = profiles.filter((profile) => profile.id !== id);
      if (nextProfiles.length === 0) {
        storage.removeItem(storageKey);
        void readProfiles();
        return;
      }

      if (profileToDelete.isDefault) {
        nextProfiles[0] = { ...nextProfiles[0], isDefault: true, updatedAt: now() };
      }

      persistProfiles(nextProfiles);
    },

    setDefaultProfile(id) {
      const profiles = readProfiles();
      const nextProfiles = setDefaultOnProfiles(
        profiles.map((profile) => ({ ...profile, updatedAt: profile.id === id ? now() : profile.updatedAt })),
        id,
      );

      persistProfiles(nextProfiles);
      const updated = nextProfiles.find((profile) => profile.id === id);
      if (!updated) {
        throw new Error("Profile not found.");
      }

      return { ...updated };
    },
  };
}
