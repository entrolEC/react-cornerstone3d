import type { Types } from '@cornerstonejs/core';
import { Enums, eventTarget, getEnabledElementByViewportId } from '@cornerstonejs/core';
import { useCallback, useRef, useSyncExternalStore } from 'react';

/** State shared by every viewport kind. */
interface ViewportStateCommon {
  readonly camera: Types.ICamera;
  readonly voiRange: Types.VOIRange | undefined;
  /**
   * Slice Position, as the Engine reports it: `undefined` when the viewport
   * has no slices (3D, or a Volume before its data arrives). Shared by every
   * kind so one slice control serves Stack and Volume alike.
   */
  readonly sliceIndex: number | undefined;
  readonly numberOfSlices: number | undefined;
}

/** Observable state of one Stack viewport. Immutable Snapshot (deep-frozen). */
export interface StackViewportState extends ViewportStateCommon {
  readonly kind: 'stack';
  /** The requested slice (ADR 0003); a Stack always reports a number. */
  readonly sliceIndex: number;
  readonly numberOfSlices: number;
}

/** Observable state of one Volume viewport. Immutable Snapshot (deep-frozen). */
export interface VolumeViewportState extends ViewportStateCommon {
  readonly kind: 'volume';
}

/** Discriminated by `kind`: narrow before touching kind-specific fields. */
export type ViewportState = StackViewportState | VolumeViewportState;

// Engine events that invalidate the Snapshot. All fire on viewport.element.
// PRE_STACK_NEW_IMAGE: StackViewport assigns currentImageIdIndex synchronously
// and fires this before queuing the load; STACK_NEW_IMAGE fires only on load
// success, so on its own the index lags and a failed load leaves it stale
// forever. Both stay: display can still change VOI (ADR 0003).
// VOLUME_VIEWPORT_NEW_VOLUME: setVolumes() changes numberOfSlices but fires
// no CAMERA_MODIFIED of its own; without it the count stays stale until the
// app happens to move the camera. A Volume's slice index derives from the
// camera, so CAMERA_MODIFIED already covers scrolling.
const ELEMENT_EVENTS = [
  Enums.Events.CAMERA_MODIFIED,
  Enums.Events.VOI_MODIFIED,
  Enums.Events.PRE_STACK_NEW_IMAGE,
  Enums.Events.STACK_NEW_IMAGE,
  Enums.Events.VOLUME_VIEWPORT_NEW_VOLUME,
];

// Only these types map to CS3D's VolumeViewport class, the one with slices.
// VOLUME_3D's class returns null from getSliceIndex and lacks
// getNumberOfSlices entirely (calling it throws).
const SLICED_VOLUME_TYPES: ReadonlySet<string> = new Set([
  Enums.ViewportType.ORTHOGRAPHIC,
  Enums.ViewportType.PERSPECTIVE,
]);

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function camerasEqual(a: Types.ICamera, b: Types.ICamera): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const av = a[key as keyof Types.ICamera];
    const bv = b[key as keyof Types.ICamera];
    if (Array.isArray(av) && Array.isArray(bv)) {
      if (av.length !== bv.length || av.some((v, i) => v !== bv[i])) return false;
    } else if (av !== bv) {
      return false;
    }
  }
  return true;
}

function voiRangesEqual(
  a: Types.VOIRange | undefined,
  b: Types.VOIRange | undefined,
): boolean {
  return a?.lower === b?.lower && a?.upper === b?.upper;
}

function statesEqual(a: ViewportState, b: ViewportState): boolean {
  if (a.kind !== b.kind) return false;
  if (a.sliceIndex !== b.sliceIndex || a.numberOfSlices !== b.numberOfSlices) return false;
  return voiRangesEqual(a.voiRange, b.voiRange) && camerasEqual(a.camera, b.camera);
}

// Structural sharing. A Snapshot is replaced whenever *any* field moves, so
// without this a zoom would hand `s => s.voiRange` a brand-new object and
// re-render a consumer whose value never changed. Unchanged parts keep the
// previous Snapshot's references — those are objects we already cloned and
// froze, so sharing them cannot expose the Engine's own mutable state.
function shareCamera(next: Types.ICamera, prev: Types.ICamera | undefined): Types.ICamera {
  if (prev === undefined) return next;
  if (camerasEqual(next, prev)) return prev;
  // The camera moved, but rarely in every axis: a zoom leaves `position`
  // alone, a pan leaves `viewUp` alone. Share the arrays that held still.
  const mutable = next as unknown as Record<string, unknown>;
  for (const key of Object.keys(next)) {
    const nv = mutable[key];
    const pv = (prev as unknown as Record<string, unknown>)[key];
    if (
      Array.isArray(nv) &&
      Array.isArray(pv) &&
      nv.length === pv.length &&
      nv.every((v, i) => v === pv[i])
    ) {
      mutable[key] = pv;
    }
  }
  return next;
}

function shareVoiRange(
  next: Types.VOIRange | undefined,
  prev: Types.VOIRange | undefined,
): Types.VOIRange | undefined {
  if (next === undefined || prev === undefined) return next;
  return voiRangesEqual(next, prev) ? prev : next;
}

export interface UseViewportStateOptions {
  /** Batch Engine events to at most one update per animation frame. Default true. */
  batch?: boolean;
}

interface Binding {
  subscribe: (onChange: () => void, batch: boolean) => () => void;
  getSnapshot: () => ViewportState | undefined;
}

/**
 * One Binding per viewportId: subscribes to Engine events on the viewport's
 * element while it has consumers, and rebuilds an immutable Snapshot only on
 * those events, so `getSnapshot` is referentially stable (CS3D getters return
 * fresh objects per call; the Snapshot absorbs that).
 */
function createBinding(viewportId: string): Binding {
  const listeners = new Set<() => void>();
  let element: HTMLDivElement | undefined;

  // `prev` is the Snapshot being replaced: whatever did not move is taken
  // from it rather than rebuilt (structural sharing).
  const buildSnapshot = (prev: ViewportState | undefined): ViewportState | undefined => {
    const enabled = getEnabledElementByViewportId(viewportId);
    if (!enabled) return undefined;
    const { viewport } = enabled;
    // structuredClone: getter output may share nested arrays with the Engine;
    // freezing those in place would break Engine-side mutation.
    const camera = shareCamera(structuredClone(viewport.getCamera()), prev?.camera);
    if (viewport.type === Enums.ViewportType.STACK) {
      const stack = viewport as Types.IStackViewport;
      return deepFreeze<ViewportState>({
        kind: 'stack',
        camera,
        // Engine holds null between setStack and image arrival; our contract is undefined.
        voiRange: shareVoiRange(
          structuredClone(stack.getProperties().voiRange) ?? undefined,
          prev?.voiRange,
        ),
        sliceIndex: stack.getSliceIndex(),
        numberOfSlices: stack.getNumberOfSlices(),
      });
    }
    // ponytail: every non-Stack kind reads as 'volume' (camera + VOI is the
    // shared surface); split further kinds if video/WSI state is ever needed.
    const volume = viewport as Types.IVolumeViewport;
    const sliced = SLICED_VOLUME_TYPES.has(viewport.type);
    return deepFreeze<ViewportState>({
      kind: 'volume',
      camera,
      voiRange: shareVoiRange(
        structuredClone(volume.getProperties()?.voiRange) ?? undefined,
        prev?.voiRange,
      ),
      // Engine reports undefined before setVolumes; our contract is undefined too.
      sliceIndex: sliced ? (volume.getSliceIndex() ?? undefined) : undefined,
      numberOfSlices: sliced ? (volume.getNumberOfSlices() ?? undefined) : undefined,
    });
  };

  let snapshot = buildSnapshot(undefined);

  const notify = () => listeners.forEach((listener) => listener());

  const update = () => {
    const next = buildSnapshot(snapshot);
    if (next === snapshot) return;
    if (next && snapshot && statesEqual(next, snapshot)) return;
    snapshot = next;
    notify();
  };

  // Engine events during a drag arrive tens of times per second; batch them
  // to one Snapshot rebuild per frame unless a consumer opted out.
  let rafId: number | undefined;
  let unbatchedCount = 0;

  const cancelPending = () => {
    if (rafId !== undefined) {
      cancelAnimationFrame(rafId);
      rafId = undefined;
    }
  };

  const onEngineEvent = () => {
    if (unbatchedCount > 0) {
      // ponytail: one unbatched consumer makes every consumer of this
      // viewport update synchronously — the Snapshot is shared. Split
      // per-mode if it bites.
      cancelPending();
      update();
      return;
    }
    if (rafId !== undefined) return;
    rafId = requestAnimationFrame(() => {
      rafId = undefined;
      update();
    });
  };

  const attachElement = () => {
    element = getEnabledElementByViewportId(viewportId)?.viewport.element;
    for (const type of ELEMENT_EVENTS) element?.addEventListener(type, onEngineEvent);
  };

  const detachElement = () => {
    for (const type of ELEMENT_EVENTS) element?.removeEventListener(type, onEngineEvent);
    element = undefined;
    // A pending rAF would rebuild from a registry this Binding no longer
    // watches (or resurrect a cleared Snapshot after disable) — drop it.
    cancelPending();
  };

  const onEnabled = (evt: Event) => {
    if ((evt as Types.EventTypes.ElementEnabledEvent).detail.viewportId !== viewportId) return;
    detachElement(); // re-enable may bring a new element for the same id
    attachElement();
    update();
  };

  const onDisabled = (evt: Event) => {
    if ((evt as Types.EventTypes.ElementDisabledEvent).detail.viewportId !== viewportId) return;
    detachElement();
    // ELEMENT_DISABLED fires before registry removal — clear explicitly
    // instead of rebuilding from a registry that still holds the viewport.
    if (snapshot !== undefined) {
      snapshot = undefined;
      notify();
    }
  };

  const attach = () => {
    eventTarget.addEventListener(Enums.Events.ELEMENT_ENABLED, onEnabled);
    eventTarget.addEventListener(Enums.Events.ELEMENT_DISABLED, onDisabled);
    attachElement();
    update(); // state may have moved between render and subscription
  };

  const detach = () => {
    eventTarget.removeEventListener(Enums.Events.ELEMENT_ENABLED, onEnabled);
    eventTarget.removeEventListener(Enums.Events.ELEMENT_DISABLED, onDisabled);
    detachElement();
    // A dormant Binding can't hear disable events; a kept Snapshot could be
    // served stale to the next consumer's first render. Absence until the
    // subscribe-time update() is the honest state (ADR 0002).
    snapshot = undefined;
  };

  return {
    subscribe: (onChange, batch) => {
      if (listeners.size === 0) attach();
      listeners.add(onChange);
      if (!batch) unbatchedCount++;
      return () => {
        listeners.delete(onChange);
        if (!batch) unbatchedCount--;
        if (listeners.size === 0) detach();
      };
    },
    getSnapshot: () => snapshot,
  };
}

// ponytail: Bindings live for the session once created; evict at zero
// consumers if viewportId churn ever matters.
const bindings = new Map<string, Binding>();

/**
 * Reads the Viewport State for a viewport resolved via the CS3D global
 * registry (ADR 0002). Absence is a normal state: returns `undefined`
 * when the viewport does not exist (yet).
 *
 * With a selector, the component re-renders only when the selected value
 * changes (Object.is). The selector is never called while the viewport is
 * absent — the hook returns `undefined` instead.
 */
export function useViewportState(
  viewportId: string,
  selector?: undefined,
  options?: UseViewportStateOptions,
): ViewportState | undefined;
export function useViewportState<T>(
  viewportId: string,
  selector: (state: ViewportState) => T,
  options?: UseViewportStateOptions,
): T | undefined;
export function useViewportState<T>(
  viewportId: string,
  selector?: (state: ViewportState) => T,
  { batch = true }: UseViewportStateOptions = {},
): T | ViewportState | undefined {
  let binding = bindings.get(viewportId);
  if (!binding) {
    binding = createBinding(viewportId);
    bindings.set(viewportId, binding);
  }
  const { subscribe: bindingSubscribe, getSnapshot } = binding;
  const subscribe = useCallback(
    (onChange: () => void) => bindingSubscribe(onChange, batch),
    [bindingSubscribe, batch],
  );

  // useSyncExternalStore has no native selector support: it re-renders
  // whenever getSnapshot's result changes by Object.is. So getSnapshot here
  // returns the *selected* value, memoized per (Snapshot, selector) and kept
  // referentially stable while Object.is-equal.
  // ponytail: equality is Object.is only — a selector deriving a fresh object
  // per call still re-renders on every Engine event (no loop; the memo keeps
  // within-render reads consistent). Add an isEqual param if that bites.
  const memo = useRef<{
    snapshot: ViewportState | undefined;
    selector: typeof selector;
    selected: T | ViewportState | undefined;
  }>(undefined);

  return useSyncExternalStore(subscribe, () => {
    const snapshot = getSnapshot();
    const prev = memo.current;
    if (prev && prev.snapshot === snapshot && prev.selector === selector) return prev.selected;
    let selected =
      snapshot === undefined ? undefined : selector ? selector(snapshot) : snapshot;
    if (prev && Object.is(prev.selected, selected)) selected = prev.selected;
    memo.current = { snapshot, selector, selected };
    return selected;
  });
}
