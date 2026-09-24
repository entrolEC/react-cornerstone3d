// The two versions of the same widget. Both render live on the page, and both
// are shown in the code panels beside them, extracted from this very file.

// #region hook
import { useViewportState } from 'react-cornerstone3d';

export function SliceIndicator({ viewportId }: { viewportId: string }) {
  const slice = useViewportState(viewportId, (s) => s.sliceIndex);
  const total = useViewportState(viewportId, (s) => s.numberOfSlices);

  if (slice === undefined) return <span className="ind ind--empty">—</span>;
  return (
    <span className="ind">
      {slice + 1} / {total}
    </span>
  );
}
// #endregion hook

// #region imperative
import { Enums, getEnabledElementByViewportId, type Types } from '@cornerstonejs/core';
import { useEffect, useState } from 'react';

export function SliceIndicatorByHand({ viewportId }: { viewportId: string }) {
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
    update(); // patch the gap between first render and subscription — easy to forget

    element.addEventListener(Enums.Events.CAMERA_MODIFIED, update);
    element.addEventListener(Enums.Events.VOI_MODIFIED, update);
    element.addEventListener(Enums.Events.STACK_NEW_IMAGE, update);
    return () => {
      element.removeEventListener(Enums.Events.CAMERA_MODIFIED, update);
      element.removeEventListener(Enums.Events.VOI_MODIFIED, update);
      element.removeEventListener(Enums.Events.STACK_NEW_IMAGE, update);
    };
  }, [viewportId]);

  if (!state) return <span className="ind ind--empty">—</span>;
  return (
    <span className="ind">
      {state.slice + 1} / {state.total}
    </span>
  );
}
// #endregion imperative

// Line counts come from this file itself, so a badge can never claim a number
// the code no longer has. Outside the regions, so it never shows in a panel.
import source from './widgets.tsx?raw';
import { region } from './ui';

export const HOOK_SOURCE = region(source, 'hook').trim();
export const BY_HAND_SOURCE = region(source, 'imperative').trim();
export const lineCount = (code: string) => code.split('\n').length;
