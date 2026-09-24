import type { Types } from '@cornerstonejs/core';
import { Enums, eventTarget, getEnabledElementByViewportId } from '@cornerstonejs/core';
import { createRegistry, deepFreeze, useBinding } from './binding';

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
  /**
   * The image the viewport points at, as the Engine reports it: `undefined`
   * when it points at none (3D, or a Volume before its data arrives). For a
   * Volume this is the image closest to the camera. Join it with
   * `useImageLoadState` to ask whether that image is in the cache.
   */
  readonly currentImageId: string | undefined;
}

/** Observable state of one Stack viewport. Immutable Snapshot (deep-frozen). */
export interface StackViewportState extends ViewportStateCommon {
  readonly kind: 'stack';
  /** The requested slice (ADR 0003); a Stack always reports a number. */
  readonly sliceIndex: number;
  readonly numberOfSlices: number;
  /** The requested slice's image — `imageIds[sliceIndex]`. */
  readonly currentImageId: string;
  /**
   * The stack's image list. Replaced only when `setStack` changes its
   * content; a scroll or a zoom keeps the same array reference.
   */
  readonly imageIds: readonly string[];
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
// forever. Both stay: display can still change VOI (ADR 0003). It also
// covers imageIds: every setStack path ends in _setImageIdIndex and fires it.
// (STACK_VIEWPORT_NEW_STACK is declared but never fired in CS3D 5.10.7.)
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

function imageIdsEqual(a: readonly string[], b: readonly string[]): boolean {
  return a === b || (a.length === b.length && a.every((id, i) => id === b[i]));
}

function statesEqual(a: ViewportState, b: ViewportState): boolean {
  if (a.kind !== b.kind) return false;
  if (a.sliceIndex !== b.sliceIndex || a.numberOfSlices !== b.numberOfSlices) return false;
  if (a.currentImageId !== b.currentImageId) return false;
  if (a.kind === 'stack' && b.kind === 'stack' && !imageIdsEqual(a.imageIds, b.imageIds)) {
    return false;
  }
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

// A scroll rebuilds the Snapshot but not the stack: keep the list a
// `s => s.imageIds` consumer already holds unless its content changed.
function shareImageIds(next: readonly string[], prev: readonly string[] | undefined) {
  if (prev === undefined) return next;
  return imageIdsEqual(next, prev) ? prev : next;
}

// `prev` is the Snapshot being replaced: whatever did not move is taken
// from it rather than rebuilt (structural sharing).
function buildSnapshot(
  viewportId: string,
  prev: ViewportState | undefined,
): ViewportState | undefined {
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
      currentImageId: stack.getCurrentImageId(),
      // getImageIds returns the Engine's own array: copy before freezing.
      imageIds: shareImageIds(
        [...stack.getImageIds()],
        prev?.kind === 'stack' ? prev.imageIds : undefined,
      ),
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
    // The 3D class returns null (typed as string); ours is undefined either way.
    currentImageId: volume.getCurrentImageId() ?? undefined,
  });
}

/**
 * One Binding per viewportId, alive while it has consumers (ADR 0007):
 * subscribes to Engine events on the viewport's element and rebuilds an
 * immutable Snapshot only on those events, so `getSnapshot` is referentially
 * stable (CS3D getters return fresh objects per call; the Snapshot absorbs that).
 *
 * @internal Exported for tests.
 */
export const viewportBindings = createRegistry<ViewportState | undefined>((viewportId, binding) => {
  let element: HTMLDivElement | undefined;

  // Engine events during a drag arrive tens of times per second; the shared
  // scheduler coalesces them to one Snapshot rebuild per frame, in the same
  // pass as every other Binding's. There is no opt-out: the frame is the
  // unit of consistency (ADR 0006).
  const onEngineEvent = () => binding.schedule();

  const attachElement = () => {
    element = getEnabledElementByViewportId(viewportId)?.viewport.element;
    for (const type of ELEMENT_EVENTS) element?.addEventListener(type, onEngineEvent);
  };

  const detachElement = () => {
    for (const type of ELEMENT_EVENTS) element?.removeEventListener(type, onEngineEvent);
    element = undefined;
    // A queued rebuild would read a registry this Binding no longer watches
    // (or resurrect a cleared Snapshot after disable) — drop it.
    binding.unschedule();
  };

  const onEnabled = (evt: Event) => {
    if ((evt as Types.EventTypes.ElementEnabledEvent).detail.viewportId !== viewportId) return;
    detachElement(); // re-enable may bring a new element for the same id
    attachElement();
    binding.update();
  };

  const onDisabled = (evt: Event) => {
    if ((evt as Types.EventTypes.ElementDisabledEvent).detail.viewportId !== viewportId) return;
    detachElement();
    // ELEMENT_DISABLED fires before registry removal — clear explicitly
    // instead of rebuilding from a registry that still holds the viewport.
    binding.set(undefined);
  };

  return {
    build: (prev) => buildSnapshot(viewportId, prev),
    equal: (a, b) => a !== undefined && b !== undefined && statesEqual(a, b),
    attach: () => {
      eventTarget.addEventListener(Enums.Events.ELEMENT_ENABLED, onEnabled);
      eventTarget.addEventListener(Enums.Events.ELEMENT_DISABLED, onDisabled);
      attachElement();
      binding.update(); // state may have moved between render and subscription
    },
    detach: () => {
      eventTarget.removeEventListener(Enums.Events.ELEMENT_ENABLED, onEnabled);
      eventTarget.removeEventListener(Enums.Events.ELEMENT_DISABLED, onDisabled);
      detachElement();
      // A dormant Binding can't hear disable events; a kept Snapshot could be
      // served stale to the next consumer's first render. Absence until the
      // subscribe-time update() is the honest state (ADR 0002).
      binding.set(undefined);
    },
  };
});

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
): ViewportState | undefined;
export function useViewportState<T>(
  viewportId: string,
  selector: (state: ViewportState) => T,
): T | undefined;
export function useViewportState<T>(
  viewportId: string,
  selector?: (state: ViewportState) => T,
): T | ViewportState | undefined {
  return useBinding(viewportBindings.acquire(viewportId), selector);
}
