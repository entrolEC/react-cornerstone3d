import { registerImageLoader, type Types } from '@cornerstonejs/core';
import { wadors } from '@cornerstonejs/dicom-image-loader';
import { SLOW } from './cornerstone';

/**
 * Panels 2 and 3 are about a control bound to load completion. On a fast
 * connection the load finishes so quickly there is nothing to see — which is
 * the point of those panels, and useless as a demonstration. So their viewport
 * holds every slice back by a fixed amount, and the page says so on the page.
 *
 * Only the *arrival* is delayed. The Engine still assigns the index
 * synchronously, still fires PRE_STACK_NEW_IMAGE at once, and still fires
 * STACK_NEW_IMAGE only on success — the mechanism is untouched.
 *
 * Scoped by imageId: only ids carrying the SLOW fragment are delayed, so the
 * other panels run at the visitor's real network speed.
 */
export const SLICE_DELAY_MS = 450;

const after = <T,>(ms: number, value: T) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

/** Re-registers the `wadors` scheme with a wrapper. Call after the loader init. */
export function installSlowLoader() {
  registerImageLoader('wadors', (imageId: string, options?: Record<string, unknown>) => {
    const load = wadors.loadImage(imageId, options as Parameters<typeof wadors.loadImage>[1]);
    if (!imageId.endsWith(SLOW)) return load;

    return {
      ...load,
      promise: load.promise.then((image: Types.IImage) => after(SLICE_DELAY_MS, image)),
    };
  });
}
