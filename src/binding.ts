import { useRef, useSyncExternalStore } from 'react';
import { scheduler } from './scheduler';

/**
 * What a hook sees of a Binding: a useSyncExternalStore pair. One Binding
 * exists per key (a viewportId, an imageId) while it has consumers, and its
 * Snapshot is referentially stable between Engine events (ADR 0007).
 */
export interface Binding<S> {
  readonly subscribe: (onChange: () => void) => () => void;
  readonly getSnapshot: () => S;
}

/** What a Binding's own Engine wiring may do to it. */
export interface LiveBinding<S> extends Binding<S> {
  /** Rebuild from the Engine now; notify if the Snapshot changed. */
  readonly update: () => void;
  /** Rebuild next frame, in the same pass as every other Binding (ADR 0006). */
  readonly schedule: () => void;
  /** Drop a queued rebuild — a detached Binding must not read the Engine. */
  readonly unschedule: () => void;
  /** Replace the Snapshot without reading the Engine; notify if it changed. */
  readonly set: (next: S) => void;
}

/** How one kind of Binding reads the Engine and hears it. */
export interface BindingSpec<S> {
  /**
   * Read the Engine into a Snapshot. `prev` is the Snapshot being replaced
   * (`undefined` at creation): whatever did not move is taken from it
   * rather than rebuilt (structural sharing).
   */
  readonly build: (prev: S | undefined) => S;
  /** Whether two Snapshots say the same thing; notify is skipped when they do. Default: `Object.is`. */
  readonly equal?: (a: S, b: S) => boolean;
  /** The first consumer arrived: start hearing the Engine. */
  readonly attach: () => void;
  /** The last consumer left: stop hearing the Engine. */
  readonly detach: () => void;
}

/**
 * The skeleton every Binding kind shares: a listener set, a Snapshot read
 * once at creation (so the first render already has a value), attach on the
 * first consumer, detach on the last, and an `update` that notifies only
 * when the Snapshot changed. `define` receives the live Binding so the
 * kind's Engine listeners can call `update`/`schedule`/`set` on it.
 */
export function createBinding<S>(define: (self: LiveBinding<S>) => BindingSpec<S>): Binding<S> {
  const listeners = new Set<() => void>();
  let spec!: BindingSpec<S>;
  let snapshot: S;

  const notify = () => listeners.forEach((listener) => listener());

  const self: LiveBinding<S> = {
    getSnapshot: () => snapshot,
    subscribe: (onChange) => {
      if (listeners.size === 0) spec.attach();
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) spec.detach();
      };
    },
    update: () => {
      const next = spec.build(snapshot);
      if (next === snapshot) return;
      if ((spec.equal ?? Object.is)(next, snapshot)) return;
      snapshot = next;
      notify();
    },
    schedule: () => scheduler.schedule(self.update),
    unschedule: () => scheduler.unschedule(self.update),
    set: (next) => {
      if (next === snapshot) return;
      snapshot = next;
      notify();
    },
  };

  spec = define(self);
  snapshot = spec.build(undefined);
  return self;
}

/**
 * One Binding per key, for as long as it has consumers (ADR 0007, rule 3).
 * `acquire` is called during render, so it must be cheap and must return the
 * same object for the same key across renders — useSyncExternalStore
 * resubscribes whenever `subscribe` changes identity.
 */
export interface Registry<S> {
  readonly acquire: (key: string) => Binding<S>;
  /** Bindings currently registered. For tests. */
  readonly size: number;
}

export function createRegistry<S>(
  define: (key: string, self: LiveBinding<S>) => BindingSpec<S>,
): Registry<S> {
  const bindings = new Map<string, Binding<S>>();
  return {
    acquire: (key) => {
      let binding = bindings.get(key);
      if (!binding) {
        binding = createBinding<S>((self) => {
          const spec = define(key, self);
          return {
            ...spec,
            // StrictMode subscribes, unsubscribes and subscribes again on the
            // same hook instance: the eviction in between must not leave this
            // live Binding outside the registry, or the next acquirer would
            // build a second one for the same key.
            attach: () => {
              if (!bindings.has(key)) bindings.set(key, self);
              spec.attach();
            },
            detach: () => {
              spec.detach();
              if (bindings.get(key) === self) bindings.delete(key);
            },
          };
        });
        // Registered at creation, not at first subscribe: two components
        // rendering the same key in one pass must share before either commits.
        // ponytail: a render that never commits leaves its Binding here until
        // the key is acquired and released again.
        bindings.set(key, binding);
      }
      return binding;
    },
    get size() {
      return bindings.size;
    },
  };
}

export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/**
 * Reads a Binding through useSyncExternalStore, optionally through a selector.
 *
 * useSyncExternalStore has no native selector support: it re-renders
 * whenever getSnapshot's result changes by Object.is. So getSnapshot here
 * returns the *selected* value, memoized per (Snapshot, selector). The
 * selector belongs in the key: an inline selector is a new function every
 * render, and without it the reads React makes within one render could
 * disagree. The selector is never called while the Snapshot is `undefined`
 * (absence is a normal state) — the hook returns `undefined` instead. Kept
 * hand-rolled rather than taken from use-sync-external-store/shim/with-selector
 * — ADR 0004, which is also where an isEqual option would go (one
 * comparison, right here).
 */
export function useBinding<S, T>(
  binding: Binding<S | undefined>,
  selector: ((snapshot: S) => T) | undefined,
): T | S | undefined {
  const { subscribe, getSnapshot } = binding;
  const memo = useRef<{
    snapshot: S | undefined;
    selector: typeof selector;
    selected: T | S | undefined;
  }>(undefined);

  return useSyncExternalStore(subscribe, () => {
    const snapshot = getSnapshot();
    const prev = memo.current;
    if (prev && prev.snapshot === snapshot && prev.selector === selector) return prev.selected;
    const selected =
      snapshot === undefined ? undefined : selector ? selector(snapshot) : snapshot;
    memo.current = { snapshot, selector, selected };
    return selected;
  });
}
