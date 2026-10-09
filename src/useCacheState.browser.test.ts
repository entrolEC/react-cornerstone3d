import { Enums, cache, eventTarget, imageLoader, init as csInit } from '@cornerstonejs/core';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { useCacheState } from './index';
import { COLS, ROWS, smokeImageLoader } from './testing/smokeStack';

// Smoke tests against the real cache module. They verify what the jsdom fakes
// assume: `getCacheSize()` counts the bytes of cached images, and
// IMAGE_CACHE_IMAGE_ADDED / _REMOVED fire after that count has moved.

const BYTES = ROWS * COLS;

beforeAll(async () => {
  await csInit();
  imageLoader.registerImageLoader('sizesmoke', smokeImageLoader);
});

beforeEach(() => cache.purgeCache());

afterEach(() => {
  cleanup();
  cache.purgeCache();
});

// The size the cache reports at the moment each event of `type` is dispatched.
function sizesAtDispatch(type: string) {
  const sizes: number[] = [];
  const listen = () => sizes.push(cache.getCacheSize());
  eventTarget.addEventListener(type, listen);
  return { sizes, stop: () => eventTarget.removeEventListener(type, listen) };
}

test('follows the real cache: the bytes of N loaded images, then 0 after purgeCache', async () => {
  const { result } = renderHook(() => useCacheState());
  expect(result.current).toEqual({ imageBytes: 0 });

  const ids = ['sizesmoke:0', 'sizesmoke:1', 'sizesmoke:2'];
  const added = sizesAtDispatch(Enums.Events.IMAGE_CACHE_IMAGE_ADDED);
  for (const id of ids) await imageLoader.loadAndCacheImage(id);
  added.stop();

  expect(added.sizes).toEqual([BYTES, 2 * BYTES, 3 * BYTES]); // fired after the size moved
  expect(cache.getCacheSize()).toBe(ids.length * BYTES);
  await waitFor(() => expect(result.current.imageBytes).toBe(cache.getCacheSize()));

  const removed = sizesAtDispatch(Enums.Events.IMAGE_CACHE_IMAGE_REMOVED);
  cache.purgeCache();
  removed.stop();

  // Twice per image (removeImageLoadObject, then purgeCache itself), each after the decrement.
  expect(removed.sizes).toEqual([2 * BYTES, 2 * BYTES, BYTES, BYTES, 0, 0]);
  expect(cache.getCacheSize()).toBe(0);
  await waitFor(() => expect(result.current.imageBytes).toBe(0));
});

test('a size reached before the hook mounts is read on the first render', async () => {
  await imageLoader.loadAndCacheImage('sizesmoke:pre');

  const seen: number[] = [];
  renderHook(() => {
    seen.push(useCacheState().imageBytes);
  });
  expect(seen[0]).toBe(BYTES);
});
