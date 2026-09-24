import { Enums, cache, eventTarget } from '@cornerstonejs/core';
import { act, cleanup } from '@testing-library/react';
import { createElement, StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, vi } from 'vitest';

// jsdom harness for the image Bindings. The test file mocks
// `cache.isLoaded` to read `loaded`; events go through the real eventTarget.
// Payloads mirror CS3D 5.10.7: ADDED carries the cached image
// (`detail.image.imageId`), REMOVED carries the id (`detail.imageId`).

export const loaded = new Set<string>();

/**
 * Per-test setup for a file that has mocked `cache.isLoaded` (the `vi.mock`
 * itself must stay in the test file — it is hoisted per module).
 */
export function installFakeCache() {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
    vi.mocked(cache.isLoaded).mockImplementation((imageId) => loaded.has(imageId));
  });
  afterEach(() => {
    cleanup(); // unmount before the fake clock goes away (shared scheduler)
    vi.useRealTimers();
    loaded.clear();
    vi.mocked(cache.isLoaded).mockReset();
  });
}

export const strictModeWrapper = ({ children }: { children: ReactNode }) =>
  createElement(StrictMode, null, children);

export const fireRawAdded = (imageId: string) =>
  act(() => {
    loaded.add(imageId);
    eventTarget.dispatchEvent(
      new CustomEvent(Enums.Events.IMAGE_CACHE_IMAGE_ADDED, { detail: { image: { imageId } } }),
    );
  });

export const fireRawRemoved = (imageId: string) =>
  act(() => {
    loaded.delete(imageId);
    eventTarget.dispatchEvent(
      new CustomEvent(Enums.Events.IMAGE_CACHE_IMAGE_REMOVED, { detail: { imageId } }),
    );
  });

export const endFrame = () => act(() => vi.advanceTimersToNextFrame());

export const added = (imageId: string) => {
  fireRawAdded(imageId);
  endFrame();
};

export const removed = (imageId: string) => {
  fireRawRemoved(imageId);
  endFrame();
};

// Counts only the dispatcher's listeners, not the viewport Binding's lifecycle ones.
const CACHE_EVENTS = new Set<string>([
  Enums.Events.IMAGE_CACHE_IMAGE_ADDED,
  Enums.Events.IMAGE_CACHE_IMAGE_REMOVED,
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
