import { renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useImageLoadState } from './index';
import {
  added,
  fireRawAdded,
  fireRawRemoved,
  endFrame,
  failed,
  loaded,
  removed,
  installFakeCache,
  spyCacheListeners,
  strictModeWrapper,
} from './testing/imageCache';
import { imageBindings } from './useImageLoadState';

// Real module loads; only the cache module's `isLoaded` is replaced so tests
// can put images in and out of a fake cache. Events go through the real
// eventTarget — the dispatcher's wiring is what these tests exercise.
vi.mock('@cornerstonejs/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cornerstonejs/core')>();
  return { ...actual, cache: { ...actual.cache, isLoaded: vi.fn() } };
});

installFakeCache();

describe('useImageLoadState', () => {
  test('an image the cache does not know reads absent', () => {
    const { result } = renderHook(() => useImageLoadState('img:unknown'));
    expect(result.current).toBe('absent');
  });

  test('an image already in the cache reads loaded on the first render', () => {
    loaded.add('img:pre');
    const { result } = renderHook(() => useImageLoadState('img:pre'));
    expect(result.current).toBe('loaded');
  });

  test('no imageId: undefined, and nothing is subscribed or registered', () => {
    const spy = spyCacheListeners();
    const { result } = renderHook(() => useImageLoadState(undefined));

    expect(result.current).toBeUndefined();
    expect(spy.added()).toBe(0);
    expect(imageBindings.size).toBe(0);
    spy.restore();
  });

  test('turns loaded when the cache adds the image', () => {
    const { result } = renderHook(() => useImageLoadState('img:a'));
    expect(result.current).toBe('absent');

    added('img:a');

    expect(result.current).toBe('loaded');
  });

  test('turns absent again when the cache removes the image', () => {
    loaded.add('img:b');
    const { result } = renderHook(() => useImageLoadState('img:b'));
    expect(result.current).toBe('loaded');

    removed('img:b');

    expect(result.current).toBe('absent');
  });

  test('turns failed when a load failure for this image is heard', () => {
    const { result } = renderHook(() => useImageLoadState('img:bad'));
    expect(result.current).toBe('absent');

    failed('img:bad');

    expect(result.current).toBe('failed');
  });

  test('a failure is forgotten once the cache adds the image: a later eviction reads absent', () => {
    const { result } = renderHook(() => useImageLoadState('img:retry'));
    failed('img:retry');
    expect(result.current).toBe('failed');

    added('img:retry');
    expect(result.current).toBe('loaded');

    removed('img:retry');
    expect(result.current).toBe('absent');
  });

  test('a failure for another image changes neither the value nor the render count', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useImageLoadState('img:fine');
    });
    const rendersBefore = renders;

    failed('img:broken');

    expect(renders).toBe(rendersBefore);
    expect(result.current).toBe('absent');
  });

  test('a failure heard while the cache has the image is ignored, now and after eviction', () => {
    loaded.add('img:held');
    const { result } = renderHook(() => useImageLoadState('img:held'));

    failed('img:held');
    expect(result.current).toBe('loaded');

    removed('img:held');
    expect(result.current).toBe('absent');
  });

  test('a failure fired before anyone subscribed reads absent', () => {
    failed('img:early');

    const { result } = renderHook(() => useImageLoadState('img:early'));

    expect(result.current).toBe('absent');
  });

  test('the heard failure goes with the last consumer: subscribing again reads absent', () => {
    const first = renderHook(() => useImageLoadState('img:forgot'));
    failed('img:forgot');
    expect(first.result.current).toBe('failed');
    first.unmount();

    const again = renderHook(() => useImageLoadState('img:forgot'));
    expect(again.result.current).toBe('absent');

    // The same Binding object subscribed again (StrictMode, an evicted
    // Binding re-subscribed by its hook instance) forgets too.
    const binding = imageBindings.acquire('img:forgot-same');
    const off = binding.subscribe(() => {});
    failed('img:forgot-same');
    expect(binding.getSnapshot()).toBe('failed');
    off();
    binding.subscribe(() => {})();
    expect(binding.getSnapshot()).toBe('absent');
  });

  test('an event for another image does not re-render', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useImageLoadState('img:mine');
    });
    const rendersBefore = renders;

    added('img:other');

    expect(renders).toBe(rendersBefore);
    expect(result.current).toBe('absent');
  });

  test('events in one frame collapse into one re-render (ADR 0006)', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useImageLoadState('img:frame');
    });
    const rendersBefore = renders;

    fireRawAdded('img:frame');
    fireRawRemoved('img:frame');
    fireRawAdded('img:frame');
    expect(renders).toBe(rendersBefore);
    endFrame();

    expect(renders).toBe(rendersBefore + 1);
    expect(result.current).toBe('loaded');
  });

  test('the dispatcher holds three eventTarget listeners no matter how many images are observed', () => {
    const spy = spyCacheListeners();
    const ids = Array.from({ length: 50 }, (_, i) => `img:many-${i}`);
    const { unmount } = renderHook(() => ids.map((id) => useImageLoadState(id)));

    expect(imageBindings.size).toBe(50);
    expect(spy.added()).toBe(3);

    unmount();
    expect(spy.removed()).toBe(3);
    expect(imageBindings.size).toBe(0);
    spy.restore();
  });

  test('routing still reaches each image through the shared listeners', () => {
    const ids = ['img:r0', 'img:r1', 'img:r2'];
    const { result } = renderHook(() => ids.map((id) => useImageLoadState(id)));

    added('img:r1');

    expect(result.current).toEqual(['absent', 'loaded', 'absent']);
  });

  test('two consumers of one image share one Binding', () => {
    const a = renderHook(() => useImageLoadState('img:shared'));
    const b = renderHook(() => useImageLoadState('img:shared'));
    expect(imageBindings.size).toBe(1);

    added('img:shared');
    expect(a.result.current).toBe('loaded');
    expect(b.result.current).toBe('loaded');

    a.unmount();
    expect(imageBindings.size).toBe(1);
    removed('img:shared');
    expect(b.result.current).toBe('absent');
  });

  test('the last consumer leaving evicts the Binding and detaches the dispatcher', () => {
    const spy = spyCacheListeners();
    const { unmount } = renderHook(() => useImageLoadState('img:last'));
    expect(imageBindings.size).toBe(1);
    expect(spy.added()).toBe(3);

    unmount();

    expect(imageBindings.size).toBe(0);
    expect(spy.removed()).toBe(3);
    spy.restore();
  });

  test('a pending rebuild is dropped when the last consumer leaves', () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = renderHook(() => useImageLoadState('img:pending'));

    fireRawAdded('img:pending'); // schedules a rebuild
    unmount();

    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });

  test('StrictMode double-mount leaves one Binding and balanced listeners', () => {
    const spy = spyCacheListeners();
    const { result, unmount } = renderHook(() => useImageLoadState('img:strict'), {
      wrapper: strictModeWrapper,
    });
    expect(imageBindings.size).toBe(1);
    expect(spy.added() - spy.removed()).toBe(3);

    added('img:strict');
    expect(result.current).toBe('loaded');

    unmount();
    expect(spy.added()).toBe(spy.removed());
    expect(imageBindings.size).toBe(0);
    spy.restore();
  });

  test('changing the imageId moves to that image and releases the old Binding', () => {
    loaded.add('img:second');
    let id: string | undefined = 'img:first';
    const { result, rerender } = renderHook(() => useImageLoadState(id));
    expect(result.current).toBe('absent');

    id = 'img:second';
    rerender();
    expect(result.current).toBe('loaded');
    expect(imageBindings.size).toBe(1);

    id = undefined;
    rerender();
    expect(result.current).toBeUndefined();
    expect(imageBindings.size).toBe(0);
  });

  // The registry lets a Binding be live but unregistered: it was evicted, a
  // newer Binding took the key, then the old hook instance subscribed again.
  // Both must keep hearing the cache, and neither may take the shared
  // listeners down while the other still has consumers.
  test('two live Bindings for one imageId both hear the cache, and one leaving does not deafen the other', () => {
    const spy = spyCacheListeners();
    const old = imageBindings.acquire('img:orphan');
    old.subscribe(() => {})(); // subscribed, then evicted
    const fresh = imageBindings.acquire('img:orphan');
    expect(fresh).not.toBe(old);
    const offFresh = fresh.subscribe(() => {});
    const offOld = old.subscribe(() => {}); // live again, outside the registry

    added('img:orphan');
    expect(old.getSnapshot()).toBe('loaded');
    expect(fresh.getSnapshot()).toBe('loaded');

    offFresh();
    expect(spy.added() - spy.removed()).toBe(3); // old still listens
    removed('img:orphan');
    expect(old.getSnapshot()).toBe('absent');

    offOld();
    expect(spy.added()).toBe(spy.removed());
    spy.restore();
  });

  test('the value is a bare string, referentially trivial', () => {
    const { result, rerender } = renderHook(() => useImageLoadState('img:bool'));
    expect(typeof result.current).toBe('string');
    rerender();
    expect(result.current).toBe('absent');
  });
});
