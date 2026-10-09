import type { Types } from '@cornerstonejs/core';
import { Enums, cache, eventTarget, imageLoader, init as csInit } from '@cornerstonejs/core';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { useImageLoadState, useImageLoadStates } from './index';

// Smoke tests against the real cache module. They verify what the jsdom fakes
// assume: which events the cache fires, when, and with what payloads.
// IMAGE_CACHE_IMAGE_ADDED must carry `detail.image.imageId`, _REMOVED and
// IMAGE_LOAD_FAILED `detail.imageId` — the dispatcher routes on exactly
// those — and a failed load must leave no cache entry behind.

function fakeImage(imageId: string): Types.IImage {
  const pixelData = new Uint8Array(16 * 16);
  return {
    imageId,
    rows: 16,
    columns: 16,
    sizeInBytes: pixelData.byteLength,
    getPixelData: () => pixelData,
  } as unknown as Types.IImage;
}

beforeAll(async () => {
  await csInit();
  imageLoader.registerImageLoader('cachesmoke', ((imageId: string) => ({
    promise: Promise.resolve(fakeImage(imageId)),
  })) as unknown as Types.ImageLoaderFn);
  imageLoader.registerImageLoader('cachefail', (() => ({
    promise: Promise.reject(new Error('smoke: image load failure')),
  })) as unknown as Types.ImageLoaderFn);
  // Fails the first request for each id, succeeds after: a retry.
  const tried = new Set<string>();
  imageLoader.registerImageLoader('cacheflaky', ((imageId: string) => {
    if (tried.has(imageId)) return { promise: Promise.resolve(fakeImage(imageId)) };
    tried.add(imageId);
    return { promise: Promise.reject(new Error('smoke: first attempt fails')) };
  }) as unknown as Types.ImageLoaderFn);
});

// CS3D chains a .then with no catch onto the loader promise, so a rejection
// also surfaces as unhandled — swallow it while the load fails.
async function loadExpectingFailure(imageId: string) {
  const swallow = (evt: PromiseRejectionEvent) => evt.preventDefault();
  window.addEventListener('unhandledrejection', swallow);
  try {
    await imageLoader.loadAndCacheImage(imageId).catch(() => undefined);
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  } finally {
    window.removeEventListener('unhandledrejection', swallow);
  }
}

afterEach(() => {
  cleanup();
  cache.purgeCache();
});

test('follows the real cache: absent, loaded after loadAndCacheImage, absent after removal', async () => {
  const imageId = 'cachesmoke:0';
  const { result } = renderHook(() => useImageLoadState(imageId));
  expect(result.current).toBe('absent');

  await imageLoader.loadAndCacheImage(imageId);
  expect(cache.isLoaded(imageId)).toBe(true); // the getter the Snapshot reads
  await waitFor(() => expect(result.current).toBe('loaded'));

  cache.removeImageLoadObject(imageId);
  await waitFor(() => expect(result.current).toBe('absent'));
});

test('a failed load leaves no cache entry, and the hook reads failed', async () => {
  const imageId = 'cachefail:0';
  const { result } = renderHook(() => useImageLoadState(imageId));
  expect(result.current).toBe('absent');
  const heard: unknown[] = [];
  const listen = (evt: Event) => heard.push((evt as CustomEvent).detail);
  eventTarget.addEventListener(Enums.Events.IMAGE_LOAD_FAILED, listen);

  await loadExpectingFailure(imageId);
  eventTarget.removeEventListener(Enums.Events.IMAGE_LOAD_FAILED, listen);

  // The payload the dispatcher routes on, fired once on the global eventTarget.
  expect(heard).toEqual([{ imageId, error: expect.any(Error) }]);
  expect(cache.getImageLoadObject(imageId)).toBeUndefined(); // entry deleted, silently
  expect(cache.isLoaded(imageId)).toBe(false);
  await waitFor(() => expect(result.current).toBe('failed'));
});

test('a retry that succeeds turns failed into loaded with no library call between', async () => {
  const imageId = 'cacheflaky:0';
  const { result } = renderHook(() => useImageLoadState(imageId));

  await loadExpectingFailure(imageId);
  await waitFor(() => expect(result.current).toBe('failed'));

  await imageLoader.loadAndCacheImage(imageId);
  await waitFor(() => expect(result.current).toBe('loaded'));
});

test('an image cached before the hook mounts reads loaded on the first render', async () => {
  const imageId = 'cachesmoke:pre';
  await imageLoader.loadAndCacheImage(imageId);

  const seen: unknown[] = [];
  renderHook(() => {
    seen.push(useImageLoadState(imageId));
  });
  expect(seen[0]).toBe('loaded');
});

test('useImageLoadStates follows the real cache per entry', async () => {
  const ids = ['cachesmoke:a', 'cachesmoke:b', 'cachesmoke:c'];
  const { result } = renderHook(() => useImageLoadStates(ids));
  expect(result.current).toEqual(['absent', 'absent', 'absent']);

  await imageLoader.loadAndCacheImage('cachesmoke:b');
  await waitFor(() => expect(result.current).toEqual(['absent', 'loaded', 'absent']));

  await imageLoader.loadAndCacheImage('cachesmoke:c');
  await waitFor(() => expect(result.current).toEqual(['absent', 'loaded', 'loaded']));

  cache.removeImageLoadObject('cachesmoke:b');
  await waitFor(() => expect(result.current).toEqual(['absent', 'absent', 'loaded']));
});
