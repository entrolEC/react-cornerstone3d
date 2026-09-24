// Panel 1's hand-rolled slider, with one line on a switch.
//
// `update()` is the seed: the call that reads the Engine once, right after the
// listeners go on, to cover the stretch between the first render and the
// subscription. Nothing fails without it — until nothing happens, which is
// most of the time a viewer is open.
//
// Everything else here is character-for-character panel 1's wiring. The page
// prints slider-by-hand.tsx beside this, not this file: what runs has to be
// the code the reader was just shown, minus the one line under discussion.

import { Enums, getEnabledElementByViewportId, type Types } from '@cornerstonejs/core';
import { useEffect, useState } from 'react';
import { SliderLine } from './SliderLine';

export function SliderWithSeed({
  viewportId,
  seed,
}: {
  viewportId: string;
  /** False removes the `update()` line. Remount to change it. */
  seed: boolean;
}) {
  const [state, setState] = useState<{ slice: number; total: number }>();

  useEffect(() => {
    const enabled = getEnabledElementByViewportId(viewportId);
    if (!enabled) return;
    const viewport = enabled.viewport as Types.IStackViewport;
    const { element } = viewport;

    const update = () =>
      setState({
        slice: viewport.getSliceIndex(),
        total: viewport.getNumberOfSlices(),
      });
    if (seed) update();

    element.addEventListener(Enums.Events.CAMERA_MODIFIED, update);
    element.addEventListener(Enums.Events.VOI_MODIFIED, update);
    element.addEventListener(Enums.Events.STACK_NEW_IMAGE, update);
    return () => {
      element.removeEventListener(Enums.Events.CAMERA_MODIFIED, update);
      element.removeEventListener(Enums.Events.VOI_MODIFIED, update);
      element.removeEventListener(Enums.Events.STACK_NEW_IMAGE, update);
    };
  }, [viewportId, seed]);

  if (!state) return <SliderLine value={0} />;
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
