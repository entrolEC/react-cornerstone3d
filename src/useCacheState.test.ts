import { renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useCacheState } from './index';
import {
  added,
  cacheSize,
  endFrame,
  fireRawAdded,
  installFakeCache,
  removed,
  spyCacheListeners,
  strictModeWrapper,
} from './testing/imageCache';

// Real module loads; the cache module's `getCacheSize` (and `isLoaded`, which
// the shared harness drives) are replaced so tests can set the size the cache
// reports. Events go through the real eventTarget.
vi.mock('@cornerstonejs/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cornerstonejs/core')>();
  return {
    ...actual,
    cache: { ...actual.cache, isLoaded: vi.fn(), getCacheSize: vi.fn() },
  };
});

installFakeCache();

describe('useCacheState', () => {
  test('the first render already reads the size the cache reports', () => {
    cacheSize.bytes = 4096;
    const { result } = renderHook(() => useCacheState());
    expect(result.current).toEqual({ imageBytes: 4096 });
  });

  test('follows the cache as images are added and removed', () => {
    const { result } = renderHook(() => useCacheState());
    expect(result.current.imageBytes).toBe(0);

    added('img:a', 1000);
    expect(result.current.imageBytes).toBe(1000);

    added('img:b', 500);
    expect(result.current.imageBytes).toBe(1500);

    removed('img:a', 1000);
    expect(result.current.imageBytes).toBe(500);
  });

  test('a thousand additions in one frame are one re-render (ADR 0006)', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useCacheState();
    });
    const rendersBefore = renders;

    for (let i = 0; i < 1000; i++) fireRawAdded(`img:bulk-${i}`, 10);
    expect(renders).toBe(rendersBefore);
    endFrame();

    expect(renders).toBe(rendersBefore + 1);
    expect(result.current.imageBytes).toBe(10_000);
  });

  test('an event that leaves the size as it was keeps the same object and does not re-render', () => {
    cacheSize.bytes = 300;
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useCacheState();
    });
    const before = result.current;
    const rendersBefore = renders;

    added('img:empty'); // a zero-byte image
    removed('img:gone'); // a REMOVED that moved nothing — eviction fires two per image

    expect(renders).toBe(rendersBefore);
    expect(result.current).toBe(before);
  });

  test('the Snapshot is frozen', () => {
    const { result } = renderHook(() => useCacheState());
    expect(Object.isFrozen(result.current)).toBe(true);
  });

  // Only Cache State is mounted here, so every cache-event listener counted
  // is its own (the image dispatcher listens to the same event names).
  test('listens from the first consumer to the last, with two listeners however many consumers', () => {
    const spy = spyCacheListeners();
    const a = renderHook(() => useCacheState());
    expect(spy.added()).toBe(2);

    const b = renderHook(() => useCacheState());
    expect(spy.added()).toBe(2);

    a.unmount();
    expect(spy.removed()).toBe(0);
    added('img:still', 64);
    expect(b.result.current.imageBytes).toBe(64);

    b.unmount();
    expect(spy.removed()).toBe(2);
    spy.restore();
  });

  test('StrictMode double-mount leaves the listeners balanced', () => {
    const spy = spyCacheListeners();
    const { result, unmount } = renderHook(() => useCacheState(), { wrapper: strictModeWrapper });
    expect(spy.added() - spy.removed()).toBe(2);

    added('img:strict', 8);
    expect(result.current.imageBytes).toBe(8);

    unmount();
    expect(spy.added()).toBe(spy.removed());
    spy.restore();
  });

  test('a size that moved between render and subscription is caught when listening starts', () => {
    cacheSize.bytes = 100;
    const seen: number[] = [];
    const { result } = renderHook(() => {
      const state = useCacheState();
      seen.push(state.imageBytes);
      // The cache moves after this render read it and before any listener
      // exists, so no event can tell the Binding.
      if (seen.length === 1) cacheSize.bytes = 2048;
      return state;
    });

    expect(seen[0]).toBe(100);
    expect(result.current.imageBytes).toBe(2048);
  });

  test('a pending rebuild is dropped when the last consumer leaves', () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = renderHook(() => useCacheState());

    fireRawAdded('img:pending', 1); // schedules a rebuild
    unmount();

    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });

  test('a consumer arriving after the last one left reads the size of now on its first render', () => {
    renderHook(() => useCacheState()).unmount();
    cacheSize.bytes = 777; // unheard: nobody is listening

    const seen: number[] = [];
    renderHook(() => {
      seen.push(useCacheState().imageBytes);
    });

    expect(seen[0]).toBe(777);
  });
});
