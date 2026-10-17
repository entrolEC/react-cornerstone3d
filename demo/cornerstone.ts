import { RenderingEngine, init as coreInit } from '@cornerstonejs/core';
import { init as dicomImageLoaderInit, wadors } from '@cornerstonejs/dicom-image-loader';
import { installSlowLoader } from './slow-network';

// The CT chest series the Cornerstone3D examples themselves use.
const ROOT = 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb';
const STUDY = '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463';
const SERIES = '1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561';

/** The app owns the Engine — the library only resolves it (ADR 0002). */
export const renderingEngineId = 'demo-engine';

/**
 * Marks the copies of the series that panels 2 and 3 load, so the deliberate
 * delay applies to those viewports only. A URL fragment never reaches the
 * server, and gives the Engine cache its own key.
 */
export const SLOW = '#slow';

/** The same images, marked for the deliberate load delay. */
export const slowImageIds = (imageIds: string[]) => imageIds.map((id) => id + SLOW);

type Instance = Record<string, { Value?: unknown[] }>;

const value = (instance: Instance, tag: string) => instance[tag]?.Value?.[0];

// One QIDO-shaped metadata GET is all a single-series demo needs; the
// dicomweb-client the CS3D examples pull in buys nothing here.
async function loadImageIds(): Promise<string[]> {
  const url = `${ROOT}/studies/${STUDY}/series/${SERIES}/metadata`;
  const response = await fetch(url, { headers: { Accept: 'application/dicom+json' } });
  if (!response.ok) throw new Error(`DICOMweb ${response.status} — ${url}`);
  const instances: Instance[] = await response.json();

  return instances
    .slice()
    .sort((a, b) => Number(value(a, '00200013') ?? 0) - Number(value(b, '00200013') ?? 0))
    .map((instance) => {
      const sop = value(instance, '00080018') as string;
      const imageId = `wadors:${ROOT}/studies/${STUDY}/series/${SERIES}/instances/${sop}/frames/1`;
      wadors.metaDataManager.add(imageId, instance as never);
      // The marked copy is a separate imageId, so it needs its own metadata.
      wadors.metaDataManager.add(imageId + SLOW, instance as never);
      return imageId;
    });
}

let pending: Promise<string[]> | undefined;

/** Idempotent: StrictMode mounts this twice and must get one Engine. */
export function setup(): Promise<string[]> {
  pending ??= (async () => {
    // Deliberately unconfigured. init({ rendering: { useGenericViewport: true } })
    // remaps Stack and Orthographic alike onto PlanarViewport, where the legacy
    // write setProperties({ voiRange }) ends in setDataPresentationState: it
    // renders and fires no element event (ADR 0008, upstream cornerstone3D
    // #2977, still open in 5.11.7). The window/level drag in CtViewport takes
    // exactly that path, so with the flag on the overlay numbers would stop
    // moving under your finger — and this page spends six panels arguing that
    // a write reaches React by coming back as an event. It would read as the
    // library being broken. Turn the flag on and that drag needs
    // setDisplaySetPresentation({ voiRange }) instead.
    coreInit();
    dicomImageLoaderInit({ maxWebWorkers: 1 });
    installSlowLoader(); // must follow the loader init: it wraps what that registers
    new RenderingEngine(renderingEngineId);
    return loadImageIds();
  })();
  return pending;
}

