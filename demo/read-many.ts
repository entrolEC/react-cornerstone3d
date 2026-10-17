import { getEnabledElementByViewportId, type Types } from '@cornerstonejs/core';

/**
 * Calls the naive `getSnapshot` several times in a row, with nothing happening
 * in between, and keeps every result. Printing the values alone reads as "they
 * are the same" — which is true, and exactly the trap. The page labels the
 * results by identity instead, so five identical values with five different
 * labels make the point without anyone having to know what `Object.is` is.
 */
export function readMany(viewportId: string, times: number) {
  const viewport = getEnabledElementByViewportId(viewportId)
    ?.viewport as Types.IStackViewport | undefined;
  if (!viewport) return undefined;

  const read = () => ({ slice: viewport.getSliceIndex(), total: viewport.getNumberOfSlices() });
  return {
    reads: Array.from({ length: times }, read),
    // Not something we caused by composing an object: the Engine's own getters
    // behave the same way.
    engineSame: Object.is(viewport.getCamera(), viewport.getCamera()),
  };
}

/**
 * Same object, same number — the only thing these logs are really showing.
 * Numbered rather than lettered because a real run goes well past Z, and the
 * point is exactly how far it goes.
 */
export function idByIdentity(values: readonly object[]): number[] {
  const seen = new Map<object, number>();
  return values.map((value) => {
    const known = seen.get(value);
    if (known !== undefined) return known;
    const id = seen.size + 1;
    seen.set(value, id);
    return id;
  });
}
