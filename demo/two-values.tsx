import { Enums, getEnabledElementByViewportId, type Types } from '@cornerstonejs/core';
import { useCallback, useSyncExternalStore } from 'react';

// The same binding, with one change: the screen needs the total as well as
// the index, so getSnapshot hands both back together.
export function SliceAndTotal({
  viewportId,
  onSnapshot,
}: {
  viewportId: string;
  /** Every object React is handed, in order. Demo instrumentation. */
  onSnapshot?: (value: { slice: number; total: number } | undefined) => void;
}) {
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

  // Demo instrumentation, deliberately outside the excerpt above: the panel
  // keeps what React was handed on each render, so the next step can print the
  // real sequence rather than a staged one.
  onSnapshot?.(state);

  if (!state) return <span className="ind ind--empty">—</span>;
  return (
    <span className="ind">
      {state.slice + 1} / {state.total}
    </span>
  );
}
