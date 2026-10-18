import type { Types } from '@cornerstonejs/core';
import { Enums, eventTarget, getEnabledElementByViewportId } from '@cornerstonejs/core';
import { LengthTool, ProbeTool, ToolGroupManager, addTool, annotation } from '@cornerstonejs/tools';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { useAnnotations } from './index';
import { annotationBindings } from './useAnnotations';

// Real modules: the tools package's annotation state is the thing under
// test, driven through its own API so the events are the real ones. Only
// the viewport registry is replaced, as in every other unit suite.
vi.mock('@cornerstonejs/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cornerstonejs/core')>()),
  getEnabledElementByViewportId: vi.fn(),
}));

const FRAME = 'FOR-1';
const registry = new Map<string, { viewport: { element: HTMLDivElement }; FrameOfReferenceUID?: string }>();

function enable(viewportId: string, frame: string | undefined = FRAME) {
  const element = document.createElement('div');
  registry.set(viewportId, { viewport: { element }, FrameOfReferenceUID: frame });
  return element;
}

// The tools package fires ANNOTATION_ADDED for an annotation added by frame
// of reference only when some ToolGroup has its tool in a mode (an early
// return in triggerAnnotationAddedForFOR, which reads the groups'
// toolOptions) — so a group with both tools passive stands in for the app's.
beforeAll(() => {
  addTool(LengthTool);
  addTool(ProbeTool);
});

beforeEach(() => {
  const group = ToolGroupManager.createToolGroup('tg')!;
  group.addTool(LengthTool.toolName);
  group.addTool(ProbeTool.toolName);
  group.setToolPassive(LengthTool.toolName);
  group.setToolPassive(ProbeTool.toolName);
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });
  vi.mocked(getEnabledElementByViewportId).mockImplementation(
    (id) => registry.get(id) as unknown as Types.IEnabledElement,
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  annotation.state.removeAllAnnotations();
  ToolGroupManager.destroy();
  registry.clear();
  vi.mocked(getEnabledElementByViewportId).mockReset();
});

// A Length-shaped annotation on `frame`. Added by frame of reference, not by
// element, so no Engine is needed; the tools package still fires ADDED.
function draw(toolName: string, frame = FRAME, label = '') {
  const drawn = {
    metadata: { toolName, FrameOfReferenceUID: frame, referencedImageId: 'img:0' },
    data: {
      handles: { points: [[0, 0, 0], [1, 1, 0]] },
      label,
    },
  } as never;
  let uid = '';
  act(() => {
    uid = annotation.state.addAnnotation(drawn, frame);
    vi.advanceTimersToNextFrame();
  });
  return uid;
}

const frame = () =>
  act(() => {
    vi.advanceTimersToNextFrame();
  });

describe('useAnnotations', () => {
  test('undefined without a viewport; a stable empty array with one and nothing drawn', () => {
    const { result } = renderHook(() => useAnnotations('vp'));
    expect(result.current).toBeUndefined();

    const element = enable('vp');
    act(() => {
      eventTarget.dispatchEvent(
        new CustomEvent(Enums.Events.ELEMENT_ENABLED, { detail: { viewportId: 'vp', element } }),
      );
    });
    expect(result.current).toEqual([]);
    const empty = result.current;
    frame();
    expect(result.current).toBe(empty);
  });

  test('ADDED, MODIFIED and REMOVED reach the list; untouched entries keep their reference', () => {
    enable('vp');
    const { result } = renderHook(() => useAnnotations('vp'));

    const a = draw('Length', FRAME, 'a');
    const b = draw('Length', FRAME, 'b');
    expect(result.current?.map((e) => e.annotationUID)).toEqual([a, b]);
    // toMatchObject: the tools package adds `handles.textBox` and
    // `cachedStats` to every annotation it stores.
    expect(result.current?.[0].data).toMatchObject({
      handles: { points: [[0, 0, 0], [1, 1, 0]] },
      label: 'a',
    });
    expect(Object.isFrozen(result.current?.[0].data)).toBe(true);
    const entryA = result.current![0];
    const entryB = result.current![1];

    // Modify b: the tools package says so, b is rebuilt, a is kept.
    const live = annotation.state.getAnnotation(b)!;
    live.data.label = 'b2';
    act(() => {
      annotation.state.triggerAnnotationModified(live);
      vi.advanceTimersToNextFrame();
    });
    expect(result.current![0]).toBe(entryA);
    expect(result.current![1]).not.toBe(entryB);
    expect(result.current![1].data.label).toBe('b2');

    act(() => {
      annotation.state.removeAnnotation(a);
      vi.advanceTimersToNextFrame();
    });
    expect(result.current?.map((e) => e.annotationUID)).toEqual([b]);
  });

  test('toolName narrows to one tool; another frame of reference is not listed', () => {
    enable('vp');
    const { result } = renderHook(() => useAnnotations('vp', 'Length'));
    const length = draw('Length');
    draw('Probe');
    draw('Length', 'FOR-elsewhere');
    expect(result.current?.map((e) => e.annotationUID)).toEqual([length]);
  });

  test('lock, visibility and selection are fields; a flag change replaces only that entry', () => {
    enable('vp');
    const { result } = renderHook(() => useAnnotations('vp'));
    const a = draw('Length');
    const b = draw('Length');
    const entryB = result.current![1];
    expect(result.current![0]).toMatchObject({ isLocked: false, isVisible: true, isSelected: false });

    act(() => {
      annotation.locking.setAnnotationLocked(a, true);
      vi.advanceTimersToNextFrame();
    });
    expect(result.current![0].isLocked).toBe(true);
    expect(result.current![1]).toBe(entryB);

    act(() => {
      annotation.selection.setAnnotationSelected(a, true);
      vi.advanceTimersToNextFrame();
    });
    expect(result.current![0].isSelected).toBe(true);

    act(() => {
      annotation.visibility.setAnnotationVisibility(b, false);
      vi.advanceTimersToNextFrame();
    });
    expect(result.current![1].isVisible).toBe(false);
    expect(result.current![1]).not.toBe(entryB);
  });

  test('a camera move with nothing pending keeps the array; two hooks share one Binding', () => {
    const element = enable('vp');
    draw('Length');
    let renders = 0;
    const first = renderHook(() => {
      renders++;
      return useAnnotations('vp');
    });
    const second = renderHook(() => useAnnotations('vp'));
    expect(annotationBindings.size).toBe(1);
    expect(second.result.current).toBe(first.result.current);
    const before = renders;

    act(() => {
      element.dispatchEvent(new CustomEvent(Enums.Events.CAMERA_MODIFIED));
      vi.advanceTimersToNextFrame();
    });
    expect(renders).toBe(before);

    first.unmount();
    second.unmount();
    expect(annotationBindings.size).toBe(0);
  });

  test('typed arrays in data become frozen plain arrays', () => {
    enable('vp');
    // A contour restored by CS3D undo holds Float32Array views of one buffer
    // (PointsManager.points); Object.freeze throws on a non-empty one.
    const buffer = new Float32Array([1, 2, 3, 4, 5, 6]);
    act(() => {
      annotation.state.addAnnotation(
        {
          metadata: { toolName: 'Length', FrameOfReferenceUID: FRAME, referencedImageId: 'img:0' },
          data: {
            handles: { points: [buffer.subarray(0, 3), buffer.subarray(3, 6)] },
            cachedStats: { 'img:0': { samples: new Float32Array([7, 8]) } },
          },
        } as never,
        FRAME,
      );
    });
    const { result } = renderHook(() => useAnnotations('vp'));
    const data = result.current![0].data as {
      handles: { points: number[][] };
      cachedStats: Record<string, { samples: number[] }>;
    };
    expect(data.handles.points).toEqual([[1, 2, 3], [4, 5, 6]]);
    expect(Array.isArray(data.handles.points[0])).toBe(true);
    expect(Object.isFrozen(data.handles.points[0])).toBe(true);
    expect(data.cachedStats['img:0'].samples).toEqual([7, 8]);
    expect(Object.isFrozen(data.cachedStats['img:0'].samples)).toBe(true);
  });

  test('a disabled viewport empties the list; a re-enable fills it again', () => {
    const element = enable('vp');
    draw('Length');
    const { result } = renderHook(() => useAnnotations('vp'));
    expect(result.current).toHaveLength(1);

    act(() => {
      eventTarget.dispatchEvent(
        new CustomEvent(Enums.Events.ELEMENT_DISABLED, { detail: { viewportId: 'vp' } }),
      );
      registry.delete('vp');
    });
    expect(result.current).toBeUndefined();

    act(() => {
      registry.set('vp', { viewport: { element }, FrameOfReferenceUID: FRAME });
      eventTarget.dispatchEvent(
        new CustomEvent(Enums.Events.ELEMENT_ENABLED, { detail: { viewportId: 'vp', element } }),
      );
    });
    expect(result.current).toHaveLength(1);
  });
});
