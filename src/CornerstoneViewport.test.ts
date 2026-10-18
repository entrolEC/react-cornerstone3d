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
        // Mirrors CS3D: only the legacy Stack class takes a stack, and that
        // capability — not `type` — is what the hook reads (ADR 0008).
        ...(type === Enums.ViewportType.STACK ? { setStack: async () => undefined } : {}),
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
    getViewport: (viewportId: string) => registry.get(viewportId)?.viewport,
    resize: vi.fn(),
    hasBeenDestroyed: false,
  };
}

// jsdom has no ResizeObserver; this one hands its callback out so a test can
// pretend the div changed size.
const observers: { callback: ResizeObserverCallback; observed: Element[]; disconnected: boolean }[] = [];
class FakeResizeObserver {
  observed: Element[] = [];
  disconnected = false;
  constructor(public callback: ResizeObserverCallback) {
    observers.push(this);
  }
  observe(element: Element) {
    this.observed.push(element);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
}
vi.stubGlobal('ResizeObserver', FakeResizeObserver);

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
  observers.splice(0);
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

  test('a resized div calls engine.resize; unmount stops watching', () => {
    const view = render(viewportEl({ viewportId: 'vp-resize', type: Enums.ViewportType.STACK }));
    const observer = observers[0];
    expect(observer.observed[0]).toBe(engine.enableElement.mock.calls[0][0].element);

    observer.callback([], observer as unknown as ResizeObserver);
    expect(engine.resize).toHaveBeenCalledWith(true, true);

    view.unmount();
    expect(observer.disconnected).toBe(true);
  });

  test('a parent that destroyed the Engine first: cleanup neither throws nor calls disableElement', () => {
    const view = render(viewportEl({ viewportId: 'vp-gone', type: Enums.ViewportType.STACK }));
    // React runs cleanups parent-first; the Engine-owning parent already ran.
    engine.hasBeenDestroyed = true;

    expect(() => view.unmount()).not.toThrow();
    expect(engine.disableElement).not.toHaveBeenCalled();
  });

  test('onEnabled gets the enabled viewport once per enable, and is not passed to the div', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onEnabled = vi.fn();

    const view = render(
      viewportEl({ viewportId: 'vp-on', type: Enums.ViewportType.STACK, onEnabled }),
    );

    expect(onEnabled).toHaveBeenCalledTimes(1);
    expect(onEnabled).toHaveBeenCalledWith(registry.get('vp-on')?.viewport);
    expect(view.container.firstElementChild?.getAttribute('onEnabled')).toBeNull();
    // React warns about unknown event handler props on a DOM element.
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  test('onEnabled runs again on every re-enable: StrictMode remount and a type change', () => {
    const onEnabled = vi.fn();
    const props = { viewportId: 'vp-re', type: Enums.ViewportType.STACK, onEnabled };

    // StrictMode as the root element, not RTL's `wrapper`: under the wrapper
    // React 19 runs the mount effects only once here.
    const strict = (p: typeof props) => createElement(StrictMode, null, viewportEl(p));
    const view = render(strict(props));
    // StrictMode: enable, disable, enable — each enable reports a fresh viewport.
    expect(engine.enableElement).toHaveBeenCalledTimes(2);
    expect(onEnabled).toHaveBeenCalledTimes(2);
    expect(onEnabled).toHaveBeenLastCalledWith(registry.get('vp-re')?.viewport);

    view.rerender(strict({ ...props, type: Enums.ViewportType.ORTHOGRAPHIC }));

    expect(engine.enableElement).toHaveBeenCalledTimes(3);
    expect(onEnabled).toHaveBeenCalledTimes(3);
    expect(onEnabled.mock.lastCall?.[0]).toMatchObject({ type: Enums.ViewportType.ORTHOGRAPHIC });
  });

  test('a new onEnabled every render does not re-enable; the next enable calls the latest one', () => {
    const first = vi.fn();
    const props = { viewportId: 'vp-inline', type: Enums.ViewportType.STACK };
    const view = render(viewportEl({ ...props, onEnabled: (v) => first(v) }));

    const latest = vi.fn();
    view.rerender(viewportEl({ ...props, onEnabled: (v) => first(v) }));
    view.rerender(viewportEl({ ...props, onEnabled: latest }));

    expect(engine.enableElement).toHaveBeenCalledTimes(1);
    expect(engine.disableElement).not.toHaveBeenCalled();
    expect(first).toHaveBeenCalledTimes(1);
    expect(latest).not.toHaveBeenCalled();

    view.rerender(
      viewportEl({ ...props, type: Enums.ViewportType.ORTHOGRAPHIC, onEnabled: latest }),
    );
    expect(first).toHaveBeenCalledTimes(1);
    expect(latest).toHaveBeenCalledTimes(1);
  });

  test('an onEnabled that throws disables the viewport it was handed, then rethrows', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        viewportEl({
          viewportId: 'vp-throw',
          type: Enums.ViewportType.STACK,
          onEnabled: () => {
            throw new Error('setup failed');
          },
        }),
      ),
    ).toThrow('setup failed');

    expect(engine.disableElement).toHaveBeenCalledWith('vp-throw');
    expect(registry.has('vp-throw')).toBe(false);
    expect(observers[0].disconnected).toBe(true);
    consoleError.mockRestore();
  });

  test('unmounting an older pane leaves the viewportId to a newer pane that enabled it on its own div', () => {
    const { result } = renderHook(() => useViewportState('vp-shared'));
    const props = { viewportId: 'vp-shared', type: Enums.ViewportType.STACK };
    // Separate commits: the newer pane mounts while the older is still up
    // (an exit animation, a second root), and its enable takes the id.
    const older = render(viewportEl(props));
    const newer = render(viewportEl(props));
    const newerDiv = newer.container.firstElementChild;
    expect((registry.get('vp-shared')?.viewport as { element: Element }).element).toBe(newerDiv);

    older.unmount();

    expect(engine.disableElement).not.toHaveBeenCalled();
    expect((registry.get('vp-shared')?.viewport as { element: Element }).element).toBe(newerDiv);
    expect(result.current?.kind).toBe('stack');

    newer.unmount();
    expect(engine.disableElement).toHaveBeenCalledWith('vp-shared');
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
