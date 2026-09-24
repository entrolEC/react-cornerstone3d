import type { Types } from '@cornerstonejs/core';
import { cache, imageLoader, init as csInit } from '@cornerstonejs/core';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { useImageLoadState } from './index';

// Smoke tests against the real cache module. They verify what the jsdom fakes
// assume: which events the cache fires, when, and with what payloads.
// IMAGE_CACHE_IMAGE_ADDED must carry `detail.image.imageId`, _REMOVED
// `detail.imageId` — the dispatcher routes on exactly those.

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
});

afterEach(() => {
  cleanup();
  cache.purgeCache();
});

test('loaded follows the real cache: false, true after loadAndCacheImage, false after removal', async () => {
  const imageId = 'cachesmoke:0';
  const { result } = renderHook(() => useImageLoadState(imageId));
  expect(result.current).toBe(false);

  await imageLoader.loadAndCacheImage(imageId);
  expect(cache.isLoaded(imageId)).toBe(true); // the getter the Snapshot reads
  await waitFor(() => expect(result.current).toBe(true));

  cache.removeImageLoadObject(imageId);
  await waitFor(() => expect(result.current).toBe(false));
});

test('a failed load leaves no cache entry: the hook says false, same as never requested', async () => {
  const imageId = 'cachefail:0';
  const { result } = renderHook(() => useImageLoadState(imageId));

  // CS3D chains a .then with no catch onto the loader promise, so the
  // rejection also surfaces as unhandled — swallow it for this test.
  const swallow = (evt: PromiseRejectionEvent) => evt.preventDefault();
  window.addEventListener('unhandledrejection', swallow);
  try {
    await imageLoader.loadAndCacheImage(imageId).catch(() => undefined);
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
  } finally {
    window.removeEventListener('unhandledrejection', swallow);
  }

  expect(cache.getImageLoadObject(imageId)).toBeUndefined(); // entry deleted, silently
  expect(result.current).toBe(false);
});

test('an image cached before the hook mounts reads true on the first render', async () => {
  const imageId = 'cachesmoke:pre';
  await imageLoader.loadAndCacheImage(imageId);

  const seen: unknown[] = [];
  renderHook(() => {
    seen.push(useImageLoadState(imageId));
  });
  expect(seen[0]).toBe(true);
});
