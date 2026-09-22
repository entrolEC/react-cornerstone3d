/**
 * The library's one animation-frame queue (ADR 0006). Bindings only enqueue
 * their rebuild; a single callback drains the queue, so every Binding made
 * dirty in a frame notifies in the same synchronous pass and React renders
 * once. The browser runs separate rAF callbacks with a microtask checkpoint
 * between them, and React flushes a useSyncExternalStore notification in a
 * microtask — per-Binding rAFs let React render between them, with one hook
 * on the new frame and another still on the old.
 *
 * The scheduler knows nothing about Bindings: the set of queued functions is
 * its whole state.
 */
export interface Scheduler {
  /** Queue `update` for the next frame. Queuing it twice runs it once. */
  schedule(update: () => void): void;
  /** Drop `update` from the queue — even mid-drain, it will not run. */
  unschedule(update: () => void): void;
}

/**
 * A fresh, independent queue. Production code shares `scheduler` below;
 * this exists so tests never touch state another test left behind.
 */
export function createScheduler(): Scheduler {
  const dirty = new Set<() => void>();
  let rafId: number | undefined;

  // Read requestAnimationFrame at call time, not import time: tests swap the
  // global per test, and importing this module must not touch it at all.
  const request = () => {
    if (rafId !== undefined) return;
    rafId = requestAnimationFrame(drain);
  };

  const drain = () => {
    rafId = undefined;
    // Iterate a copy, but consult the live set: an `unschedule` from inside
    // an update (its notify unmounted a consumer, whose Binding detached)
    // must still win, and a `schedule` from inside an update belongs to the
    // next frame, not this pass.
    for (const update of [...dirty]) {
      if (!dirty.has(update)) continue;
      dirty.delete(update);
      try {
        update();
      } catch (error) {
        // One Binding's failing rebuild must not take the frame's other
        // Bindings with it — they were independent when each had its own
        // rAF. Surface the error as uncaught instead of swallowing it.
        queueMicrotask(() => {
          throw error;
        });
      }
    }
    if (dirty.size > 0) request();
  };

  return {
    schedule: (update) => {
      dirty.add(update);
      request();
    },
    unschedule: (update) => {
      dirty.delete(update);
      if (dirty.size === 0 && rafId !== undefined) {
        cancelAnimationFrame(rafId);
        rafId = undefined;
      }
    },
  };
}

/** The shared queue every Binding in the library enqueues on. */
export const scheduler: Scheduler = createScheduler();
