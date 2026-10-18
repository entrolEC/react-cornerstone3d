import { Enums, RenderingEngine, init as csInit } from '@cornerstonejs/core';
import { ToolGroupManager, init as csToolsInit } from '@cornerstonejs/tools';
import { cleanup, render, waitFor } from '@testing-library/react';
import { createElement, StrictMode } from 'react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { CornerstoneViewport, useViewportState } from './index';

// Smoke tests for the component against the real Engine and the real tools
// package: what CS3D does to a viewport when the component disables and
// re-enables it, or when two components enable the same viewportId. The
// jsdom suite owns the component logic.

beforeAll(async () => {
  await csInit();
  csToolsInit();
});

let engine: RenderingEngine;

afterEach(() => {
  cleanup(); // unmount the component before the Engine it enabled on goes away
  ToolGroupManager.destroy();
  engine?.destroy();
});

const style = { width: 64, height: 64 };

test('onEnabled keeps the viewport in its ToolGroup across StrictMode, a type change and a key change', () => {
  engine = new RenderingEngine('engine-on-enabled');
  // Created before mount, as the app must: onEnabled runs in the child's
  // effect, before any parent effect could create the group.
  const group = ToolGroupManager.createToolGroup('tg-on-enabled')!;
  let calls = 0;
  const app = (type: Enums.ViewportType, key: string) =>
    createElement(
      StrictMode,
      null,
      createElement(CornerstoneViewport, {
        key,
        viewportId: 'vp',
        type,
        style,
        onEnabled: (viewport) => {
          calls++;
          group.addViewport(viewport.id, viewport.renderingEngineId);
        },
      }),
    );

  // StrictMode: enable, disable (CS3D drops 'vp' from the group), enable.
  const view = render(app(Enums.ViewportType.STACK, 'a'));
  expect(calls).toBe(2);
  expect(group.getViewportIds()).toEqual(['vp']);

  view.rerender(app(Enums.ViewportType.ORTHOGRAPHIC, 'a'));
  expect(group.getViewportIds()).toEqual(['vp']);

  view.rerender(app(Enums.ViewportType.ORTHOGRAPHIC, 'b'));
  expect(group.getViewportIds()).toEqual(['vp']);

  // A new inline callback alone neither re-enables nor calls it again.
  const before = calls;
  view.rerender(app(Enums.ViewportType.ORTHOGRAPHIC, 'b'));
  expect(calls).toBe(before);
  expect(group.getViewportIds()).toEqual(['vp']);
});

function Probe() {
  const kind = useViewportState('vp', (s) => s.kind);
  return createElement('span', { 'data-testid': 'kind' }, String(kind));
}
// Panes are told apart by `id`; createElement's typing rejects data-* props.
function Panes({ older, newer }: { older: boolean; newer: boolean }) {
  return createElement(
    'div',
    null,
    older &&
      createElement(CornerstoneViewport, {
        key: 'older',
        id: 'older',
        viewportId: 'vp',
        type: Enums.ViewportType.STACK,
        style,
      }),
    newer &&
      createElement(CornerstoneViewport, {
        key: 'newer',
        id: 'newer',
        viewportId: 'vp',
        type: Enums.ViewportType.STACK,
        style,
      }),
    createElement(Probe),
  );
}

test('an older pane unmounting after a newer pane took its viewportId leaves the newer one enabled', async () => {
  engine = new RenderingEngine('engine-overlap');
  const view = render(createElement(Panes, { older: true, newer: false }));
  await waitFor(() => expect(view.getByTestId('kind').textContent).toBe('stack'));

  // Separate commits: CS3D's enableElement disables the older pane's
  // viewport and enables 'vp' on the newer div.
  view.rerender(createElement(Panes, { older: true, newer: true }));
  const newerDiv = view.container.querySelector('#newer');
  expect(engine.getViewport('vp')?.element).toBe(newerDiv);

  view.rerender(createElement(Panes, { older: false, newer: true }));

  expect(engine.getViewport('vp')?.element).toBe(newerDiv);
  await waitFor(() => expect(view.getByTestId('kind').textContent).toBe('stack'));
});

test('a plain unmount still disables the viewport', () => {
  engine = new RenderingEngine('engine-unmount');
  const view = render(
    createElement(StrictMode, null, createElement(Panes, { older: true, newer: false })),
  );
  expect(engine.getViewport('vp')).toBeDefined();

  view.rerender(
    createElement(StrictMode, null, createElement(Panes, { older: false, newer: false })),
  );
  expect(engine.getViewport('vp')).toBeUndefined();
});
