import type { Types } from '@cornerstonejs/core';
import { Enums, cache, eventTarget } from '@cornerstonejs/core';
import { createRegistry, useBinding, type Binding } from './binding';

/**
 * One image's Image Load State: `'loaded'` when the cache has it, `'failed'`
 * when a load failure was heard while someone was listening and the cache
 * has not had it since, `'absent'` otherwise (see `useImageLoadState`).
 */
export type ImageLoadState = 'absent' | 'loaded' | 'failed';

// One set of listeners for every image Binding, routed by imageId (ADR 0007).
//
// CS3D's eventTarget keeps its listeners in a plain array: addEventListener
// does an indexOf, removeEventListener a linear scan and splice, and
// dispatchEvent copies the array with slice(). A listener per image Binding
// would make a setStack of N slices O(N²) in registration alone, and every
// cache event O(N) to dispatch. So the library listens once and looks the
// Bindings up in a Map of the live ones. Attached with the first live image
// Binding, detached with the last. Revisit if a CS3D major changes
// eventTarget's storage.
//
// A Set per id, not one Binding: the registry keeps one Binding per key,
// but a Binding evicted and then subscribed again by the same hook instance
// is live outside the registry while a newer one holds the key. Both must
// hear the cache, and neither may take the listeners down for the other.
const live = new Map<string, Set<ImageHandlers>>();

// What one live image Binding does with each event the dispatcher routes to it.
interface ImageHandlers {
  readonly added: () => void;
  readonly removed: () => void;
  readonly failed: () => void;
}

const route = (imageId: string, event: keyof ImageHandlers) =>
  live.get(imageId)?.forEach((handlers) => handlers[event]());
const onAdded = (evt: Event) =>
  route((evt as Types.EventTypes.ImageCacheImageAddedEvent).detail.image.imageId, 'added');
const onRemoved = (evt: Event) =>
  route((evt as Types.EventTypes.ImageCacheImageRemovedEvent).detail.imageId, 'removed');
// CS3D 5.10.7 fires IMAGE_LOAD_FAILED { imageId, error } on eventTarget from
// one site (imageLoader handleImageLoadPromise) on every load path, after the
// cache has deleted the entry. IMAGE_LOAD_ERROR is not heard: Stack/Volume
// only, untyped, and fired once or twice more for the same failure.
const onFailed = (evt: Event) =>
  route((evt as Types.EventTypes.ImageLoadedFailedEvent).detail.imageId, 'failed');

const LISTENERS = [
  [Enums.Events.IMAGE_CACHE_IMAGE_ADDED, onAdded],
  [Enums.Events.IMAGE_CACHE_IMAGE_REMOVED, onRemoved],
  [Enums.Events.IMAGE_LOAD_FAILED, onFailed],
] as const;

const dispatcher = {
  add(imageId: string, handlers: ImageHandlers) {
    if (live.size === 0) {
      for (const [type, listener] of LISTENERS) eventTarget.addEventListener(type, listener);
    }
    let forId = live.get(imageId);
    if (!forId) live.set(imageId, (forId = new Set()));
    forId.add(handlers);
  },
  remove(imageId: string, handlers: ImageHandlers) {
    const forId = live.get(imageId);
    if (!forId) return;
    forId.delete(handlers);
    if (forId.size === 0) live.delete(imageId);
    if (live.size === 0) {
      for (const [type, listener] of LISTENERS) eventTarget.removeEventListener(type, listener);
    }
  },
};

/**
 * One Binding per imageId, alive while it has consumers. Its Snapshot is the
 * cache's answer to `isLoaded(imageId)` (ADR 0007), plus one thing the cache
 * does not keep: a load failure this Binding heard. That memory is a field
 * only because the Engine's next word about the image after a failure is
 * ADDED or another FAILED, both heard here (ADR 0009). The getter wins: a
 * failure heard while the cache has the image is ignored.
 *
 * @internal Exported for tests and for `useImageLoadStates`.
 */
export const imageBindings = createRegistry<ImageLoadState>((imageId, binding) => {
  let heardFailure = false;
  // Each Binding rebuilds next frame with every other dirty Binding (ADR 0006).
  const handlers: ImageHandlers = {
    added: () => {
      heardFailure = false;
      binding.schedule();
    },
    removed: binding.schedule,
    failed: () => {
      if (cache.isLoaded(imageId)) return; // the getter wins
      heardFailure = true;
      binding.schedule();
    },
  };
  return {
    build: () => (cache.isLoaded(imageId) ? 'loaded' : heardFailure ? 'failed' : 'absent'),
    attach: () => {
      dispatcher.add(imageId, handlers);
      binding.update(); // the cache may have moved between render and subscription
    },
    detach: () => {
      // A queued rebuild would run for a Binding nobody reads — drop it.
      binding.unschedule();
      dispatcher.remove(imageId, handlers);
      // Unheard from here on, so the memory goes with the consumers (ADR 0009).
      heardFailure = false;
    },
  };
});

// The Binding for "no image": nothing to subscribe to, nothing to read.
const NONE: Binding<ImageLoadState | undefined> = {
  subscribe: () => () => {},
  getSnapshot: () => undefined,
};

/**
 * Whether one image is in the cache, as the cache module reports it. It is
 * the cache's word, not the viewport's: an image can be loaded and not yet on
 * any canvas.
 *
 * `'loaded'` when the cache has it. `'failed'` when a load of it failed while
 * this hook (or another reading the same image) was mounted and the cache
 * has not had it since; a retry has no start event, so it stays `'failed'`
 * until the image arrives or fails again. `'absent'` otherwise — never
 * requested, evicted, or failed before anyone listened. `undefined` when
 * there is no image to ask about (`imageId` is `undefined`, e.g. a Volume
 * pointing at nothing). Compare with `=== 'loaded'`: every state is truthy.
 * Loading-in-progress is not a state the cache can report (ADR 0007).
 */
export function useImageLoadState(imageId: string | undefined): ImageLoadState | undefined {
  return useBinding(imageId === undefined ? NONE : imageBindings.acquire(imageId), undefined);
}
