import type { Types } from '@cornerstonejs/core';

// Fixtures for the browser smoke tests: a three-image fake stack the real
// Engine can load and display. `smoke:*` resolves to a blank 64×64 image;
// `fail:*` rejects. Shared by the legacy and the Generic Viewport suites, so
// both drive the exact same stack through their respective viewport classes.

export const ROWS = 64;
export const COLS = 64;
export const smokeImageIds = ['smoke:0', 'smoke:1', 'smoke:2'];

export function fakeImage(imageId: string): Types.IImage {
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

export function fakeMetaDataProvider(type: string, imageId: string) {
  const sliceIndex = smokeImageIds.indexOf(imageId);
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

/** The loaders every smoke suite registers after `init`. */
export const smokeImageLoader = ((imageId: string) => ({
  promise: Promise.resolve(fakeImage(imageId)),
})) as unknown as Types.ImageLoaderFn;

export const failingImageLoader = (() => ({
  promise: Promise.reject(new Error('smoke: image load failure')),
})) as unknown as Types.ImageLoaderFn;
