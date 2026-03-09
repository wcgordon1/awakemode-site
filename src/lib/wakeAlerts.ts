export interface TripleBeepOptions {
  frequency?: number;
  durationMs?: number;
  gapMs?: number;
  volume?: number;
}

export interface TenSecondAlertTracker {
  update(remainingMs: number | null, isTimerActive: boolean): boolean;
  reset(): void;
}

export function shouldTriggerTenSecondAlert(
  previousRemainingMs: number | null,
  nextRemainingMs: number | null,
  thresholdMs = 10_000,
): boolean {
  if (
    previousRemainingMs === null ||
    nextRemainingMs === null ||
    nextRemainingMs <= 0 ||
    previousRemainingMs <= thresholdMs
  ) {
    return false;
  }

  return nextRemainingMs <= thresholdMs;
}

export function createTenSecondAlertTracker(thresholdMs = 10_000): TenSecondAlertTracker {
  let previousRemainingMs: number | null = null;
  let hasTriggered = false;

  return {
    update(remainingMs, isTimerActive) {
      if (!isTimerActive || remainingMs === null) {
        previousRemainingMs = null;
        return false;
      }

      if (remainingMs <= 0) {
        previousRemainingMs = remainingMs;
        return false;
      }

      const shouldTrigger =
        !hasTriggered &&
        shouldTriggerTenSecondAlert(previousRemainingMs, remainingMs, thresholdMs);

      if (shouldTrigger) {
        hasTriggered = true;
      }

      previousRemainingMs = remainingMs;
      return shouldTrigger;
    },

    reset() {
      previousRemainingMs = null;
      hasTriggered = false;
    },
  };
}

export async function playTripleBeep(options: TripleBeepOptions = {}): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const audioContextConstructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!audioContextConstructor) {
    return;
  }

  const frequency = options.frequency ?? 880;
  const durationSeconds = (options.durationMs ?? 90) / 1000;
  const gapSeconds = (options.gapMs ?? 110) / 1000;
  const volume = options.volume ?? 0.03;

  let audioContext: AudioContext;
  try {
    audioContext = new audioContextConstructor();
  } catch {
    return;
  }

  try {
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
  } catch {
    try {
      await audioContext.close();
    } catch {
      // Ignore close failures.
    }
    return;
  }

  const startAt = audioContext.currentTime;

  for (let index = 0; index < 3; index += 1) {
    const offset = index * (durationSeconds + gapSeconds);

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(volume, startAt + offset);
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      startAt + offset + durationSeconds,
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start(startAt + offset);
    oscillator.stop(startAt + offset + durationSeconds);
  }

  const closeDelayMs = Math.ceil((3 * durationSeconds + 2 * gapSeconds + 0.2) * 1000);
  window.setTimeout(() => {
    void audioContext.close().catch(() => undefined);
  }, closeDelayMs);
}
