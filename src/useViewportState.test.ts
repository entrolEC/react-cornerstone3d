import type { Types } from '@cornerstonejs/core';
import { Enums, eventTarget, getEnabledElementByViewportId } from '@cornerstonejs/core';
import { act, renderHook } from '@testing-library/react';
import { createElement, StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  useViewportState,
  type StackViewportState,
  type ViewportState,
  type VolumeViewportState,
} from './index';

// Real module loads (validates the peer dep under jsdom); only the registry
// lookup is replaced by a Map so several fake viewports can coexist.
vi.mock('@cornerstonejs/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cornerstonejs/core')>()),
  getEnabledElementByViewportId: vi.fn(),
}));

const registry = new Map<string, { viewport: unknown }>();

// Engine events batch per animation frame — tests control frames explicitly.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  // CS3D declares a non-optional return but yields undefined for unknown ids.
  vi.mocked(getEnabledElementByViewportId).mockImplementation(
    (id) => registry.get(id) as unknown as Types.IEnabledElement,
  );
});

afterEach(() => {
  vi.useRealTimers();
  registry.clear();
  vi.mocked(getEnabledElementByViewportId).mockReset();
});

// Shared wiring for fake viewports: registry membership, engine events as
// CustomEvents on the element, and enable/disable lifecycle on eventTarget.
function wireFakeViewport(
  viewportId: string,
  viewport: { element: HTMLDivElement },
  enabled: boolean,
) {
  const { element } = viewport;
  if (enabled) registry.set(viewportId, { viewport });
  // Dispatch without ending the frame — for observing mid-frame behavior.
  const fireRaw = (type: string) =>
    act(() => {
      element.dispatchEvent(new CustomEvent(type));
    });
  // Dispatch and complete the frame — the common "event happened" case.
  const fire = (type: string) =>
    act(() => {
      element.dispatchEvent(new CustomEvent(type));
      vi.advanceTimersToNextFrame();
    });
  const detail = { viewportId, element, renderingEngineId: 'engine' };
  const enable = () =>
    act(() => {
      registry.set(viewportId, { viewport });
      eventTarget.dispatchEvent(new CustomEvent(Enums.Events.ELEMENT_ENABLED, { detail }));
    });
  const disable = () =>
    act(() => {
      // CS3D fires ELEMENT_DISABLED before removing the viewport from the
      // registry — mirror that ordering.
      eventTarget.dispatchEvent(new CustomEvent(Enums.Events.ELEMENT_DISABLED, { detail }));
      registry.delete(viewportId);
    });
  return { element, fire, fireRaw, enable, disable };
}

function fakeCameraState() {
  return {
    camera: {
      position: [0, 0, 100] as Types.Point3,
      focalPoint: [0, 0, 0] as Types.Point3,
      parallelScale: 100,
    },
  };
}

function cameraGetter(engineState: ReturnType<typeof fakeCameraState>) {
  // Mirrors the CS3D contract: getters return a FRESH object on every call.
  return (): Types.ICamera => ({
    ...engineState.camera,
    position: [...engineState.camera.position] as Types.Point3,
    focalPoint: [...engineState.camera.focalPoint] as Types.Point3,
  });
}

function createFakeStackViewport(viewportId: string, { enabled = true } = {}) {
  const engineState = {
    ...fakeCameraState(),
    voiRange: { lower: 0, upper: 400 },
    sliceIndex: 0,
  };
  const viewport = {
    element: document.createElement('div'),
    type: Enums.ViewportType.STACK,
    getCamera: cameraGetter(engineState),
    getProperties: () => ({ voiRange: { ...engineState.voiRange } }),
    getSliceIndex: () => engineState.sliceIndex,
    getNumberOfSlices: () => 3,
  };
  return { engineState, ...wireFakeViewport(viewportId, viewport, enabled) };
}

function createFakeVolumeViewport(
  viewportId: string,
  { enabled = true, type = Enums.ViewportType.ORTHOGRAPHIC } = {},
) {
  const engineState = {
    ...fakeCameraState(),
    voiRange: { lower: -1000, upper: 1000 },
    // Mirrors CS3D: both getters return undefined until setVolumes lands.
    sliceIndex: undefined as number | undefined,
    numberOfSlices: undefined as number | undefined,
  };
  const viewport = {
    element: document.createElement('div'),
    type,
    getCamera: cameraGetter(engineState),
    getProperties: () => ({ voiRange: { ...engineState.voiRange } }),
    getSliceIndex: () => engineState.sliceIndex,
    // VOLUME_3D's class has no getNumberOfSlices at all — mirror that.
    ...(type === Enums.ViewportType.VOLUME_3D
      ? {}
      : { getNumberOfSlices: () => engineState.numberOfSlices }),
  };
  return { engineState, ...wireFakeViewport(viewportId, viewport, enabled) };
}

const strictModeWrapper = ({ children }: { children: ReactNode }) =>
  createElement(StrictMode, null, children);

// Tests know their fake is a Stack viewport; narrow for Stack-only fields.
const asStack = (s: ViewportState | undefined) => (s?.kind === 'stack' ? s : undefined);
const selectStackIndex = (s: ViewportState) => asStack(s)?.sliceIndex;

describe('useViewportState', () => {
  test('returns undefined when the viewport does not exist', () => {
    const { result } = renderHook(() => useViewportState('no-such-viewport'));

    expect(result.current).toBeUndefined();
  });

  test('returns the current Viewport State when the viewport exists', () => {
    const { engineState } = createFakeStackViewport('vp-exists');

    const { result } = renderHook(() => useViewportState('vp-exists'));

    expect(result.current).toEqual({
      kind: 'stack',
      camera: engineState.camera,
      voiRange: engineState.voiRange,
      sliceIndex: engineState.sliceIndex,
      numberOfSlices: 3,
    });
  });

  test('returns updated state when a camera Engine event fires', () => {
    const { engineState, fire } = createFakeStackViewport('vp-camera');
    const { result } = renderHook(() => useViewportState('vp-camera'));

    engineState.camera.parallelScale = 50;
    fire(Enums.Events.CAMERA_MODIFIED);

    expect(result.current?.camera.parallelScale).toBe(50);
  });

  test('returns updated state when a VOI Engine event fires', () => {
    const { engineState, fire } = createFakeStackViewport('vp-voi');
    const { result } = renderHook(() => useViewportState('vp-voi'));

    engineState.voiRange = { lower: -100, upper: 300 };
    fire(Enums.Events.VOI_MODIFIED);

    expect(result.current?.voiRange).toEqual({ lower: -100, upper: 300 });
  });

  test('returns updated state when a stack-new-image Engine event fires', () => {
    const { engineState, fire } = createFakeStackViewport('vp-stack');
    const { result } = renderHook(() => useViewportState('vp-stack'));

    engineState.sliceIndex = 42;
    fire(Enums.Events.STACK_NEW_IMAGE);

    expect(asStack(result.current)?.sliceIndex).toBe(42);
  });

  test('returns the identical reference across re-renders when state did not change', () => {
    createFakeStackViewport('vp-stable');
    const { result, rerender } = renderHook(() => useViewportState('vp-stable'));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  test('returns the identical reference when an event fires but state is unchanged', () => {
    const { fire } = createFakeStackViewport('vp-stable-event');
    const { result } = renderHook(() => useViewportState('vp-stable-event'));
    const first = result.current;

    fire(Enums.Events.CAMERA_MODIFIED);

    expect(result.current).toBe(first);
  });

  test('multiple consumers of one viewport share one Snapshot and one Engine subscription', () => {
    const { element } = createFakeStackViewport('vp-shared');
    const addSpy = vi.spyOn(element, 'addEventListener');

    const { result } = renderHook(() => ({
      a: useViewportState('vp-shared'),
      b: useViewportState('vp-shared'),
    }));

    expect(result.current.a).toBe(result.current.b);
    const addedTypes = addSpy.mock.calls.map(([type]) => type);
    expect(new Set(addedTypes).size).toBe(addedTypes.length);
  });

  test('keeps the Engine subscription alive while other consumers remain', () => {
    const { engineState, fire } = createFakeStackViewport('vp-remaining');
    const first = renderHook(() => useViewportState('vp-remaining'));
    const second = renderHook(() => useViewportState('vp-remaining'));

    first.unmount();
    engineState.sliceIndex = 5;
    fire(Enums.Events.STACK_NEW_IMAGE);

    expect(asStack(second.result.current)?.sliceIndex).toBe(5);
  });

  test('returns fresh state on remount after the Engine changed while unobserved', () => {
    const { engineState } = createFakeStackViewport('vp-remount');
    const first = renderHook(() => useViewportState('vp-remount'));
    first.unmount();

    engineState.sliceIndex = 9;
    const second = renderHook(() => useViewportState('vp-remount'));

    expect(asStack(second.result.current)?.sliceIndex).toBe(9);
  });

  test('unsubscribes from the Engine when the last consumer unmounts', () => {
    const { element } = createFakeStackViewport('vp-unmount');
    const addSpy = vi.spyOn(element, 'addEventListener');
    const removeSpy = vi.spyOn(element, 'removeEventListener');

    const { unmount } = renderHook(() => ({
      a: useViewportState('vp-unmount'),
      b: useViewportState('vp-unmount'),
    }));
    unmount();

    expect(removeSpy.mock.calls.map(([type]) => type).sort()).toEqual(
      addSpy.mock.calls.map(([type]) => type).sort(),
    );
  });

  test('StrictMode double-mount leaves exactly one live Engine subscription and no leak after unmount', () => {
    const { element, engineState, fire } = createFakeStackViewport('vp-strict');
    const addSpy = vi.spyOn(element, 'addEventListener');
    const removeSpy = vi.spyOn(element, 'removeEventListener');

    const { result, unmount } = renderHook(() => useViewportState('vp-strict'), {
      wrapper: strictModeWrapper,
    });

    const liveAfterMount = addSpy.mock.calls.length - removeSpy.mock.calls.length;
    const liveTypes = new Set(addSpy.mock.calls.map(([type]) => type));
    expect(liveAfterMount).toBe(liveTypes.size);

    engineState.sliceIndex = 7;
    fire(Enums.Events.STACK_NEW_IMAGE);
    expect(asStack(result.current)?.sliceIndex).toBe(7);

    unmount();
    expect(addSpy.mock.calls.length).toBe(removeSpy.mock.calls.length);
  });

  test('fills automatically when the viewport is enabled after the hook mounted', () => {
    const { engineState, enable } = createFakeStackViewport('vp-late', { enabled: false });
    const { result } = renderHook(() => useViewportState('vp-late'));
    expect(result.current).toBeUndefined();

    enable();

    expect(result.current).toEqual({
      kind: 'stack',
      camera: engineState.camera,
      voiRange: engineState.voiRange,
      sliceIndex: engineState.sliceIndex,
      numberOfSlices: 3,
    });
  });

  test('returns to undefined when the viewport is disabled — no stale value', () => {
    const { disable } = createFakeStackViewport('vp-gone');
    const { result } = renderHook(() => useViewportState('vp-gone'));
    expect(result.current).toBeDefined();

    disable();

    expect(result.current).toBeUndefined();
  });

  test('keeps tracking Engine events on a viewport re-enabled after disable', () => {
    const { engineState, fire, enable, disable } = createFakeStackViewport('vp-cycle');
    const { result } = renderHook(() => useViewportState('vp-cycle'));

    disable();
    enable();
    engineState.sliceIndex = 11;
    fire(Enums.Events.STACK_NEW_IMAGE);

    expect(asStack(result.current)?.sliceIndex).toBe(11);
  });

  test('ignores lifecycle events for other viewports', () => {
    createFakeStackViewport('vp-mine');
    const { result } = renderHook(() => useViewportState('vp-mine'));
    const before = result.current;

    act(() => {
      eventTarget.dispatchEvent(
        new CustomEvent(Enums.Events.ELEMENT_DISABLED, {
          detail: { viewportId: 'vp-other', element: document.createElement('div') },
        }),
      );
    });

    expect(result.current).toBe(before);
  });

  test('no stale value on remount after the viewport was disabled while unobserved', () => {
    const { disable } = createFakeStackViewport('vp-dormant');
    const first = renderHook(() => useViewportState('vp-dormant'));
    expect(first.result.current).toBeDefined();
    first.unmount();

    disable(); // Binding is detached — it cannot hear this

    // The stale Snapshot would only surface in the very first render frame
    // (before subscribe runs), so capture every render-time value.
    const seen: unknown[] = [];
    renderHook(() => {
      seen.push(useViewportState('vp-dormant'));
    });
    expect(seen).toEqual([undefined]);
  });

  test('repeated enable/disable cycles leak no subscriptions', () => {
    const { element, enable, disable } = createFakeStackViewport('vp-churn', {
      enabled: false,
    });
    const elementAdd = vi.spyOn(element, 'addEventListener');
    const elementRemove = vi.spyOn(element, 'removeEventListener');
    const targetAdd = vi.spyOn(eventTarget, 'addEventListener');
    const targetRemove = vi.spyOn(eventTarget, 'removeEventListener');

    const { unmount } = renderHook(() => useViewportState('vp-churn'));
    for (let i = 0; i < 3; i++) {
      enable();
      disable();
    }
    unmount();

    expect(elementAdd.mock.calls.length).toBe(elementRemove.mock.calls.length);
    expect(targetAdd.mock.calls.length).toBe(targetRemove.mock.calls.length);
    targetAdd.mockRestore();
    targetRemove.mockRestore();
  });

  describe('selector', () => {
    test('does not re-render when only unselected state changes', () => {
      const { engineState, fire } = createFakeStackViewport('vp-sel-skip');
      let renders = 0;
      const { result } = renderHook(() => {
        renders++;
        return useViewportState('vp-sel-skip', selectStackIndex);
      });
      const rendersBefore = renders;

      engineState.camera.parallelScale = 50; // zoom only
      fire(Enums.Events.CAMERA_MODIFIED);

      expect(renders).toBe(rendersBefore);
      expect(result.current).toBe(0);
    });

    test('re-renders exactly once when the selected value changes', () => {
      const { engineState, fire } = createFakeStackViewport('vp-sel-hit');
      let renders = 0;
      const { result } = renderHook(() => {
        renders++;
        return useViewportState('vp-sel-hit', selectStackIndex);
      });
      const rendersBefore = renders;

      engineState.sliceIndex = 42;
      fire(Enums.Events.STACK_NEW_IMAGE);

      expect(result.current).toBe(42);
      expect(renders).toBe(rendersBefore + 1);
    });

    test('without a selector returns the whole Viewport State', () => {
      const { engineState } = createFakeStackViewport('vp-sel-none');

      const { result } = renderHook(() => useViewportState('vp-sel-none'));

      expect(result.current).toEqual({
        kind: 'stack',
        camera: engineState.camera,
        voiRange: engineState.voiRange,
        sliceIndex: engineState.sliceIndex,
        numberOfSlices: 3,
      });
    });

    test('when the viewport is absent the selector is not called and undefined is returned', () => {
      const selector = vi.fn((s: ViewportState) => s.kind);

      const { result } = renderHook(() => useViewportState('vp-sel-absent', selector));

      expect(result.current).toBeUndefined();
      expect(selector).not.toHaveBeenCalled();
    });

    test('a sub-object selector survives a change to an unrelated field', () => {
      const { engineState, fire } = createFakeStackViewport('vp-sel-sub-object');
      let renders = 0;
      const { result } = renderHook(() => {
        renders++;
        return useViewportState('vp-sel-sub-object', (s) => s.voiRange);
      });
      const rendersBefore = renders;
      const first = result.current;

      engineState.camera.parallelScale = 50; // zoom only — the VOI is untouched
      fire(Enums.Events.CAMERA_MODIFIED);

      expect(result.current).toBe(first);
      expect(renders).toBe(rendersBefore);
    });

    test('a sub-object selector sees a new reference when that field really changes', () => {
      const { engineState, fire } = createFakeStackViewport('vp-sel-sub-changed');
      const { result } = renderHook(() => useViewportState('vp-sel-sub-changed', (s) => s.voiRange));
      const first = result.current;

      engineState.voiRange = { lower: -100, upper: 300 };
      fire(Enums.Events.VOI_MODIFIED);

      expect(result.current).not.toBe(first);
      expect(result.current).toEqual({ lower: -100, upper: 300 });
    });

    test('inline selector returning an object stays referentially stable across re-renders', () => {
      createFakeStackViewport('vp-sel-inline');
      const { result, rerender } = renderHook(() =>
        useViewportState('vp-sel-inline', (s) => s.camera),
      );
      const first = result.current;

      rerender();

      expect(result.current).toBe(first);
    });

    test('selector sees undefined again after the viewport is disabled', () => {
      const { disable } = createFakeStackViewport('vp-sel-gone');
      const { result } = renderHook(() => useViewportState('vp-sel-gone', selectStackIndex));
      expect(result.current).toBe(0);

      disable();

      expect(result.current).toBeUndefined();
    });
  });

  // A Snapshot is replaced whenever any field moves. Structural sharing keeps
  // the parts that did not move at their previous references, so a selector
  // reading one of them does not re-render.
  describe('structural sharing', () => {
    test('a camera-only change keeps the previous voiRange reference', () => {
      const { engineState, fire } = createFakeStackViewport('vp-share-voi');
      const { result } = renderHook(() => useViewportState('vp-share-voi'));
      const before = result.current;

      engineState.camera.parallelScale = 50;
      fire(Enums.Events.CAMERA_MODIFIED);

      expect(result.current).not.toBe(before); // the Snapshot did change
      expect(result.current?.voiRange).toBe(before?.voiRange);
    });

    test('a VOI-only change keeps the previous camera reference', () => {
      const { engineState, fire } = createFakeStackViewport('vp-share-camera');
      const { result } = renderHook(() => useViewportState('vp-share-camera'));
      const before = result.current;

      engineState.voiRange = { lower: -100, upper: 300 };
      fire(Enums.Events.VOI_MODIFIED);

      expect(result.current).not.toBe(before);
      expect(result.current?.camera).toBe(before?.camera);
    });

    test('a slice change keeps both the camera and the voiRange references', () => {
      const { engineState, fire } = createFakeStackViewport('vp-share-slice');
      const { result } = renderHook(() => useViewportState('vp-share-slice'));
      const before = result.current;

      engineState.sliceIndex = 2;
      fire(Enums.Events.PRE_STACK_NEW_IMAGE);

      expect(asStack(result.current)?.sliceIndex).toBe(2);
      expect(result.current?.camera).toBe(before?.camera);
      expect(result.current?.voiRange).toBe(before?.voiRange);
    });

    test('a zoom keeps the camera arrays it did not touch', () => {
      const { engineState, fire } = createFakeStackViewport('vp-share-camera-fields');
      const { result } = renderHook(() => useViewportState('vp-share-camera-fields'));
      const before = result.current;

      engineState.camera.parallelScale = 50; // position and focalPoint hold still
      fire(Enums.Events.CAMERA_MODIFIED);

      expect(result.current?.camera).not.toBe(before?.camera);
      expect(result.current?.camera.position).toBe(before?.camera.position);
      expect(result.current?.camera.focalPoint).toBe(before?.camera.focalPoint);
    });

    test('a pan gives a new position array and keeps the untouched ones', () => {
      const { engineState, fire } = createFakeStackViewport('vp-share-camera-moved');
      const { result } = renderHook(() => useViewportState('vp-share-camera-moved'));
      const before = result.current;

      engineState.camera.position = [10, 0, 100];
      fire(Enums.Events.CAMERA_MODIFIED);

      expect(result.current?.camera.position).not.toBe(before?.camera.position);
      expect(result.current?.camera.position).toEqual([10, 0, 100]);
      expect(result.current?.camera.focalPoint).toBe(before?.camera.focalPoint);
    });

    test('a shared sub-object is still frozen', () => {
      const { engineState, fire } = createFakeStackViewport('vp-share-frozen');
      const { result } = renderHook(() => useViewportState('vp-share-frozen'));

      engineState.camera.parallelScale = 50;
      fire(Enums.Events.CAMERA_MODIFIED);

      expect(Object.isFrozen(result.current?.voiRange)).toBe(true);
      expect(Object.isFrozen(result.current?.camera.position)).toBe(true);
    });

    test('a Volume viewport shares its voiRange across camera events too', () => {
      const { engineState, fire } = createFakeVolumeViewport('vp-share-vol');
      const { result } = renderHook(() => useViewportState('vp-share-vol'));
      const before = result.current;

      engineState.camera.parallelScale = 50;
      fire(Enums.Events.CAMERA_MODIFIED);

      expect(result.current).not.toBe(before);
      expect(result.current?.voiRange).toBe(before?.voiRange);
    });
  });

  describe('rAF batching', () => {
    test('multiple Engine events within one frame collapse into one re-render', () => {
      const { engineState, fireRaw } = createFakeStackViewport('vp-batch');
      let renders = 0;
      const { result } = renderHook(() => {
        renders++;
        return useViewportState('vp-batch');
      });
      const rendersBefore = renders;

      engineState.camera.parallelScale = 50;
      fireRaw(Enums.Events.CAMERA_MODIFIED);
      engineState.camera.parallelScale = 25;
      fireRaw(Enums.Events.CAMERA_MODIFIED);
      engineState.camera.parallelScale = 10;
      fireRaw(Enums.Events.CAMERA_MODIFIED);
      expect(renders).toBe(rendersBefore); // nothing until the frame ends

      act(() => vi.advanceTimersToNextFrame());

      expect(renders).toBe(rendersBefore + 1);
      expect(result.current?.camera.parallelScale).toBe(10); // last event wins
    });

    test('batch: false updates on every Engine event, no frame needed', () => {
      const { engineState, fireRaw } = createFakeStackViewport('vp-nobatch');
      let renders = 0;
      const { result } = renderHook(() => {
        renders++;
        return useViewportState('vp-nobatch', undefined, { batch: false });
      });
      const rendersBefore = renders;

      engineState.camera.parallelScale = 50;
      fireRaw(Enums.Events.CAMERA_MODIFIED);
      expect(result.current?.camera.parallelScale).toBe(50);
      engineState.camera.parallelScale = 25;
      fireRaw(Enums.Events.CAMERA_MODIFIED);
      expect(result.current?.camera.parallelScale).toBe(25);

      expect(renders).toBe(rendersBefore + 2);
    });

    test('unmount cancels the scheduled rAF callback', () => {
      const { fireRaw } = createFakeStackViewport('vp-raf-cleanup');
      const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
      const { unmount } = renderHook(() => useViewportState('vp-raf-cleanup'));

      fireRaw(Enums.Events.CAMERA_MODIFIED); // schedules a rAF
      unmount();

      expect(cancelSpy).toHaveBeenCalled();
      cancelSpy.mockRestore();
    });

    test('viewport disable cancels the scheduled rAF callback', () => {
      const { fireRaw, disable } = createFakeStackViewport('vp-raf-disable');
      const { result } = renderHook(() => useViewportState('vp-raf-disable'));

      fireRaw(Enums.Events.CAMERA_MODIFIED);
      disable();
      act(() => vi.advanceTimersToNextFrame());

      expect(result.current).toBeUndefined(); // pending rAF must not resurrect state
    });
  });

  describe('Volume viewports', () => {
    test('returns the current Volume Viewport State with kind "volume" and no Stack fields', () => {
      const { engineState } = createFakeVolumeViewport('vp-vol');

      const { result } = renderHook(() => useViewportState('vp-vol'));

      expect(result.current).toEqual({
        kind: 'volume',
        camera: engineState.camera,
        voiRange: engineState.voiRange,
        sliceIndex: undefined,
        numberOfSlices: undefined,
      });
    });

    test('Slice Position arrives with the volume (VOLUME_VIEWPORT_NEW_VOLUME) and follows the camera', () => {
      const { engineState, fire } = createFakeVolumeViewport('vp-vol-slices');
      const { result } = renderHook(() => useViewportState('vp-vol-slices'));
      expect(result.current?.numberOfSlices).toBeUndefined();

      engineState.sliceIndex = 0;
      engineState.numberOfSlices = 40;
      fire(Enums.Events.VOLUME_VIEWPORT_NEW_VOLUME);
      expect(result.current?.numberOfSlices).toBe(40);

      engineState.sliceIndex = 7;
      fire(Enums.Events.CAMERA_MODIFIED);
      expect(result.current?.sliceIndex).toBe(7);
    });

    test('a 3D volume viewport has no Slice Position and its getters are never called', () => {
      // The fake has no getNumberOfSlices, like CS3D's 3D class: calling it would throw.
      createFakeVolumeViewport('vp-vol-3d', { type: Enums.ViewportType.VOLUME_3D });
      const { result } = renderHook(() => useViewportState('vp-vol-3d'));
      expect(result.current?.kind).toBe('volume');
      expect(result.current?.sliceIndex).toBeUndefined();
      expect(result.current?.numberOfSlices).toBeUndefined();
    });

    test('one selector reads Slice Position from Stack and Volume alike', () => {
      const stack = createFakeStackViewport('vp-slider-stack');
      const volume = createFakeVolumeViewport('vp-slider-vol');
      volume.engineState.sliceIndex = 3;
      volume.engineState.numberOfSlices = 10;
      const slider = (s: ViewportState) => `${s.sliceIndex}/${s.numberOfSlices}`;
      const { result } = renderHook(() => ({
        stack: useViewportState('vp-slider-stack', slider),
        volume: useViewportState('vp-slider-vol', slider),
      }));
      stack.engineState.sliceIndex = 2;
      stack.fire(Enums.Events.PRE_STACK_NEW_IMAGE);
      expect(result.current.stack).toBe('2/3');
      expect(result.current.volume).toBe('3/10');
    });

    test('camera Engine events sync Volume state', () => {
      const { engineState, fire } = createFakeVolumeViewport('vp-vol-cam');
      const { result } = renderHook(() => useViewportState('vp-vol-cam'));

      engineState.camera.parallelScale = 50;
      fire(Enums.Events.CAMERA_MODIFIED);

      expect(result.current?.camera.parallelScale).toBe(50);
    });

    test('VOI Engine events sync Volume state', () => {
      const { engineState, fire } = createFakeVolumeViewport('vp-vol-voi');
      const { result } = renderHook(() => useViewportState('vp-vol-voi'));

      engineState.voiRange = { lower: -500, upper: 500 };
      fire(Enums.Events.VOI_MODIFIED);

      expect(result.current?.voiRange).toEqual({ lower: -500, upper: 500 });
    });

    test('a Stack and a Volume viewport observed together stay independent', () => {
      const stack = createFakeStackViewport('vp-mix-stack');
      const volume = createFakeVolumeViewport('vp-mix-vol');
      const { result } = renderHook(() => ({
        stack: useViewportState('vp-mix-stack'),
        volume: useViewportState('vp-mix-vol'),
      }));

      stack.engineState.sliceIndex = 7;
      stack.fire(Enums.Events.STACK_NEW_IMAGE);
      volume.engineState.camera.parallelScale = 33;
      volume.fire(Enums.Events.CAMERA_MODIFIED);

      expect(result.current.stack?.kind).toBe('stack');
      expect(asStack(result.current.stack)?.sliceIndex).toBe(7);
      expect(result.current.stack?.camera.parallelScale).toBe(100); // untouched
      expect(result.current.volume?.kind).toBe('volume');
      expect(result.current.volume?.camera.parallelScale).toBe(33);
    });

    test('type-level: a Stack always has a Slice Position, a Volume may not', () => {
      const stackOnly = (state: StackViewportState): number => state.sliceIndex;
      const volumeOnly = (state: VolumeViewportState): number =>
        // @ts-expect-error — a Volume may have no Slice Position (3D, before data)
        state.sliceIndex;
      const union = (state: ViewportState): number =>
        // @ts-expect-error — narrow by kind first
        state.numberOfSlices;
      expect(stackOnly).toBeDefined();
      expect(volumeOnly).toBeDefined();
      expect(union).toBeDefined();
    });
  });

  test('a Snapshot handed to a consumer never changes afterwards', () => {
    const { engineState, fire } = createFakeStackViewport('vp-immutable');
    const { result } = renderHook(() => useViewportState('vp-immutable'));
    const before = result.current;

    engineState.camera.parallelScale = 25;
    engineState.sliceIndex = 3;
    fire(Enums.Events.CAMERA_MODIFIED);

    expect(before?.camera.parallelScale).toBe(100);
    expect(asStack(before)?.sliceIndex).toBe(0);
    expect(Object.isFrozen(result.current)).toBe(true);
    expect(Object.isFrozen(result.current?.camera)).toBe(true);
  });
});
