import type { Types } from '@cornerstonejs/core';
import {
  Enums,
  RenderingEngine,
  getConfiguration,
  imageLoader,
  init as csInit,
  metaData,
  volumeLoader,
} from '@cornerstonejs/core';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, test } from 'vitest';
import { useViewportState, type StackViewportState } from './index';
import {
  COLS,
  ROWS,
  fakeMetaDataProvider,
  smokeImageIds as imageIds,
  smokeImageLoader,
} from './testing/smokeStack';

// The same Stack smoke case as useViewportState.browser.test.ts, run with
// CS3D 5.x's Generic Viewport enabled. `init` applies its config once per
// module instance and ignores later calls, so the flag needs its own file.
//
// With `useGenericViewport`, BaseRenderingEngine remaps STACK (and
// ORTHOGRAPHIC) to ViewportType.PLANAR_NEXT and instantiates
// GenericViewport/Planar/PlanarViewport. It still serves the legacy stack
// getters (getImageIds, getSliceIndex, getNumberOfSlices, getCurrentImageId,
// getProperties) through a compatibility controller, but its element events
// differ from StackViewport's: a slice change goes through setViewState and
// fires CAMERA_MODIFIED synchronously (no PRE_STACK_NEW_IMAGE at all);
// STACK_NEW_IMAGE fires from the render path; VOI_MODIFIED from
// notifyDataPresentationModified. Every assertion below therefore also checks
// that an event we subscribe to carries the change (ADR 0007).

beforeAll(async () => {
  await csInit({ rendering: { useGenericViewport: true } } as Types.Cornerstone3DConfig);
  expect(getConfiguration().rendering?.useGenericViewport).toBe(true);
  imageLoader.registerImageLoader('smoke', smokeImageLoader);
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
  cleanup();
  engine?.destroy();
  for (const element of elements.splice(0)) element.remove();
});

test('Generic Viewport (PLANAR_NEXT): a Stack reads as kind "stack" with Slice Position and imageIds', async () => {
  engine = new RenderingEngine('smoke-engine');
  engine.enableElement({
    viewportId: 'planar-stack-vp',
    type: Enums.ViewportType.STACK,
    element: makeElement(),
  });
  const viewport = engine.getViewport('planar-stack-vp') as Types.IStackViewport;
  // The remap is the premise of this file: if CS3D stops remapping, the
  // legacy suite already covers what is left.
  expect(viewport.type).toBe(Enums.ViewportType.PLANAR_NEXT);
  await viewport.setStack(imageIds, 0);
  viewport.render();

  const { result } = renderHook(() => useViewportState('planar-stack-vp'));
  await waitFor(() => expect(result.current).toBeDefined());
  expect(result.current?.kind).toBe('stack');
  expect((result.current as StackViewportState).sliceIndex).toBe(0);
  expect((result.current as StackViewportState).numberOfSlices).toBe(imageIds.length);
  expect((result.current as StackViewportState).imageIds).toEqual(viewport.getImageIds());
  expect(result.current?.currentImageId).toBe(viewport.getCurrentImageId());
  expect(result.current?.currentImageId).toBe('smoke:0');

  // VOI has a getter and an event on PlanarViewport, but only the new-model
  // write fires the event: the legacy setProperties path ends in
  // setDataPresentationState, which renders and fires nothing, so the getter
  // moves and no element event says so (CS3D 5.10.7). ADR 0007 rule 1 is
  // about the Engine's pair, not our subscription: the hook cannot hear a
  // silent write. Pin the fact so a CS3D fix shows up here
  // (upstream: cornerstonejs/cornerstone3D#2977).
  let voiEvents = 0;
  const countVoi = () => voiEvents++;
  viewport.element.addEventListener(Enums.Events.VOI_MODIFIED, countVoi);
  viewport.setProperties({ voiRange: { lower: 10, upper: 20 } });
  expect(viewport.getProperties().voiRange).toEqual({ lower: 10, upper: 20 });
  expect(voiEvents).toBe(0);
  viewport.element.removeEventListener(Enums.Events.VOI_MODIFIED, countVoi);

  // The new-model write fires VOI_MODIFIED; the hook follows it.
  (viewport as unknown as Types.IGenericViewport).setDisplaySetPresentation({
    voiRange: { lower: 30, upper: 40 },
  });
  await waitFor(() => expect(result.current?.voiRange).toEqual({ lower: 30, upper: 40 }));

  // A slice change on PlanarViewport arrives as CAMERA_MODIFIED.
  const idsBefore = (result.current as StackViewportState).imageIds;
  await viewport.setImageIdIndex(2);
  await waitFor(() =>
    expect((result.current as StackViewportState).sliceIndex).toBe(2),
  );
  expect(result.current?.currentImageId).toBe('smoke:2');
  expect((result.current as StackViewportState).imageIds).toBe(idsBefore); // a scroll keeps the list

  // A new stack: setDisplaySets + setImageIdIndex must carry the new list.
  await viewport.setStack(imageIds.slice(0, 2), 1);
  await waitFor(() =>
    expect((result.current as StackViewportState).imageIds).toEqual(['smoke:0', 'smoke:1']),
  );
  expect((result.current as StackViewportState).numberOfSlices).toBe(2);
  expect(result.current?.currentImageId).toBe('smoke:1');

  const before = result.current!.camera.parallelScale!;
  viewport.setCamera({ parallelScale: before * 2 });
  await waitFor(() =>
    expect(result.current?.camera.parallelScale).toBeCloseTo(before * 2),
  );
});

test('Generic Viewport (PLANAR_NEXT): a Volume reads as kind "volume", Slice Position from the camera', async () => {
  // The same class as above, told to show a volume: `kind` must follow what
  // the Engine holds (getCurrentMode), not the class or the type tag.
  const volumeId = 'smokeVolumeGeneric';
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
    viewportId: 'planar-volume-vp',
    type: Enums.ViewportType.ORTHOGRAPHIC,
    element: makeElement(),
  });
  // PlanarViewport serves the stack scroll API in volume mode too.
  const viewport = engine.getViewport('planar-volume-vp') as Types.IVolumeViewport &
    Pick<Types.IStackViewport, 'setImageIdIndex'>;
  expect(viewport.type).toBe(Enums.ViewportType.PLANAR_NEXT);

  const { result } = renderHook(() => useViewportState('planar-volume-vp'));
  await waitFor(() => expect(result.current).toBeDefined());
  // Nothing mounted yet: the Engine's mode is 'empty' and its stack getters
  // answer (an empty list), so this reads as an empty Stack, like a legacy
  // Stack before setStack. The kind flips once the volume arrives.
  expect(result.current?.kind).toBe('stack');

  await viewport.setVolumes([{ volumeId }]);
  await waitFor(() => expect(result.current?.kind).toBe('volume'));
  expect(result.current?.numberOfSlices).toBe(4);
  expect(result.current?.sliceIndex).toBe(viewport.getSliceIndex());
  viewport.render();

  // A slice change on a Planar volume still goes through setViewState and
  // CAMERA_MODIFIED; the index derives from the camera as on a legacy Volume.
  const startIndex = result.current!.sliceIndex!;
  const step = startIndex < 3 ? 1 : -1;
  await viewport.setImageIdIndex(startIndex + step);
  await waitFor(() => expect(result.current?.sliceIndex).toBe(startIndex + step));
  expect(result.current?.kind).toBe('volume');
});

test('Generic Viewport: classes without the legacy getters read as kind "volume" instead of throwing', () => {
  // Under useGenericViewport, VOLUME_3D / VIDEO / ECG / WHOLE_SLIDE become
  // legacy adapters that lack some of getCamera, getProperties,
  // getSliceIndex and getCurrentImageId; PLANAR_NEXT requested directly is
  // the bare PlanarViewport (no getCamera, no getProperties). All answer
  // getCurrentMode() 'empty' before data, and none takes a stack.
  const T = Enums.ViewportType;
  for (const type of [T.VOLUME_3D, T.VIDEO, T.ECG, T.WHOLE_SLIDE, T.PLANAR_NEXT]) {
    const local = new RenderingEngine(`bare-engine-${type}`);
    const viewportId = `bare-${type}`;
    local.enableElement({ viewportId, type, element: makeElement() });
    const { result, unmount } = renderHook(() => useViewportState(viewportId));
    expect(result.current?.kind, type).toBe('volume');
    expect(result.current?.camera, type).toBeTypeOf('object');
    unmount();
    // CS3D's own destroy throws for some of these classes before data.
    try {
      local.destroy();
    } catch {
      // not ours to test
    }
  }
});
