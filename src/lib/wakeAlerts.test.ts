import { describe, expect, it } from "vitest";

import {
  createTenSecondAlertTracker,
  shouldTriggerTenSecondAlert,
} from "./wakeAlerts";

describe("wakeAlerts", () => {
  it("detects threshold crossing into ten-second window", () => {
    expect(shouldTriggerTenSecondAlert(11_000, 10_000)).toBe(true);
    expect(shouldTriggerTenSecondAlert(10_000, 9_000)).toBe(false);
    expect(shouldTriggerTenSecondAlert(12_000, 11_000)).toBe(false);
  });

  it("triggers only once per timer run until reset", () => {
    const tracker = createTenSecondAlertTracker();

    expect(tracker.update(12_000, true)).toBe(false);
    expect(tracker.update(10_000, true)).toBe(true);
    expect(tracker.update(9_000, true)).toBe(false);
    expect(tracker.update(8_000, true)).toBe(false);

    tracker.reset();

    expect(tracker.update(10_500, true)).toBe(false);
    expect(tracker.update(9_900, true)).toBe(true);
  });

  it("does not trigger when inactive or with missing values", () => {
    const tracker = createTenSecondAlertTracker();

    expect(tracker.update(null, true)).toBe(false);
    expect(tracker.update(9_000, false)).toBe(false);
    expect(tracker.update(12_000, true)).toBe(false);
    expect(tracker.update(0, true)).toBe(false);
  });
});
