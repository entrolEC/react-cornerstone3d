import type { Types } from '@cornerstonejs/core';
import {
  Enums,
  eventTarget,
  getEnabledElementByViewportId,
  getRenderingEngine,
  getRenderingEngines,
} from '@cornerstonejs/core';
import { cleanup, render, renderHook } from '@testing-library/react';
import { createElement, StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CornerstoneViewport, useViewportState } from './index';

// Real module loads; registry lookup and Engine registry are replaced so a
// fake Engine can enable/disable fake viewports.
vi.mock('@cornerstonejs/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cornerstonejs/core')>()),
  getEnabledElementByViewportId: vi.fn(),
  getRenderingEngine: vi.fn(),
  getRenderingEngines: vi.fn(),
}));

const registry = new Map<string, { viewport: unknown }>();

// Fake Engine mirroring the CS3D contract the component relies on:
// enableElement registers the viewport then fires ELEMENT_ENABLED;
// disableElement fires ELEMENT_DISABLED before registry removal.
function createFakeEngine(id = 'engine') {
  return {
    id,
    enableElement: vi.fn(({ viewportId, type, element }: Types.PublicViewportInput) => {
      const viewport = {
        element,
        type,
        getCamera: (): Types.ICamera => ({ parallelScale: 100 }),
        getProperties: () => ({ voiRange: { lower: 0, upper: 400 } }),
        getSliceIndex: () => 0,
        getNumberOfSlices: () => 1,
        getImageIds: () => ['img:0'],
        getCurrentImageId: () => 'img:0',
      };
      registry.set(viewportId, { viewport });
      eventTarget.dispatchEvent(
        new CustomEvent(Enums.Events.ELEMENT_ENABLED, { detail: { viewportId, element } }),
      );
    }),
    disableElement: vi.fn((viewportId: string) => {
      eventTarget.dispatchEvent(
        new CustomEvent(Enums.Events.ELEMENT_DISABLED, { detail: { viewportId } }),
      );
      registry.delete(viewportId);
    }),
  };
}

type FakeEngine = ReturnType<typeof createFakeEngine>;
let engine: FakeEngine;

beforeEach(() => {
  engine = createFakeEngine();
  vi.mocked(getEnabledElementByViewportId).mockImplementation(
    (id) => registry.get(id) as unknown as Types.IEnabledElement,
  );
  vi.mocked(getRenderingEngines).mockImplementation(
    () => [engine] as unknown as Types.IRenderingEngine[],
  );
  vi.mocked(getRenderingEngine).mockImplementation(
    (id) => (id === engine.id ? engine : undefined) as unknown as Types.IRenderingEngine,
  );
});

afterEach(() => {
  cleanup();
  registry.clear();
  vi.mocked(getEnabledElementByViewportId).mockReset();
  vi.mocked(getRenderingEngines).mockReset();
  vi.mocked(getRenderingEngine).mockReset();
});

const strictModeWrapper = ({ children }: { children: ReactNode }) =>
  createElement(StrictMode, null, children);

const viewportEl = (props: Parameters<typeof CornerstoneViewport>[0]) =>
  createElement(CornerstoneViewport, props);

describe('CornerstoneViewport', () => {
  test('mount enables the viewport and hooks observing the viewportId fill in', () => {
    const { result } = renderHook(() => useViewportState('vp-mount'));
    expect(result.current).toBeUndefined();

    render(viewportEl({ viewportId: 'vp-mount', type: Enums.ViewportType.STACK }));

    expect(engine.enableElement).toHaveBeenCalledTimes(1);
    expect(result.current?.kind).toBe('stack');
  });

  test('unmount disables the viewport and hook values return to undefined', () => {
    const { result } = renderHook(() => useViewportState('vp-unmount'));
    const view = render(viewportEl({ viewportId: 'vp-unmount', type: Enums.ViewportType.STACK }));
    expect(result.current).toBeDefined();

    view.unmount();

    expect(engine.disableElement).toHaveBeenCalledWith('vp-unmount');
    expect(result.current).toBeUndefined();
  });

  test('StrictMode double-mount keeps enable/disable balanced and ends enabled', () => {
    const { result } = renderHook(() => useViewportState('vp-strict'));

    const view = render(viewportEl({ viewportId: 'vp-strict', type: Enums.ViewportType.STACK }), {
      wrapper: strictModeWrapper,
    });

    expect(engine.enableElement.mock.calls.length - engine.disableElement.mock.calls.length).toBe(
      1,
    );
    expect(result.current?.kind).toBe('stack');

    view.unmount();

    expect(engine.enableElement.mock.calls.length).toBe(engine.disableElement.mock.calls.length);
    expect(result.current).toBeUndefined();
  });

  test('passes viewportId, type, and defaultOptions to enableElement with its own div element', () => {
    const defaultOptions = { background: [0, 0, 0] as Types.Point3 };

    render(
      viewportEl({
        viewportId: 'vp-props',
        type: Enums.ViewportType.ORTHOGRAPHIC,
        defaultOptions,
        className: 'my-viewport',
      }),
    );

    const input = engine.enableElement.mock.calls[0][0];
    expect(input).toMatchObject({
      viewportId: 'vp-props',
      type: Enums.ViewportType.ORTHOGRAPHIC,
      defaultOptions,
    });
    expect(input.element).toBeInstanceOf(HTMLDivElement);
    expect(input.element.className).toBe('my-viewport');
    expect(input.element.isConnected).toBe(true);
  });

  test('resolves the Engine by renderingEngineId when given', () => {
    const second = createFakeEngine('engine-2');
    vi.mocked(getRenderingEngine).mockImplementation(
      (id) =>
        (id === 'engine-2' ? second : undefined) as unknown as Types.IRenderingEngine,
    );

    render(
      viewportEl({
        viewportId: 'vp-by-id',
        type: Enums.ViewportType.STACK,
        renderingEngineId: 'engine-2',
      }),
    );

    expect(second.enableElement).toHaveBeenCalledTimes(1);
    expect(engine.enableElement).not.toHaveBeenCalled();
  });

  test('throws when no Engine is registered — the app must create it first', () => {
    vi.mocked(getRenderingEngines).mockReturnValue([]);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(viewportEl({ viewportId: 'vp-none', type: Enums.ViewportType.STACK })),
    ).toThrow(/RenderingEngine/);

    consoleError.mockRestore();
  });
});
