import { renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useImageLoadState, useImageLoadStates } from './index';
import {
  added,
  fireRawAdded,
  endFrame,
  loaded,
  removed,
  installFakeCache,
  spyCacheListeners,
  strictModeWrapper,
} from './testing/imageCache';
import { imageBindings } from './useImageLoadState';

vi.mock('@cornerstonejs/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@cornerstonejs/core')>();
  return { ...actual, cache: { ...actual.cache, isLoaded: vi.fn() } };
});

installFakeCache();

const ids = ['img:0', 'img:1', 'img:2'];

describe('useImageLoadStates', () => {
  test('no list: undefined, and nothing is registered', () => {
    const { result } = renderHook(() => useImageLoadStates(undefined));
    expect(result.current).toBeUndefined();
    expect(imageBindings.size).toBe(0);
  });

  test('an empty list: one stable frozen empty array, shared by every caller', () => {
    const a = renderHook(() => useImageLoadStates([]));
    const b = renderHook(() => useImageLoadStates([]));
    expect(a.result.current).toEqual([]);
    expect(Object.isFrozen(a.result.current)).toBe(true);
    expect(a.result.current).toBe(b.result.current);

    const first = a.result.current;
    a.rerender();
    expect(a.result.current).toBe(first);
    expect(imageBindings.size).toBe(0);
  });

  test('reads every image from the cache on the first render', () => {
    loaded.add('img:1');
    const { result } = renderHook(() => useImageLoadStates(ids));
    expect(result.current).toEqual([false, true, false]);
    expect(Object.isFrozen(result.current)).toBe(true);
  });

  test('one arrival gives a new array with only that index changed; the old one is untouched', () => {
    const { result } = renderHook(() => useImageLoadStates(ids));
    const before = result.current;

    added('img:2');

    expect(result.current).not.toBe(before);
    expect(result.current).toEqual([false, false, true]);
    expect(before).toEqual([false, false, false]);
  });

  test('an event for an image outside the list keeps the same array and does not re-render', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useImageLoadStates(ids);
    });
    const before = result.current;
    const rendersBefore = renders;

    added('img:elsewhere');

    expect(result.current).toBe(before);
    expect(renders).toBe(rendersBefore);
  });

  test('several arrivals in one frame land in one array and one render (ADR 0006)', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useImageLoadStates(ids);
    });
    const rendersBefore = renders;

    fireRawAdded('img:0');
    fireRawAdded('img:2');
    expect(renders).toBe(rendersBefore);
    endFrame();

    expect(result.current).toEqual([true, false, true]);
    expect(renders).toBe(rendersBefore + 1);
  });

  test('removal flips the entry back to false', () => {
    loaded.add('img:0');
    const { result } = renderHook(() => useImageLoadStates(ids));
    expect(result.current).toEqual([true, false, false]);

    removed('img:0');

    expect(result.current).toEqual([false, false, false]);
  });

  test('re-rendering with a new array of the same ids keeps the array and the subscriptions', () => {
    const spy = spyCacheListeners();
    const { result, rerender } = renderHook(({ list }: { list: readonly string[] }) => useImageLoadStates(list), {
      initialProps: { list: [...ids] },
    });
    const before = result.current;

    rerender({ list: [...ids] }); // same content, new array

    expect(result.current).toBe(before);
    // No Binding was unsubscribed and re-subscribed: the dispatcher never detached.
    expect(spy.removed()).toBe(0);
    expect(spy.added()).toBe(2);
    spy.restore();
  });

  test('the array is a view over the same Bindings a tick component reads', () => {
    const { result } = renderHook(() => ({
      list: useImageLoadStates(ids),
      ticks: ids.map((id) => useImageLoadState(id)),
    }));
    expect(imageBindings.size).toBe(ids.length); // shared, not doubled

    added('img:1');

    expect(result.current.list).toEqual([false, true, false]);
    expect(result.current.ticks).toEqual([false, true, false]);
  });

  test('changing the list releases the old Bindings and acquires the new ones', () => {
    loaded.add('new:1');
    const { result, rerender } = renderHook(
      ({ list }: { list: readonly string[] | undefined }) => useImageLoadStates(list),
      { initialProps: { list: ids as readonly string[] | undefined } },
    );
    expect(imageBindings.size).toBe(3);

    rerender({ list: ['new:0', 'new:1'] });

    expect(result.current).toEqual([false, true]);
    expect(imageBindings.size).toBe(2);
    added('img:0'); // the old list — must not reach us
    expect(result.current).toEqual([false, true]);

    rerender({ list: undefined });
    expect(result.current).toBeUndefined();
    expect(imageBindings.size).toBe(0);
  });

  test('the last consumer leaving evicts every Binding and detaches the dispatcher', () => {
    const spy = spyCacheListeners();
    const { unmount } = renderHook(() => useImageLoadStates(ids));
    expect(imageBindings.size).toBe(3);

    unmount();

    expect(imageBindings.size).toBe(0);
    expect(spy.removed()).toBe(2);
    spy.restore();
  });

  test('StrictMode double-mount leaves one Binding per image and balanced listeners', () => {
    const spy = spyCacheListeners();
    const { result, unmount } = renderHook(() => useImageLoadStates(ids), {
      wrapper: strictModeWrapper,
    });
    expect(imageBindings.size).toBe(3);
    expect(spy.added() - spy.removed()).toBe(2);

    added('img:1');
    expect(result.current).toEqual([false, true, false]);

    unmount();
    expect(spy.added()).toBe(spy.removed());
    expect(imageBindings.size).toBe(0);
    spy.restore();
  });

  test('a list with a repeated id reads the same Binding twice and unmounts cleanly', () => {
    const spy = spyCacheListeners();
    const { result, unmount } = renderHook(() => useImageLoadStates(['img:dup', 'img:dup']));
    expect(result.current).toEqual([false, false]);
    expect(imageBindings.size).toBe(1);

    added('img:dup');
    expect(result.current).toEqual([true, true]);

    unmount();
    expect(imageBindings.size).toBe(0);
    expect(spy.added()).toBe(spy.removed());
    spy.restore();
  });

  test('a list with the same content but a different order is a different list', () => {
    loaded.add('img:0');
    const { result, rerender } = renderHook(
      ({ list }: { list: readonly string[] }) => useImageLoadStates(list),
      { initialProps: { list: ids } },
    );
    expect(result.current).toEqual([true, false, false]);

    rerender({ list: [...ids].reverse() });

    expect(result.current).toEqual([false, false, true]);
  });
});
