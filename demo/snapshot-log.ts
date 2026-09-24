/**
 * What React was actually handed, in order, while the component in panel 2 was
 * looping. Panel 3 shows that real sequence instead of calling getSnapshot a
 * few times on its own — nobody does that, and staging it made the whole
 * explanation look invented.
 *
 * Demo instrumentation only. The recording call sits outside the excerpt the
 * page prints, so the code on screen is still the code that runs.
 *
 * And since panel 3 has to hear about a recording made in panel 2, this is an
 * external store read with `useSyncExternalStore` — done the way the page
 * spends two panels arguing for: one snapshot object, rebuilt only on change,
 * so the reference stays stable between them.
 */
export interface SnapshotLog {
  /** The objects React received, in order. */
  readonly handed: readonly object[];
  /** How many renders happened before React gave up. */
  readonly renders: number;
}

// The console prints the run, not a sample of it. Bounded only so a runaway
// loop cannot grow this without limit.
const KEEP = 400;

let handed: object[] = [];
let renders = 0;
let snapshot: SnapshotLog = { handed, renders };

const listeners = new Set<() => void>();
let queued = false;

function publish() {
  snapshot = { handed, renders };
  for (const listener of listeners) listener();
}

export function recordSnapshot(value: object | undefined) {
  renders += 1;
  if (value && handed.length < KEEP) handed = [...handed, value];
  if (queued) return;
  queued = true;
  // Recording happens during the looping component's render, so notify on the
  // next tick rather than telling React to update mid-render.
  queueMicrotask(() => {
    queued = false;
    publish();
  });
}

export function subscribeSnapshotLog(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Referentially stable until something is actually recorded. */
export const snapshotLog = (): SnapshotLog => snapshot;

export function clearSnapshotLog() {
  handed = [];
  renders = 0;
  publish();
}
