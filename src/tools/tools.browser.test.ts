import type { Types } from '@cornerstonejs/core';
import {
  Enums,
  RenderingEngine,
  imageLoader,
  getEnabledElementByViewportId,
  init as csInit,
  metaData,
  utilities as csUtils,
} from '@cornerstonejs/core';
import {
  AnnotationTool,
  Enums as ToolsEnums,
  LengthTool,
  PanTool,
  PlanarFreehandROITool,
  StackScrollTool,
  ToolGroupManager,
  WindowLevelTool,
  addTool,
  annotation,
  init as csToolsInit,
} from '@cornerstonejs/tools';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { useActiveTool, useAnnotations } from './index';
import {
  fakeMetaDataProvider,
  smokeImageIds as imageIds,
  smokeImageLoader,
} from '../testing/smokeStack';

// `cr:*` images: the smoke image with no frame of reference, as a CR, DX,
// US or SC image's metadata reports it.
function forLessMetaDataProvider(type: string, imageId: string) {
  if (!imageId.startsWith('cr:')) return undefined;
  const base = fakeMetaDataProvider(type, imageIds[0]);
  if (type !== 'imagePlaneModule' || !base) return base;
  const { frameOfReferenceUID: _, ...rest } = base as { frameOfReferenceUID?: string };
  return rest;
}

// Smoke tests against the real Engine and the real tools package: which
// events `@cornerstonejs/tools` fires, when, and with what payloads. The
// jsdom suites own the hook logic.

beforeAll(async () => {
  await csInit();
  csToolsInit();
  imageLoader.registerImageLoader('smoke', smokeImageLoader);
  imageLoader.registerImageLoader('cr', smokeImageLoader);
  metaData.addProvider(fakeMetaDataProvider);
  metaData.addProvider(forLessMetaDataProvider);
  addTool(StackScrollTool);
  addTool(WindowLevelTool);
  addTool(PanTool);
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

// The README's ToolButton, onClick as written there. setToolActive adds a
// binding and never takes Primary from the tool that held it, so the button
// sets that one passive first; without it the hook rightly keeps reporting
// the first tool, which is also the one CS3D's mouse dispatch picks.
function ToolButton({ viewportId, tool }: { viewportId: string; tool: string }) {
  const active = useActiveTool(viewportId);
  return createElement(
    'button',
    {
      'aria-pressed': active === tool,
      onClick: () => {
        const group = ToolGroupManager.getToolGroupForViewport(viewportId);
        const current = group?.getActivePrimaryMouseButtonTool();
        if (current && current !== tool) group!.setToolPassive(current);
        group?.setToolActive(tool, { bindings: [{ mouseButton: ToolsEnums.MouseBindings.Primary }] });
      },
    },
    tool,
  );
}

test('active tool: the README toolbar switches between two tools and the hook follows', async () => {
  await enableStack('vp');
  const group = ToolGroupManager.createToolGroup('tg')!;
  group.addTool(WindowLevelTool.toolName);
  group.addTool(PanTool.toolName);
  group.addTool(StackScrollTool.toolName);
  group.addViewport('vp', engine.id);
  group.setToolActive(StackScrollTool.toolName, {
    bindings: [{ mouseButton: ToolsEnums.MouseBindings.Wheel }],
  });
  const { result } = renderHook(() => useActiveTool('vp'));
  render(
    createElement(
      'div',
      null,
      createElement(ToolButton, { viewportId: 'vp', tool: WindowLevelTool.toolName }),
      createElement(ToolButton, { viewportId: 'vp', tool: PanTool.toolName }),
    ),
  );
  const primaryTools = () =>
    [WindowLevelTool.toolName, PanTool.toolName].filter((name) => {
      const options = group.getToolOptions(name);
      return (
        options?.mode === ToolsEnums.ToolModes.Active &&
        options.bindings.some((b) => b.mouseButton === ToolsEnums.MouseBindings.Primary)
      );
    });

  for (const tool of [WindowLevelTool.toolName, PanTool.toolName, WindowLevelTool.toolName]) {
    fireEvent.click(screen.getByText(tool));
    await waitFor(() => expect(result.current).toBe(tool));
    expect(screen.getByText(tool).getAttribute('aria-pressed')).toBe('true');
    expect(primaryTools()).toEqual([tool]); // one tool on Primary, not two
  }
  // setToolPassive took only the primary binding: the wheel tool stays.
  expect(group.getToolOptions(StackScrollTool.toolName).mode).toBe(ToolsEnums.ToolModes.Active);
});

test('active tool: a viewport added to its group before enable resolves once enabled', async () => {
  engine = new RenderingEngine('tools-engine');
  const group = ToolGroupManager.createToolGroup('tg')!;
  group.addTool(WindowLevelTool.toolName);
  group.setToolActive(WindowLevelTool.toolName, {
    bindings: [{ mouseButton: ToolsEnums.MouseBindings.Primary }],
  });
  group.addViewport('vp', engine.id); // no viewport yet: the lookup finds no group
  const { result } = renderHook(() => useActiveTool('vp'));
  expect(result.current).toBeUndefined();

  engine.enableElement({ viewportId: 'vp', type: Enums.ViewportType.STACK, element: makeElement() });
  await waitFor(() => expect(result.current).toBe(WindowLevelTool.toolName));
});

test('active tool: a destroyed group stays stale until its viewport is disabled', async () => {
  await enableStack('vp');
  const group = ToolGroupManager.createToolGroup('tg')!;
  group.addTool(WindowLevelTool.toolName);
  group.addViewport('vp', engine.id);
  group.setToolActive(WindowLevelTool.toolName, {
    bindings: [{ mouseButton: ToolsEnums.MouseBindings.Primary }],
  });
  const { result } = renderHook(() => useActiveTool('vp'));
  await waitFor(() => expect(result.current).toBe(WindowLevelTool.toolName));

  // destroyToolGroup fires nothing: the hook keeps the old name. This pins
  // the upstream silence; if it fails, CS3D now fires an event — listen to it.
  ToolGroupManager.destroyToolGroup('tg');
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(result.current).toBe(WindowLevelTool.toolName);

  // With the group gone, disable fires no TOOLGROUP_VIEWPORT_REMOVED.
  engine.disableElement('vp');
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

test('annotations: images without a frame of reference list the ones on the viewport stack', async () => {
  engine = new RenderingEngine('tools-engine');
  for (const viewportId of ['a', 'b']) {
    engine.enableElement({ viewportId, type: Enums.ViewportType.STACK, element: makeElement() });
  }
  const a = engine.getViewport('a') as Types.IStackViewport;
  const b = engine.getViewport('b') as Types.IStackViewport;
  await a.setStack(['cr:a0', 'cr:a1', 'cr:a2'], 0);
  await b.setStack(['cr:b0'], 0);
  expect(getEnabledElementByViewportId('a')!.FrameOfReferenceUID).toBeUndefined();
  const group = ToolGroupManager.createToolGroup('tg')!;
  group.addTool(LengthTool.toolName);
  group.addViewport('a', engine.id);
  group.addViewport('b', engine.id);
  group.setToolPassive(LengthTool.toolName);
  const hookA = renderHook(() => useAnnotations('a'));
  const hookB = renderHook(() => useAnnotations('b'));
  const uids = () => annotation.state.getAllAnnotations().map((x) => x.annotationUID);

  // CS3D's own path: metadata from getViewReference, added on the element.
  const draw = (viewport: Types.IStackViewport) => {
    LengthTool.createAndAddAnnotation(viewport as never, {
      data: { handles: { points: [[0, 0, 0], [10, 10, 0]] }, label: '' },
    } as never);
    return uids()[uids().length - 1]!;
  };
  const a0 = draw(a);
  await a.setImageIdIndex(2);
  const a2 = draw(a);
  const b0 = draw(b);
  await waitFor(() => expect(hookA.result.current?.map((x) => x.annotationUID)).toEqual([a0, a2]));
  expect(hookB.result.current?.map((x) => x.annotationUID)).toEqual([b0]);

  // A scroll keeps the list: it is per stack, not per image. (Settle first:
  // the tools package's first render of a Length fires MODIFIED with stats.)
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
  await settle();
  const before = hookA.result.current;
  await a.setImageIdIndex(1);
  await settle();
  expect(hookA.result.current).toBe(before);

  await a.setStack(['cr:b0'], 0);
  await waitFor(() => expect(hookA.result.current?.map((x) => x.annotationUID)).toEqual([b0]));
});

test('annotations: volume and WSI viewports with no data yet list nothing and do not throw', async () => {
  engine = new RenderingEngine('tools-engine');
  // No frame of reference before setVolumes / setWSI, and their getImageIds
  // throw until then: the mount-then-load order every app has.
  const types = [
    Enums.ViewportType.ORTHOGRAPHIC,
    Enums.ViewportType.VOLUME_3D,
    Enums.ViewportType.WHOLE_SLIDE,
  ];
  for (const type of types) {
    engine.enableElement({ viewportId: type, type, element: makeElement() });
    expect(renderHook(() => useAnnotations(type)).result.current).toEqual([]);
  }
  // Hook first, then the viewport: the rebuild runs in the ELEMENT_ENABLED listener.
  const hook = renderHook(() => useAnnotations('later'));
  expect(hook.result.current).toBeUndefined();
  engine.enableElement({
    viewportId: 'later',
    type: Enums.ViewportType.ORTHOGRAPHIC,
    element: makeElement(),
  });
  await waitFor(() => expect(hook.result.current).toEqual([]));
});
