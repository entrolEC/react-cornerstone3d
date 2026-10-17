// The same slider on the library. One Snapshot per viewport, rebuilt only on
// Engine events and shared by every consumer — so there is no copy to keep in
// step, no event to pick, and nothing to clean up.

import { getEnabledElementByViewportId, type Types } from '@cornerstonejs/core';
import { useViewportState } from 'react-cornerstone3d';

// #region code
export function SliderBySnapshot({ viewportId }: { viewportId: string }) {
  // #region wiring
  const slice = useViewportState(viewportId, (s) => s.sliceIndex);
  const total = useViewportState(viewportId, (s) => s.numberOfSlices);
  // #endregion wiring

  if (slice === undefined || !total) return <SliderLine value={0} />;

  // Everything below is the same in both versions.
  return (
    <SliderLine value={slice} max={total - 1}>
      <input
        className="slider"
        type="range"
        min={0}
        max={total - 1}
        value={slice}
        onChange={(event) => {
          const viewport = getEnabledElementByViewportId(viewportId)?.viewport as
            | Types.IStackViewport
            | undefined;
          void viewport?.setImageIdIndex(Number(event.target.value));
        }}
      />
    </SliderLine>
  );
}
// #endregion code

import { SliderLine } from './SliderLine';

import source from './slider-by-snapshot.tsx?raw';
import { region } from './ui';

export const HOOK_SOURCE = region(source, 'code');
export const HOOK_WIRING = region(source, 'wiring');
