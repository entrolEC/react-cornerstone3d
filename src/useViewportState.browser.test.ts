import type { Types } from '@cornerstonejs/core';
import {
  Enums,
  RenderingEngine,
  imageLoader,
  init as csInit,
  metaData,
  volumeLoader,
} from '@cornerstonejs/core';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { useViewportState, type StackViewportState } from './index';

// Smoke tests against the real Engine on a real canvas. They verify the
// assumption layer the jsdom fakes encode: which events CS3D actually fires,
// when, and with what payloads — not the hook logic (jsdom suite owns that).

const ROWS = 64;
const COLS = 64;
const imageIds = ['smoke:0', 'smoke:1', 'smoke:2'];

function fakeImage(imageId: string): Types.IImage {
  const pixelData = new Uint8Array(ROWS * COLS);
  return {
    imageId,
    rows: ROWS,
    columns: COLS,
    height: ROWS,
    width: COLS,
    color: false,
    rgba: false,
    numberOfComponents: 1,
    dataType: 'Uint8Array',
    slope: 1,
    intercept: 0,
    windowCenter: 128,
    windowWidth: 256,
    voiLUTFunction: 'LINEAR',
    minPixelValue: 0,
    maxPixelValue: 255,
    rowPixelSpacing: 1,
    columnPixelSpacing: 1,
    invert: false,
    sizeInBytes: pixelData.byteLength,
    getPixelData: () => pixelData,
    getCanvas: undefined,
  } as unknown as Types.IImage;
}

function fakeMetaDataProvider(type: string, imageId: string) {
  const sliceIndex = imageIds.indexOf(imageId);
  if (sliceIndex === -1) return undefined;
  switch (type) {
    case 'imagePlaneModule':
      return {
        frameOfReferenceUID: 'smoke-FOR',
        rows: ROWS,
        columns: COLS,
        imageOrientationPatient: [1, 0, 0, 0, 1, 0],
        rowCosines: [1, 0, 0],
        columnCosines: [0, 1, 0],
        imagePositionPatient: [0, 0, sliceIndex],
        pixelSpacing: [1, 1],
        rowPixelSpacing: 1,
        columnPixelSpacing: 1,
        sliceThickness: 1,
      };
    case 'imagePixelModule':
      return {
        samplesPerPixel: 1,
        photometricInterpretation: 'MONOCHROME2',
        rows: ROWS,
        columns: COLS,
        bitsAllocated: 8,
        bitsStored: 8,
        highBit: 7,
        pixelRepresentation: 0,
      };
    case 'generalSeriesModule':
      return { modality: 'SC' };
    case 'voiLutModule':
      return { windowWidth: [256], windowCenter: [128] };
    case 'modalityLutModule':
      return { rescaleSlope: 1, rescaleIntercept: 0 };
    default:
      return undefined;
  }
}

beforeAll(async () => {
  await csInit();
  imageLoader.registerImageLoader('smoke', ((imageId: string) => ({
    promise: Promise.resolve(fakeImage(imageId)),
  })) as unknown as Types.ImageLoaderFn);
  imageLoader.registerImageLoader('fail', (() => ({
    promise: Promise.reject(new Error('smoke: image load failure')),
  })) as unknown as Types.ImageLoaderFn);
  metaData.addProvider(fakeMetaDataProvider);
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
  cleanup(); // unmount hooks before the Engine they watch goes away
  engine?.destroy();
  for (const element of elements.splice(0)) element.remove();
});

// Resolves after the next frame's rAF callbacks *and* the microtasks and
// React work queued behind them — the moment a consumer would observe.
const afterNextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));

test('viewports dirtied in one frame notify in one pass: a component reading all of them renders once', async () => {
  // A camera-synced MPR set: one scroll moves every viewport's camera in the
  // same task. CS3D fires CAMERA_MODIFIED synchronously inside setCamera, so
  // three Bindings go dirty in one frame. The frame is the unit of
  // consistency (ADR 0006): all three rebuilds land in one synchronous pass
  // and React renders the component once — never with a mix of frames.
  const ids = ['mpr-a', 'mpr-b', 'mpr-c'];
  engine = new RenderingEngine('smoke-engine');
  for (const viewportId of ids) {
    engine.enableElement({ viewportId, type: Enums.ViewportType.STACK, element: makeElement() });
  }
  const viewports = ids.map((id) => engine.getViewport(id) as Types.IStackViewport);
  await Promise.all(viewports.map((vp) => vp.setStack(imageIds, 0)));
  engine.render();

  let renders = 0;
  const { result } = renderHook(() => {
    renders++;
    return ids.map((id) => useViewportState(id, (s) => s.camera.parallelScale));
  });
  await waitFor(() => expect(result.current.every((scale) => scale !== undefined)).toBe(true));
  await afterNextFrame(); // let subscribe-time updates settle
  const rendersBefore = renders;

  const scales = result.current as number[];
  viewports.forEach((vp, i) => vp.setCamera({ parallelScale: scales[i] * 2 }));
  await afterNextFrame();

  expect(result.current.map((s, i) => s! / scales[i])).toEqual([2, 2, 2]);
  expect(renders - rendersBefore).toBe(1);
});

test('Stack viewport: real Engine state changes reach the hook', async () => {
  engine = new RenderingEngine('smoke-engine');
  engine.enableElement({
    viewportId: 'stack-vp',
    type: Enums.ViewportType.STACK,
    element: makeElement(),
  });
  const viewport = engine.getViewport('stack-vp') as Types.IStackViewport;
  await viewport.setStack(imageIds, 0);
  viewport.render();

  const { result } = renderHook(() => useViewportState('stack-vp'));
  await waitFor(() => expect(result.current?.kind).toBe('stack'));
  expect((result.current as StackViewportState).sliceIndex).toBe(0);
  expect((result.current as StackViewportState).numberOfSlices).toBe(imageIds.length);
  // What it points at, straight from the Engine's own getters.
  expect((result.current as StackViewportState).imageIds).toEqual(viewport.getImageIds());
  expect(result.current?.currentImageId).toBe(viewport.getCurrentImageId());
  expect(result.current?.currentImageId).toBe('smoke:0');

  viewport.setProperties({ voiRange: { lower: 10, upper: 20 } });
  await waitFor(() => expect(result.current?.voiRange).toEqual({ lower: 10, upper: 20 }));

  const idsBefore = (result.current as StackViewportState).imageIds;
  await viewport.setImageIdIndex(2);
  await waitFor(() =>
    expect((result.current as StackViewportState).sliceIndex).toBe(2),
  );
  expect(result.current?.currentImageId).toBe('smoke:2');
  expect((result.current as StackViewportState).imageIds).toBe(idsBefore); // a scroll keeps the list

  // A new stack: PRE_STACK_NEW_IMAGE alone must carry the new list.
  await viewport.setStack(imageIds.slice(0, 2), 1);
  await waitFor(() =>
    expect((result.current as StackViewportState).imageIds).toEqual(['smoke:0', 'smoke:1']),
  );
  expect(result.current?.currentImageId).toBe('smoke:1');

  const before = result.current!.camera.parallelScale!;
  viewport.setCamera({ parallelScale: before * 2 });
  await waitFor(() =>
    expect(result.current?.camera.parallelScale).toBeCloseTo(before * 2),
  );
});

test('Stack viewport: sliceIndex is the requested slice even when the image never loads', async () => {
  engine = new RenderingEngine('smoke-engine');
  engine.enableElement({
    viewportId: 'stack-fail-vp',
    type: Enums.ViewportType.STACK,
    element: makeElement(),
  });
  const viewport = engine.getViewport('stack-fail-vp') as Types.IStackViewport;
  await viewport.setStack([...imageIds, 'fail:3'], 0);
  viewport.render();

  const { result } = renderHook(() => useViewportState('stack-fail-vp'));
  await waitFor(() => expect(result.current?.kind).toBe('stack'));

  // CS3D swallows the failure: no STACK_NEW_IMAGE, IMAGE_LOAD_ERROR goes to
  // eventTarget, and the promise resolves (GPU path) or rejects (CPU path).
  // PRE_STACK_NEW_IMAGE, fired after the index is assigned, is the only
  // element event carrying the new index — this fails without it, and fails
  // if CS3D ever fires it before the assignment (ADR 0003).
  // CS3D's cache chains a second .then onto the loader promise with no catch,
  // so the rejection also surfaces as unhandled — swallow it for this test.
  const swallow = (evt: PromiseRejectionEvent) => evt.preventDefault();
  window.addEventListener('unhandledrejection', swallow);
  try {
    await viewport.setImageIdIndex(3).catch(() => undefined);
    await waitFor(() =>
      expect((result.current as StackViewportState).sliceIndex).toBe(3),
    );
  } finally {
    window.removeEventListener('unhandledrejection', swallow);
  }
});

test('Volume viewport: real Engine state changes reach the hook', async () => {
  const volumeId = 'smokeVolume';
  volumeLoader.createLocalVolume(volumeId, {
    metadata: {
      BitsAllocated: 8,
      BitsStored: 8,
      HighBit: 7,
      SamplesPerPixel: 1,
      PhotometricInterpretation: 'MONOCHROME2',
      PixelRepresentation: 0,
      Modality: 'CT',
      ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
      PixelSpacing: [1, 1],
      FrameOfReferenceUID: 'smoke-FOR',
      Columns: COLS,
      Rows: ROWS,
      voiLut: [],
      VOILUTFunction: 'LINEAR',
    },
    dimensions: [COLS, ROWS, 4],
    spacing: [1, 1, 1],
    origin: [0, 0, 0],
    direction: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    scalarData: new Uint8Array(COLS * ROWS * 4),
  });

  engine = new RenderingEngine('smoke-engine');
  engine.enableElement({
    viewportId: 'volume-vp',
    type: Enums.ViewportType.ORTHOGRAPHIC,
    element: makeElement(),
  });
  const viewport = engine.getViewport('volume-vp') as Types.IVolumeViewport;

  // Subscribe before setVolumes: no Slice Position yet, and it must arrive on
  // VOLUME_VIEWPORT_NEW_VOLUME alone — no render/resetCamera in between.
  const { result } = renderHook(() => useViewportState('volume-vp'));
  await waitFor(() => expect(result.current?.kind).toBe('volume'));
  expect(result.current?.numberOfSlices).toBeUndefined();

  await viewport.setVolumes([{ volumeId }]);
  await waitFor(() => expect(result.current?.numberOfSlices).toBe(4));
  viewport.render();
  // A local volume has no imageIds to point at; the contract is undefined, not null.
  expect(result.current?.currentImageId).toBe(viewport.getCurrentImageId() ?? undefined);

  // Slice index derives from the camera: the focal point's projection onto
  // viewPlaneNormal. Step one slice (spacing 1) along the normal, away from the end.
  const { focalPoint, position, viewPlaneNormal } = viewport.getCamera();
  const startIndex = result.current!.sliceIndex!;
  const step = startIndex < 3 ? 1 : -1;
  const shift = (p: Types.Point3): Types.Point3 => [
    p[0] + step * viewPlaneNormal![0],
    p[1] + step * viewPlaneNormal![1],
    p[2] + step * viewPlaneNormal![2],
  ];
  viewport.setCamera({ focalPoint: shift(focalPoint!), position: shift(position!) });
  await waitFor(() => expect(result.current?.sliceIndex).toBe(startIndex + step));

  viewport.setProperties({ voiRange: { lower: 5, upper: 50 } });
  await waitFor(() => expect(result.current?.voiRange).toEqual({ lower: 5, upper: 50 }));

  const before = result.current!.camera.parallelScale!;
  viewport.setCamera({ parallelScale: before * 2 });
  await waitFor(() =>
    expect(result.current?.camera.parallelScale).toBeCloseTo(before * 2),
  );
});

test('enable/disable lifecycle: undefined before enable and after disable', async () => {
  engine = new RenderingEngine('smoke-engine');
  const { result } = renderHook(() => useViewportState('lifecycle-vp'));
  expect(result.current).toBeUndefined();

  engine.enableElement({
    viewportId: 'lifecycle-vp',
    type: Enums.ViewportType.STACK,
    element: makeElement(),
  });
  const viewport = engine.getViewport('lifecycle-vp') as Types.IStackViewport;
  await viewport.setStack(imageIds, 0);
  viewport.render();
  await waitFor(() => expect(result.current?.kind).toBe('stack'));

  // destroy(), not disableElement(): the spec's contract is enable/destroy,
  // and destroy must fire ELEMENT_DISABLED per viewport for the hook to see.
  engine.destroy();
  await waitFor(() => expect(result.current).toBeUndefined());
});
