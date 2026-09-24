import { Enums, getEnabledElementByViewportId, type Types } from '@cornerstonejs/core';
import { useCallback, useSyncExternalStore } from 'react';

// React 18's own answer for state that lives outside React: subscribe to the
// source, and hand back its current value on demand. No copy, no useEffect.
export function SliceNumberOnly({ viewportId }: { viewportId: string }) {
  // Memoised, or useSyncExternalStore re-subscribes on every render.
  const subscribe = useCallback(
    (onChange: () => void) => {
      const element = getEnabledElementByViewportId(viewportId)?.viewport.element;
      element?.addEventListener(Enums.Events.STACK_NEW_IMAGE, onChange);
      return () => element?.removeEventListener(Enums.Events.STACK_NEW_IMAGE, onChange);
    },
    [viewportId],
  );

  const slice = useSyncExternalStore(subscribe, () =>
    (getEnabledElementByViewportId(viewportId)?.viewport as Types.IStackViewport | undefined)
      ?.getSliceIndex(),
  );

  if (slice === undefined) return <span className="ind ind--empty">—</span>;
  return <span className="ind">{slice + 1}</span>;
}
