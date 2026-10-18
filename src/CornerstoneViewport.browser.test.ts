import { Enums, RenderingEngine, init as csInit } from '@cornerstonejs/core';
import { ToolGroupManager, init as csToolsInit } from '@cornerstonejs/tools';
import { cleanup, render } from '@testing-library/react';
import { createElement, StrictMode } from 'react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { CornerstoneViewport } from './index';

// Smoke tests for the component against the real Engine and the real tools
// package: what CS3D does to a viewport's ToolGroup membership when the
// component disables and re-enables it. The jsdom suite owns the component
// logic.

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
