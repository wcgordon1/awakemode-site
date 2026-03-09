import { describe, expect, it, vi } from "vitest";

import { createWakeShortcutController, isEditableTarget } from "./wakeShortcuts";

function createKeyEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  const event = {
    key: "",
    code: "",
    target: null,
    defaultPrevented: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  };

  return event as unknown as KeyboardEvent;
}

describe("wakeShortcuts", () => {
  it("identifies editable targets", () => {
    expect(isEditableTarget({ tagName: "INPUT" } as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "TEXTAREA" } as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true } as EventTarget)).toBe(
      true,
    );
    expect(isEditableTarget({ tagName: "DIV" } as EventTarget)).toBe(false);
  });

  it("maps shortcut keys to handlers", () => {
    const handlers = {
      onToggleStartStop: vi.fn(),
      onToggleMode: vi.fn(),
      onLaunchProfile: vi.fn(),
      onRetry: vi.fn(),
    };

    const controller = createWakeShortcutController(handlers);

    controller.handleKeydown(createKeyEvent({ code: "Space", key: " " }));
    controller.handleKeydown(createKeyEvent({ key: "t" }));
    controller.handleKeydown(createKeyEvent({ key: "2" }));
    controller.handleKeydown(createKeyEvent({ key: "r" }));

    expect(handlers.onToggleStartStop).toHaveBeenCalledTimes(1);
    expect(handlers.onToggleMode).toHaveBeenCalledTimes(1);
    expect(handlers.onLaunchProfile).toHaveBeenCalledWith(1);
    expect(handlers.onRetry).toHaveBeenCalledTimes(1);
  });

  it("ignores shortcuts while typing in an editable target", () => {
    const handlers = {
      onToggleStartStop: vi.fn(),
      onToggleMode: vi.fn(),
      onLaunchProfile: vi.fn(),
      onRetry: vi.fn(),
    };

    const controller = createWakeShortcutController(handlers);
    controller.handleKeydown(
      createKeyEvent({ key: "t", target: { tagName: "INPUT" } as EventTarget }),
    );

    expect(handlers.onToggleMode).not.toHaveBeenCalled();
  });
});
