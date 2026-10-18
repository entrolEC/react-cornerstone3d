import type { Types } from '@cornerstonejs/core';
import { Enums, eventTarget, getEnabledElementByViewportId } from '@cornerstonejs/core';
import { LengthTool, ProbeTool, ToolGroupManager, addTool, annotation } from '@cornerstonejs/tools';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { refreshAnnotations, useAnnotations } from './index';
import { annotationBindings } from './useAnnotations';

// Real modules: the tools package's annotation state is the thing under
// test, driven through its own API so the events are the real ones. Only
// the viewport registry is replaced, as in every other unit suite.
vi.mock('@cornerstonejs/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cornerstonejs/core')>()),
  getEnabledElementByViewportId: vi.fn(),
}));

const FRAME = 'FOR-1';
interface FakeViewport {
  element: HTMLDivElement;
  getImageIds?: () => string[];
  isReferenceViewable?: (ref: { referencedImageId?: string }) => boolean;
}
const registry = new Map<string, { viewport: FakeViewport; FrameOfReferenceUID?: string }>();

function enable(viewportId: string, frame: string | undefined = FRAME) {
  const element = document.createElement('div');
  registry.set(viewportId, { viewport: { element }, FrameOfReferenceUID: frame });
  return element;
}

// A stack of images without a frame of reference (CR/DX/US/SC): what the
// tools package reads is the stack's imageIds and isReferenceViewable, which
// on a StackViewport matches referencedImageId against the stack.
function enableForLess(viewportId: string, stack: { imageIds: string[] }) {
  const element = document.createElement('div');
  registry.set(viewportId, {
    viewport: {
      element,
      getImageIds: () => stack.imageIds,
      isReferenceViewable: (ref) => stack.imageIds.includes(ref.referencedImageId!),
    },
  });
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

// A frame-of-reference-less annotation on one image: the tools package
// files it under its `undefined` group.
function drawOn(referencedImageId: string) {
  let uid = '';
  act(() => {
    uid = annotation.state.addAnnotation(
      {
        metadata: { toolName: 'Length', referencedImageId },
        data: { handles: { points: [[0, 0, 0], [1, 1, 0]] }, label: '' },
      } as never,
      undefined as never,
    );
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

  test('any tool name keys its own Binding: one with @ in it, one named *', () => {
    const group = ToolGroupManager.getToolGroup('tg')!;
    for (const name of ['Length@v2', '*']) {
      group.addToolInstance(name, LengthTool.toolName);
      group.setToolPassive(name);
    }
    enable('vp');
    const at = renderHook(() => useAnnotations('vp', 'Length@v2'));
    const all = renderHook(() => useAnnotations('vp'));
    const star = renderHook(() => useAnnotations('vp', '*'));
    expect(annotationBindings.size).toBe(3);
    const atUid = draw('Length@v2');
    const starUid = draw('*');
    const length = draw('Length');
    expect(at.result.current?.map((e) => e.annotationUID)).toEqual([atUid]);
    expect(star.result.current?.map((e) => e.annotationUID)).toEqual([starUid]);
    expect(all.result.current?.map((e) => e.annotationUID)).toEqual([atUid, starUid, length]);
  });

  test('without a frame of reference, the annotations on the viewport stack', () => {
    const stackA = { imageIds: ['cr:a0', 'cr:a1'] };
    enableForLess('a', stackA);
    enableForLess('b', { imageIds: ['cr:b0'] });
    // No frame of reference and no stack to stand in for it.
    registry.set('plain', { viewport: { element: document.createElement('div') } });
    const a = renderHook(() => useAnnotations('a'));
    const b = renderHook(() => useAnnotations('b'));
    const plain = renderHook(() => useAnnotations('plain'));
    const a0 = drawOn('cr:a0');
    const a1 = drawOn('cr:a1');
    const b0 = drawOn('cr:b0');
    draw('Length'); // on FRAME: not on a viewport without one
    expect(a.result.current?.map((e) => e.annotationUID)).toEqual([a0, a1]);
    expect(b.result.current?.map((e) => e.annotationUID)).toEqual([b0]);
    expect(plain.result.current).toEqual([]);
  });

  test('without a frame of reference, a new stack rebuilds the list, even in the same array', () => {
    const stack = { imageIds: ['cr:a0'] };
    const element = enableForLess('a', stack);
    const a0 = drawOn('cr:a0');
    const b0 = drawOn('cr:b0');
    const { result } = renderHook(() => useAnnotations('a'));
    expect(result.current?.map((e) => e.annotationUID)).toEqual([a0]);
    const before = result.current;

    // A scroll: the same stack, nothing pending, the same array.
    act(() => {
      element.dispatchEvent(new CustomEvent(Enums.Events.PRE_STACK_NEW_IMAGE));
      vi.advanceTimersToNextFrame();
    });
    expect(result.current).toBe(before);

    // setStack with a new array: seen at the first scroll event it fires.
    stack.imageIds = ['cr:b0'];
    act(() => {
      element.dispatchEvent(new CustomEvent(Enums.Events.PRE_STACK_NEW_IMAGE));
      vi.advanceTimersToNextFrame();
    });
    expect(result.current?.map((e) => e.annotationUID)).toEqual([b0]);

    // setStack with the same array refilled in place: VIEWPORT_NEW_IMAGE_SET.
    stack.imageIds.splice(0, 1, 'cr:a0');
    act(() => {
      element.dispatchEvent(new CustomEvent(Enums.Events.VIEWPORT_NEW_IMAGE_SET));
      vi.advanceTimersToNextFrame();
    });
    expect(result.current?.map((e) => e.annotationUID)).toEqual([a0]);
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

  test('storePointData samples (pointsInShape, pointsInVolume) are left out of the copy', () => {
    enable('vp');
    act(() => {
      annotation.state.addAnnotation(
        {
          metadata: { toolName: 'Length', FrameOfReferenceUID: FRAME, referencedImageId: 'img:0' },
          data: {
            handles: { points: [[0, 0, 0]] },
            cachedStats: {
              'img:0': {
                mean: 5,
                pointsInShape: [{ value: 1, pointLPS: [0, 0, 0], pointIJK: [0, 0, 0] }],
              },
              pointsInVolume: [[{ value: 1 }]],
            },
          },
        } as never,
        FRAME,
      );
    });
    const { result } = renderHook(() => useAnnotations('vp'));
    const stats = result.current![0].data.cachedStats as Record<string, Record<string, unknown>>;
    expect(stats['img:0']).toEqual({ mean: 5 });
    expect(stats).not.toHaveProperty('pointsInVolume');
  });

  test('restoreAnnotations is silent; refreshAnnotations rebuilds the list in the next frame', () => {
    refreshAnnotations(); // no live Binding: nothing to do
    enable('vp');
    const a = draw('Length', FRAME, 'a');
    const { result } = renderHook(() => useAnnotations('vp'));
    const saved = annotation.state.getAnnotationManager().saveAnnotations();
    const live = annotation.state.getAnnotation(a)!;
    live.data.label = 'edited';
    act(() => {
      annotation.state.triggerAnnotationModified(live);
      vi.advanceTimersToNextFrame();
    });
    expect(result.current![0].data.label).toBe('edited');

    // An app's undo: the saved state back, same uid, no event.
    annotation.state.getAnnotationManager().restoreAnnotations(saved);
    frame();
    expect(result.current![0].data.label).toBe('edited');
    act(() => {
      refreshAnnotations();
      vi.advanceTimersToNextFrame();
    });
    expect(result.current![0].data.label).toBe('a');

    annotation.state.getAnnotationManager().restoreAnnotations({});
    act(() => {
      refreshAnnotations();
      vi.advanceTimersToNextFrame();
    });
    expect(result.current).toEqual([]);
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
