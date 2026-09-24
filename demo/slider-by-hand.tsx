// The slice slider the way a Cornerstone3D + React app writes it today: copy
// the Engine's numbers into React state, and keep the copy in step by hand.
// It works. Panel 1 only counts it; panel 2 is where the copy starts to hurt.

import { Enums, getEnabledElementByViewportId, type Types } from '@cornerstonejs/core';
import { useEffect, useState } from 'react';

// #region code
export function SliderByHand({ viewportId }: { viewportId: string }) {
  // #region wiring
  const [state, setState] = useState<{ slice: number; total: number }>();

  useEffect(() => {
    const enabled = getEnabledElementByViewportId(viewportId);
    if (!enabled) return; // no viewport yet? then never, even once it exists
    const viewport = enabled.viewport as Types.IStackViewport;
    const { element } = viewport;

    const update = () =>
      setState({
        slice: viewport.getSliceIndex(),
        total: viewport.getNumberOfSlices(),
      });
    update(); // patch the gap between first render and subscription

    element.addEventListener(Enums.Events.CAMERA_MODIFIED, update);
    element.addEventListener(Enums.Events.VOI_MODIFIED, update);
    element.addEventListener(Enums.Events.STACK_NEW_IMAGE, update);
    return () => {
      element.removeEventListener(Enums.Events.CAMERA_MODIFIED, update);
      element.removeEventListener(Enums.Events.VOI_MODIFIED, update);
      element.removeEventListener(Enums.Events.STACK_NEW_IMAGE, update);
    };
  }, [viewportId]);
  // #endregion wiring

  if (!state) return <SliderLine value={0} />;

  // Everything below is the same in both versions.
  return (
    <SliderLine value={state.slice} max={state.total - 1}>
      <input
        className="slider"
        type="range"
        min={0}
        max={state.total - 1}
        value={state.slice}
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

// The panel prints this file, so the numbers on the tab can never claim a
// count the code no longer has. Outside the regions, so it never shows.
import source from './slider-by-hand.tsx?raw';
import { region } from './ui';

export const BY_HAND_SOURCE = region(source, 'code');
export const BY_HAND_WIRING = region(source, 'wiring');
