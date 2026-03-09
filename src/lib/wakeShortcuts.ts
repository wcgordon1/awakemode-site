export interface WakeShortcutHandlers {
  onToggleStartStop: () => void;
  onToggleMode: () => void;
  onLaunchProfile: (index: number) => void;
  onRetry: () => void;
}

export interface WakeShortcutController {
  handleKeydown: (event: KeyboardEvent) => void;
  attach: (target?: Window | Document) => () => void;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") {
    return false;
  }

  const maybeElement = target as {
    isContentEditable?: boolean;
    tagName?: string;
  };

  if (maybeElement.isContentEditable) {
    return true;
  }

  const tag = typeof maybeElement.tagName === "string" ? maybeElement.tagName.toLowerCase() : "";
  return tag === "input" || tag === "textarea" || tag === "select";
}

export function createWakeShortcutController(
  handlers: WakeShortcutHandlers,
): WakeShortcutController {
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();

    if (event.code === "Space") {
      event.preventDefault();
      handlers.onToggleStartStop();
      return;
    }

    if (key === "t") {
      event.preventDefault();
      handlers.onToggleMode();
      return;
    }

    if (key === "r") {
      event.preventDefault();
      handlers.onRetry();
      return;
    }

    if (key === "1" || key === "2" || key === "3") {
      event.preventDefault();
      handlers.onLaunchProfile(Number(key) - 1);
    }
  };

  const attach = (target: Window | Document = window) => {
    target.addEventListener("keydown", handleKeydown);
    return () => target.removeEventListener("keydown", handleKeydown);
  };

  return {
    handleKeydown,
    attach,
  };
}
