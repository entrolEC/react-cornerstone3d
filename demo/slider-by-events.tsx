// The binding panel 2 earned, on the two surfaces a real viewer needs: a
// readout and a slider. Two hooks, two primitives, so `Object.is` settles.
// Both surfaces share one subscription — and that is where the trouble is.

import { Enums, getEnabledElementByViewportId, type Types } from '@cornerstonejs/core';
import { useCallback, useSyncExternalStore } from 'react';

const stackOf = (viewportId: string) =>
  getEnabledElementByViewportId(viewportId)?.viewport as Types.IStackViewport | undefined;

function useSliceByEvents(viewportId: string) {
  // STACK_NEW_IMAGE: the event whose name matches "the slice changed". It is
  // also the one the Engine fires only after the image has finished loading.
  // #region subscribe
  const subscribe = useCallback(
    (onChange: () => void) => {
      const element = stackOf(viewportId)?.element;
      element?.addEventListener(Enums.Events.STACK_NEW_IMAGE, onChange);
      return () => element?.removeEventListener(Enums.Events.STACK_NEW_IMAGE, onChange);
    },
    [viewportId],
  );
  // #endregion subscribe

  return {
    slice: useSyncExternalStore(subscribe, () => stackOf(viewportId)?.getSliceIndex()),
    total: useSyncExternalStore(subscribe, () => stackOf(viewportId)?.getNumberOfSlices()),
  };
}

// #region slider
export function SliderByEvents({ viewportId }: { viewportId: string }) {
  const { slice, total } = useSliceByEvents(viewportId);
  if (slice === undefined || !total) return <span className="ind ind--empty">—</span>;

  return (
    <SliderLine value={slice} max={total - 1}>
      <input
        className="slider"
        type="range"
        min={0}
        max={total - 1}
        value={slice}
        onChange={(event) => void stackOf(viewportId)?.setImageIdIndex(Number(event.target.value))}
      />
    </SliderLine>
  );
}
// #endregion slider

import { SliderLine } from './SliderLine';

import source from './slider-by-events.tsx?raw';
import { region } from './ui';

export const EVENTS_SUBSCRIBE = region(source, 'subscribe').trim();
