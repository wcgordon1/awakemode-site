import { createWakeSessionEngine, type WakeSessionController } from "./wakeSession";

interface WakeSessionRuntimeRecord {
  controller: WakeSessionController;
  references: number;
}

interface WakeRuntimeWindow extends Window {
  __awakeSessionRuntime?: WakeSessionRuntimeRecord;
}

export interface WakeSessionLease {
  controller: WakeSessionController;
  release(): void;
}

function createLease(record: WakeSessionRuntimeRecord, runtimeWindow: WakeRuntimeWindow): WakeSessionLease {
  let released = false;

  return {
    controller: record.controller,

    release() {
      if (released) {
        return;
      }

      released = true;

      const current = runtimeWindow.__awakeSessionRuntime;
      if (!current || current.controller !== record.controller) {
        return;
      }

      current.references = Math.max(0, current.references - 1);
      if (current.references > 0) {
        return;
      }

      runtimeWindow.__awakeSessionRuntime = undefined;
      void current.controller.destroy();
    },
  };
}

export function retainWakeSessionEngine(): WakeSessionLease {
  if (typeof window === "undefined") {
    const controller = createWakeSessionEngine();
    return {
      controller,
      release() {
        void controller.destroy();
      },
    };
  }

  const runtimeWindow = window as WakeRuntimeWindow;
  if (!runtimeWindow.__awakeSessionRuntime) {
    runtimeWindow.__awakeSessionRuntime = {
      controller: createWakeSessionEngine(),
      references: 0,
    };
  }

  runtimeWindow.__awakeSessionRuntime.references += 1;

  return createLease(runtimeWindow.__awakeSessionRuntime, runtimeWindow);
}
