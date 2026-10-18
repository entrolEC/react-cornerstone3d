import { Enums, cache, eventTarget } from '@cornerstonejs/core';
import { createBinding, useBinding, type Binding } from './binding.js';

/** What the cache module reports holding (see `useCacheState`). */
export interface CacheState {
  readonly imageBytes: number;
}

// CS3D 5.10.7: getCacheSize() is the image byte counter, which
// _putImageCommon / removeImageLoadObject move before firing ADDED / REMOVED.
const LISTENERS = [
  Enums.Events.IMAGE_CACHE_IMAGE_ADDED,
  Enums.Events.IMAGE_CACHE_IMAGE_REMOVED,
] as const;

// The empty cache, one object: the server's value (nothing is cached there)
// and the client's whenever the size is 0, so hydration finds them equal.
const EMPTY: CacheState = Object.freeze({ imageBytes: 0 });

let attached = false;
let rebuild!: () => void;

// One cache, so one Binding and no registry: it outlives its consumers and
// only its listeners come and go with them.
const inner = createBinding<CacheState>((self) => {
  rebuild = self.update;
  return {
    build: (prev) => {
      const imageBytes = cache.getCacheSize();
      if (prev && prev.imageBytes === imageBytes) return prev;
      return imageBytes === 0 ? EMPTY : Object.freeze({ imageBytes });
    },
    attach: () => {
      attached = true;
      for (const type of LISTENERS) eventTarget.addEventListener(type, self.schedule);
      self.update(); // the cache may have moved between render and subscription
    },
    detach: () => {
      attached = false;
      // A queued rebuild would run for a Binding nobody reads — drop it.
      self.unschedule();
      for (const type of LISTENERS) eventTarget.removeEventListener(type, self.schedule);
    },
  };
});

// The Snapshot was built at import and nothing keeps it current while nobody
// listens, so a render with no consumer attached reads the getter first. The
// one exception to "a detached Binding does not read the Engine": a getter
// call during render, with no one to notify. `build` keeps the previous
// object when the size is the same, so repeated reads are stable.
const cacheBinding: Binding<CacheState> = {
  subscribe: inner.subscribe,
  getSnapshot: () => {
    if (!attached) rebuild();
    return inner.getSnapshot();
  },
};

/**
 * What the cache module reports holding. `imageBytes` is `cache.getCacheSize()`:
 * the bytes of cached images as the cache counts them — volumes are not in it.
 * Rebuilt on `IMAGE_CACHE_IMAGE_ADDED` / `_REMOVED`, at most once a frame, and
 * replaced only when the number moved. Never `undefined`: the cache always
 * exists; on the server, `{ imageBytes: 0 }`.
 *
 * Not here: the maximum (`setMaxCacheSize` fires no event — the app set it, so
 * the app knows it) and image or volume counts (no getter) — ADR 0007. One
 * known silent path: progressive loading's `setPartialImage` lowers the size
 * without an event, so the value can read slightly high until the next cache
 * event.
 */
export function useCacheState(): CacheState {
  return useBinding(cacheBinding, undefined, EMPTY) as CacheState;
}
