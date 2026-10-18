import { cache } from '@cornerstonejs/core';
import { act } from '@testing-library/react';
import { createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useCacheState, useImageLoadState, useImageLoadStates, useViewportState } from './index';
import { useActiveTool, useAnnotations } from './tools/index';

// Real CS3D modules, no Engine: what a server render sees. Each hook's server
// value is its documented nothing-there value.
const cases: [name: string, read: () => unknown, server: unknown][] = [
  ['useViewportState', () => useViewportState('vp'), undefined],
  ['useViewportState with a selector', () => useViewportState('vp', (s) => s.kind), undefined],
  ['useCacheState', () => useCacheState(), { imageBytes: 0 }],
  ['useImageLoadState', () => useImageLoadState('img:a'), 'absent'],
  ['useImageLoadState(undefined)', () => useImageLoadState(undefined), undefined],
  ['useImageLoadStates', () => useImageLoadStates(['img:a', 'img:b']), ['absent', 'absent']],
  ['useImageLoadStates([])', () => useImageLoadStates([]), []],
  ['useImageLoadStates(undefined)', () => useImageLoadStates(undefined), undefined],
  ['useActiveTool', () => useActiveTool('vp'), undefined],
  ['useAnnotations', () => useAnnotations('vp'), undefined],
];

describe('server render', () => {
  test.each(cases)('%s returns its server value, the same one every render', (_, read, server) => {
    const seen: unknown[] = [];
    const Probe = () => (seen.push(read()), null);
    renderToString(createElement(Probe));
    renderToString(createElement(Probe));
    expect(seen[0]).toEqual(server);
    // Two renders are two hook instances: shared constants are the same
    // object; a list's array is per subscription (the hydration test below
    // holds it to one render).
    if (!Array.isArray(server) || server.length === 0) expect(seen[1]).toBe(seen[0]);
    if (typeof server === 'object') expect(Object.isFrozen(seen[0])).toBe(true);
  });
});

describe('hydration', () => {
  let renders = 0;
  const App = () => {
    renders++;
    const values = {
      viewport: useViewportState('vp', (s) => s.kind),
      cache: useCacheState(),
      image: useImageLoadState('img:a'),
      images: useImageLoadStates(['img:a', 'img:b']),
      empty: useImageLoadStates([]),
      tool: useActiveTool('vp'),
      annotations: useAnnotations('vp'),
    };
    return createElement('pre', null, JSON.stringify(values));
  };

  afterEach(() => {
    renders = 0;
    cache.purgeCache();
    vi.restoreAllMocks();
  });

  async function hydrate() {
    const container = document.createElement('div');
    container.innerHTML = renderToString(createElement(App));
    renders = 0;
    const errors = vi.spyOn(console, 'error');
    const recoverable: unknown[] = [];
    const root = await act(async () =>
      hydrateRoot(container, createElement(App), { onRecoverableError: (e) => recoverable.push(e) }),
    );
    const text = container.textContent;
    await act(async () => root.unmount());
    return { errors: errors.mock.calls, recoverable, text };
  }

  test('matches the server markup without a warning or an extra render', async () => {
    const { errors, recoverable } = await hydrate();
    expect(errors).toEqual([]);
    expect(recoverable).toEqual([]);
    // The client reads what the server rendered, so React has nothing to redo.
    expect(renders).toBe(1);
  });

  test('a client that already differs takes over right after, still without a mismatch', async () => {
    cache.putImageSync('img:a', { imageId: 'img:a', sizeInBytes: 1234 } as never);
    const { errors, recoverable, text } = await hydrate();
    expect(errors).toEqual([]);
    expect(recoverable).toEqual([]);
    expect(JSON.parse(text!)).toMatchObject({
      cache: { imageBytes: 1234 },
      image: 'loaded',
      images: ['loaded', 'absent'],
    });
  });
});
