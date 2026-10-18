import type { Types } from '@cornerstonejs/core';
import {
  Enums,
  RenderingEngine,
  imageLoader,
  init as csInit,
  metaData,
  utilities as csUtils,
} from '@cornerstonejs/core';
import {
  AnnotationTool,
  Enums as ToolsEnums,
  LengthTool,
  PlanarFreehandROITool,
  StackScrollTool,
  ToolGroupManager,
  WindowLevelTool,
  addTool,
  annotation,
  init as csToolsInit,
} from '@cornerstonejs/tools';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { useActiveTool, useAnnotations } from './index';
import {
  fakeMetaDataProvider,
  smokeImageIds as imageIds,
  smokeImageLoader,
} from '../testing/smokeStack';

// Smoke tests against the real Engine and the real tools package: which
// events `@cornerstonejs/tools` fires, when, and with what payloads. The
// jsdom suites own the hook logic.

beforeAll(async () => {
  await csInit();
  csToolsInit();
  imageLoader.registerImageLoader('smoke', smokeImageLoader);
  metaData.addProvider(fakeMetaDataProvider);
  addTool(StackScrollTool);
  addTool(WindowLevelTool);
  addTool(LengthTool);
  addTool(PlanarFreehandROITool);
});

let engine: RenderingEngine;
const elements: HTMLDivElement[] = [];

function makeElement(): HTMLDivElement {
  const element = document.createElement('div');
  element.style.width = '128px';
  element.style.height = '128px';
  document.body.appendChild(element);
  elements.push(element);
  return element;
}

afterEach(() => {
  cleanup();
  ToolGroupManager.destroy();
  annotation.state.removeAllAnnotations();
  engine?.destroy();
  for (const element of elements.splice(0)) element.remove();
});

async function enableStack(viewportId: string) {
  engine = new RenderingEngine('tools-engine');
  const element = makeElement();
  engine.enableElement({ viewportId, type: Enums.ViewportType.STACK, element });
  const viewport = engine.getViewport(viewportId) as Types.IStackViewport;
  await viewport.setStack(imageIds, 0);
  engine.render();
  return { element, viewport };
}

test('active tool: a real ToolGroup, setToolActive and setToolPassive reach the hook', async () => {
  await enableStack('vp');
  const { result } = renderHook(() => useActiveTool('vp'));
  expect(result.current).toBeUndefined(); // no group holds the viewport yet

  const group = ToolGroupManager.createToolGroup('tg')!;
  group.addTool(StackScrollTool.toolName);
  group.addTool(WindowLevelTool.toolName);
  group.addViewport('vp', engine.id);
  await waitFor(() => expect(result.current).toBeUndefined()); // added, nothing active

  group.setToolActive(WindowLevelTool.toolName, {
    bindings: [{ mouseButton: ToolsEnums.MouseBindings.Primary }],
  });
  await waitFor(() => expect(result.current).toBe(WindowLevelTool.toolName));

  // A tool active on another button is not the primary one.
  group.setToolActive(StackScrollTool.toolName, {
    bindings: [{ mouseButton: ToolsEnums.MouseBindings.Wheel }],
  });
  await waitFor(() => expect(result.current).toBe(WindowLevelTool.toolName));

  group.setToolPassive(WindowLevelTool.toolName);
  await waitFor(() => expect(result.current).toBeUndefined());

  group.removeViewports(engine.id, 'vp');
  await waitFor(() => expect(result.current).toBeUndefined());
});

test('annotations: added on the element, modified, and removed — on the viewport frame of reference', async () => {
  const { element } = await enableStack('vp');
  const { result } = renderHook(() => useAnnotations('vp', LengthTool.toolName));
  await waitFor(() => expect(result.current).toEqual([]));

  const drawn = {
    metadata: {
      toolName: LengthTool.toolName,
      FrameOfReferenceUID: 'smoke-FOR',
      referencedImageId: imageIds[0],
    },
    data: { handles: { points: [[0, 0, 0], [10, 10, 0]] }, label: '' },
  } as never;
  const uid = annotation.state.addAnnotation(drawn, element);
  await waitFor(() => expect(result.current).toHaveLength(1));
  expect(result.current![0]).toMatchObject({
    annotationUID: uid,
    toolName: LengthTool.toolName,
    referencedImageId: imageIds[0],
    isLocked: false,
    isVisible: true,
    isSelected: false,
  });
  const first = result.current![0];

  const live = annotation.state.getAnnotation(uid)!;
  live.data.label = 'moved';
  annotation.state.triggerAnnotationModified(live, element);
  await waitFor(() => expect(result.current![0].data.label).toBe('moved'));
  expect(result.current![0]).not.toBe(first);

  annotation.selection.setAnnotationSelected(uid, true);
  await waitFor(() => expect(result.current![0].isSelected).toBe(true));

  annotation.state.removeAnnotation(uid);
  await waitFor(() => expect(result.current).toEqual([]));
});

test('annotations: a contour restored by undo holds Float32Array views; the hook lists it as plain arrays', async () => {
  const { element } = await enableStack('vp');
  const drawn = {
    metadata: {
      toolName: PlanarFreehandROITool.toolName,
      FrameOfReferenceUID: 'smoke-FOR',
      referencedImageId: imageIds[0],
    },
    data: {
      handles: { points: [], textBox: { worldPosition: [0, 0, 0] } },
      contour: { polyline: [[1, 1, 0], [20, 1, 0], [20, 20, 0]], closed: true },
      label: '',
    },
  } as never;
  const uid = annotation.state.addAnnotation(drawn, element);
  const { result } = renderHook(() => useAnnotations('vp'));
  await waitFor(() => expect(result.current).toHaveLength(1));

  // What the Eraser does, then the app's Ctrl+Z.
  AnnotationTool.createAnnotationMemo(element, annotation.state.getAnnotation(uid)!, {
    deleting: true,
  });
  annotation.state.removeAnnotation(uid);
  await waitFor(() => expect(result.current).toEqual([]));
  csUtils.HistoryMemo.DefaultHistoryMemo.undo();
  const restored = annotation.state.getAnnotation(uid)!.data as { contour: { polyline: unknown[] } };
  expect(ArrayBuffer.isView(restored.contour.polyline[0])).toBe(true); // still the case under test

  await waitFor(() => expect(result.current).toHaveLength(1));
  const polyline = (result.current![0].data as { contour: { polyline: number[][] } }).contour.polyline;
  expect(polyline[0]).toEqual([1, 1, 0]);
  expect(Array.isArray(polyline[0]) && Object.isFrozen(polyline[0])).toBe(true);
});
