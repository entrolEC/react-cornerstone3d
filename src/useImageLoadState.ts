import type { Types } from '@cornerstonejs/core';
import { Enums, cache, eventTarget } from '@cornerstonejs/core';
import { createRegistry, useBinding, type Binding, type LiveBinding } from './binding';

// One listener pair for every image Binding, routed by imageId (ADR 0007).
//
// CS3D's eventTarget keeps its listeners in a plain array: addEventListener
// does an indexOf, removeEventListener a linear scan and splice, and
// dispatchEvent copies the array with slice(). A listener per image Binding
// would make a setStack of N slices O(N²) in registration alone, and every
// cache event O(N) to dispatch. So the library listens once and looks the
// Binding up in a Map. Attached with the first live image Binding, detached
// with the last. Revisit if a CS3D major changes eventTarget's storage.
const live = new Map<string, LiveBinding<boolean>>();

// The Binding rebuilds next frame with every other dirty Binding (ADR 0006).
const route = (imageId: string) => live.get(imageId)?.schedule();
const onAdded = (evt: Event) =>
  route((evt as Types.EventTypes.ImageCacheImageAddedEvent).detail.image.imageId);
const onRemoved = (evt: Event) =>
  route((evt as Types.EventTypes.ImageCacheImageRemovedEvent).detail.imageId);

const dispatcher = {
  add(imageId: string, binding: LiveBinding<boolean>) {
    if (live.size === 0) {
      eventTarget.addEventListener(Enums.Events.IMAGE_CACHE_IMAGE_ADDED, onAdded);
      eventTarget.addEventListener(Enums.Events.IMAGE_CACHE_IMAGE_REMOVED, onRemoved);
    }
    live.set(imageId, binding);
  },
  remove(imageId: string) {
    live.delete(imageId);
    if (live.size === 0) {
      eventTarget.removeEventListener(Enums.Events.IMAGE_CACHE_IMAGE_ADDED, onAdded);
      eventTarget.removeEventListener(Enums.Events.IMAGE_CACHE_IMAGE_REMOVED, onRemoved);
    }
  },
};

/**
 * One Binding per imageId, alive while it has consumers. Its Snapshot is the
 * cache's answer to `isLoaded(imageId)`: `false` for an image the cache does
 * not know, whether never requested or failed and dropped (ADR 0007).
 *
 * @internal Exported for tests and for `useImageLoadStates`.
 */
export const imageBindings = createRegistry<boolean>((imageId, binding) => ({
  build: () => cache.isLoaded(imageId),
  attach: () => {
    dispatcher.add(imageId, binding);
    binding.update(); // the cache may have moved between render and subscription
  },
  detach: () => {
    // A queued rebuild would run for a Binding nobody reads — drop it.
    binding.unschedule();
    dispatcher.remove(imageId);
  },
}));

// The Binding for "no image": nothing to subscribe to, nothing to read.
const NONE: Binding<boolean | undefined> = {
  subscribe: () => () => {},
  getSnapshot: () => undefined,
};

/**
 * Whether one image is in the cache, as the cache module reports it. It is
 * the cache's word, not the viewport's: an image can be loaded and not yet on
 * any canvas.
 *
 * Two absences are distinct: `undefined` when there is no image to ask about
 * (`imageId` is `undefined`, e.g. a Volume pointing at nothing), `false` when
 * the cache was asked and does not have it. Loading-in-progress and failure
 * are not states the cache can report (ADR 0007); listen to CS3D's
 * `eventTarget` for those.
 */
export function useImageLoadState(imageId: string | undefined): boolean | undefined {
  return useBinding(imageId === undefined ? NONE : imageBindings.acquire(imageId), undefined);
}
