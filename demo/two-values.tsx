import { Enums, getEnabledElementByViewportId, type Types } from '@cornerstonejs/core';
import { useCallback, useSyncExternalStore } from 'react';
import { recordSnapshot } from './snapshot-log';

// The same binding, with one change: the screen needs the total as well as
// the index, so getSnapshot hands both back together.
export function SliceAndTotal({ viewportId }: { viewportId: string }) {
  // Memoised, or useSyncExternalStore re-subscribes on every render.
  const subscribe = useCallback(
    (onChange: () => void) => {
      const element = getEnabledElementByViewportId(viewportId)?.viewport.element;
      element?.addEventListener(Enums.Events.STACK_NEW_IMAGE, onChange);
      return () => element?.removeEventListener(Enums.Events.STACK_NEW_IMAGE, onChange);
    },
    [viewportId],
  );

  // #region snapshot
  const state = useSyncExternalStore(subscribe, () => {
    const viewport = getEnabledElementByViewportId(viewportId)
      ?.viewport as Types.IStackViewport | undefined;
    if (!viewport) return undefined;
    return { slice: viewport.getSliceIndex(), total: viewport.getNumberOfSlices() };
  });
  // #endregion snapshot

  // Demo instrumentation, deliberately outside the excerpt above: keeps what
  // React was handed on each render so panel 3 can show the real sequence.
  recordSnapshot(state);

  if (!state) return <span className="ind ind--empty">—</span>;
  return (
    <span className="ind">
      {state.slice + 1} / {state.total}
    </span>
  );
}
