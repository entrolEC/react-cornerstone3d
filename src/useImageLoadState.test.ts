import { Enums, cache, eventTarget } from '@cornerstonejs/core';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createElement, StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useImageLoadState } from './index';
import { imageBindings } from './useImageLoadState';

// Real module loads; only the cache module's `isLoaded` is replaced so tests
// can put images in and out of a fake cache. Events go through the real
// eventTarget — the dispatcher's wiring is what these tests exercise.
vi.mock('@cornerstonejs/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cornerstonejs/core')>();
  return { ...actual, cache: { ...actual.cache, isLoaded: vi.fn() } };
});

const loaded = new Set<string>();

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

// Mirrors CS3D 5.10.7 payloads: ADDED carries the cached image (`detail.image.imageId`),
// REMOVED carries the id (`detail.imageId`). Both fire on eventTarget.
const fireRawAdded = (imageId: string) =>
  act(() => {
    loaded.add(imageId);
    eventTarget.dispatchEvent(
      new CustomEvent(Enums.Events.IMAGE_CACHE_IMAGE_ADDED, { detail: { image: { imageId } } }),
    );
  });
const fireRawRemoved = (imageId: string) =>
  act(() => {
    loaded.delete(imageId);
    eventTarget.dispatchEvent(
      new CustomEvent(Enums.Events.IMAGE_CACHE_IMAGE_REMOVED, { detail: { imageId } }),
    );
  });
const endFrame = () => act(() => vi.advanceTimersToNextFrame());
const added = (imageId: string) => {
  fireRawAdded(imageId);
  endFrame();
};
const removed = (imageId: string) => {
  fireRawRemoved(imageId);
  endFrame();
};

const strictModeWrapper = ({ children }: { children: ReactNode }) =>
  createElement(StrictMode, null, children);

// Only the dispatcher's own listeners, not the viewport Binding's lifecycle ones.
const CACHE_EVENTS = new Set<string>([
  Enums.Events.IMAGE_CACHE_IMAGE_ADDED,
  Enums.Events.IMAGE_CACHE_IMAGE_REMOVED,
]);
function spyCacheListeners() {
  const add = vi.spyOn(eventTarget, 'addEventListener');
  const remove = vi.spyOn(eventTarget, 'removeEventListener');
  const count = (spy: typeof add) => spy.mock.calls.filter(([type]) => CACHE_EVENTS.has(type)).length;
  return {
    added: () => count(add),
    removed: () => count(remove),
    restore: () => {
      add.mockRestore();
      remove.mockRestore();
    },
  };
}

describe('useImageLoadState', () => {
  test('an image the cache does not know is not loaded: false', () => {
    const { result } = renderHook(() => useImageLoadState('img:unknown'));
    expect(result.current).toBe(false);
  });

  test('an image already in the cache reads true on the first render', () => {
    loaded.add('img:pre');
    const { result } = renderHook(() => useImageLoadState('img:pre'));
    expect(result.current).toBe(true);
  });

  test('no imageId: undefined, and nothing is subscribed or registered', () => {
    const spy = spyCacheListeners();
    const { result } = renderHook(() => useImageLoadState(undefined));

    expect(result.current).toBeUndefined();
    expect(spy.added()).toBe(0);
    expect(imageBindings.size).toBe(0);
    spy.restore();
  });

  test('turns true when the cache adds the image', () => {
    const { result } = renderHook(() => useImageLoadState('img:a'));
    expect(result.current).toBe(false);

    added('img:a');

    expect(result.current).toBe(true);
  });

  test('turns false again when the cache removes the image', () => {
    loaded.add('img:b');
    const { result } = renderHook(() => useImageLoadState('img:b'));
    expect(result.current).toBe(true);

    removed('img:b');

    expect(result.current).toBe(false);
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
    expect(result.current).toBe(false);
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
    expect(result.current).toBe(true);
  });

  test('the dispatcher holds two eventTarget listeners no matter how many images are observed', () => {
    const spy = spyCacheListeners();
    const ids = Array.from({ length: 50 }, (_, i) => `img:many-${i}`);
    const { unmount } = renderHook(() => ids.map((id) => useImageLoadState(id)));

    expect(imageBindings.size).toBe(50);
    expect(spy.added()).toBe(2);

    unmount();
    expect(spy.removed()).toBe(2);
    expect(imageBindings.size).toBe(0);
    spy.restore();
  });

  test('routing still reaches each image through the shared listeners', () => {
    const ids = ['img:r0', 'img:r1', 'img:r2'];
    const { result } = renderHook(() => ids.map((id) => useImageLoadState(id)));

    added('img:r1');

    expect(result.current).toEqual([false, true, false]);
  });

  test('two consumers of one image share one Binding', () => {
    const a = renderHook(() => useImageLoadState('img:shared'));
    const b = renderHook(() => useImageLoadState('img:shared'));
    expect(imageBindings.size).toBe(1);

    added('img:shared');
    expect(a.result.current).toBe(true);
    expect(b.result.current).toBe(true);

    a.unmount();
    expect(imageBindings.size).toBe(1);
    removed('img:shared');
    expect(b.result.current).toBe(false);
  });

  test('the last consumer leaving evicts the Binding and detaches the dispatcher', () => {
    const spy = spyCacheListeners();
    const { unmount } = renderHook(() => useImageLoadState('img:last'));
    expect(imageBindings.size).toBe(1);
    expect(spy.added()).toBe(2);

    unmount();

    expect(imageBindings.size).toBe(0);
    expect(spy.removed()).toBe(2);
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
    expect(spy.added() - spy.removed()).toBe(2);

    added('img:strict');
    expect(result.current).toBe(true);

    unmount();
    expect(spy.added()).toBe(spy.removed());
    expect(imageBindings.size).toBe(0);
    spy.restore();
  });

  test('changing the imageId moves to that image and releases the old Binding', () => {
    loaded.add('img:second');
    let id: string | undefined = 'img:first';
    const { result, rerender } = renderHook(() => useImageLoadState(id));
    expect(result.current).toBe(false);

    id = 'img:second';
    rerender();
    expect(result.current).toBe(true);
    expect(imageBindings.size).toBe(1);

    id = undefined;
    rerender();
    expect(result.current).toBeUndefined();
    expect(imageBindings.size).toBe(0);
  });

  test('the value is a bare boolean, referentially trivial', () => {
    const { result, rerender } = renderHook(() => useImageLoadState('img:bool'));
    expect(typeof result.current).toBe('boolean');
    rerender();
    expect(result.current).toBe(false);
  });
});
