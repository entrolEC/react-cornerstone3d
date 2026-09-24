// The same two surfaces, on the library. One Snapshot per viewport, rebuilt
// only on Engine events, shared by every consumer — so there is no second
// event to pick and nothing to keep in step.

import { getEnabledElementByViewportId, type Types } from '@cornerstonejs/core';
import { useViewportState } from 'react-cornerstone3d';
import { SliderLine } from './SliderLine';

export function SliderBySnapshot({ viewportId }: { viewportId: string }) {
  const state = useViewportState(viewportId);
  if (state?.sliceIndex === undefined || !state.numberOfSlices) {
    return <span className="ind ind--empty">—</span>;
  }

  return (
    <SliderLine value={state.sliceIndex} max={state.numberOfSlices - 1}>
      <input
        className="slider"
        type="range"
        min={0}
        max={state.numberOfSlices - 1}
        value={state.sliceIndex}
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
