import { Enums, cache, eventTarget } from '@cornerstonejs/core';
import { act, cleanup } from '@testing-library/react';
import { createElement, StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, vi } from 'vitest';

// jsdom harness for the cache Bindings. The test file mocks
// `cache.isLoaded` to read `loaded` and, where it reads the size,
// `cache.getCacheSize` to read `cacheSize.bytes`; events go through the real
// eventTarget. Payloads mirror CS3D 5.10.7: ADDED carries the cached image
// (`detail.image.imageId`), REMOVED and LOAD_FAILED carry the id
// (`detail.imageId`). The size moves before ADDED/REMOVED fire, as the real
// cache's does. A failure leaves the cache as it was.

export const loaded = new Set<string>();
export const cacheSize = { bytes: 0 };

/**
 * Per-test setup for a file that has mocked `cache.isLoaded` (the `vi.mock`
 * itself must stay in the test file — it is hoisted per module).
 */
export function installFakeCache() {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    vi.mocked(cache.isLoaded).mockImplementation((imageId) => loaded.has(imageId));
    if (vi.isMockFunction(cache.getCacheSize)) {
      vi.mocked(cache.getCacheSize).mockImplementation(() => cacheSize.bytes);
    }
  });
  afterEach(() => {
    cleanup(); // unmount before the fake clock goes away (shared scheduler)
    vi.useRealTimers();
    loaded.clear();
    cacheSize.bytes = 0;
    vi.mocked(cache.isLoaded).mockReset();
    if (vi.isMockFunction(cache.getCacheSize)) vi.mocked(cache.getCacheSize).mockReset();
  });
}

export const strictModeWrapper = ({ children }: { children: ReactNode }) =>
  createElement(StrictMode, null, children);

export const fireRawAdded = (imageId: string, bytes = 0) =>
  act(() => {
    loaded.add(imageId);
    cacheSize.bytes += bytes;
    eventTarget.dispatchEvent(
      new CustomEvent(Enums.Events.IMAGE_CACHE_IMAGE_ADDED, { detail: { image: { imageId } } }),
    );
  });

export const fireRawRemoved = (imageId: string, bytes = 0) =>
  act(() => {
    loaded.delete(imageId);
    cacheSize.bytes -= bytes;
    eventTarget.dispatchEvent(
      new CustomEvent(Enums.Events.IMAGE_CACHE_IMAGE_REMOVED, { detail: { imageId } }),
    );
  });

export const fireRawFailed = (imageId: string) =>
  act(() => {
    eventTarget.dispatchEvent(
      new CustomEvent(Enums.Events.IMAGE_LOAD_FAILED, {
        detail: { imageId, error: new Error('fake load failure') },
      }),
    );
  });

export const endFrame = () => act(() => vi.advanceTimersToNextFrame());

export const added = (imageId: string, bytes = 0) => {
  fireRawAdded(imageId, bytes);
  endFrame();
};

export const removed = (imageId: string, bytes = 0) => {
  fireRawRemoved(imageId, bytes);
  endFrame();
};

export const failed = (imageId: string) => {
  fireRawFailed(imageId);
  endFrame();
};

// Counts the cache-event listeners — the image dispatcher's and the Cache
// State Binding's alike, so a test counts one kind by mounting only that
// kind — not the viewport Binding's lifecycle ones.
const CACHE_EVENTS = new Set<string>([
  Enums.Events.IMAGE_CACHE_IMAGE_ADDED,
  Enums.Events.IMAGE_CACHE_IMAGE_REMOVED,
  Enums.Events.IMAGE_LOAD_FAILED,
]);

export function spyCacheListeners() {
  const add = vi.spyOn(eventTarget, 'addEventListener');
  const remove = vi.spyOn(eventTarget, 'removeEventListener');
  const count = (spy: typeof add) =>
    spy.mock.calls.filter(([type]) => CACHE_EVENTS.has(type)).length;
  return {
    added: () => count(add),
    removed: () => count(remove),
    restore: () => {
      add.mockRestore();
      remove.mockRestore();
    },
  };
}
