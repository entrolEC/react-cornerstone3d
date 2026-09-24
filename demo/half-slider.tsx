import { Enums, getEnabledElementByViewportId, type Types } from '@cornerstonejs/core';
import { useCallback, useSyncExternalStore } from 'react';
import { SliderLine } from './SliderLine';

const stackOf = (viewportId: string) =>
  getEnabledElementByViewportId(viewportId)?.viewport as Types.IStackViewport | undefined;

/**
 * The slider panel 2 is building, at the stage where only one value has been
 * read. `max` is left at the browser's default 100, so the handle is in the
 * wrong place on purpose — that missing second value is the whole step.
 */
export function HalfSlider({ viewportId }: { viewportId: string }) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const element = stackOf(viewportId)?.element;
      element?.addEventListener(Enums.Events.STACK_NEW_IMAGE, onChange);
      return () => element?.removeEventListener(Enums.Events.STACK_NEW_IMAGE, onChange);
    },
    [viewportId],
  );

  const slice = useSyncExternalStore(subscribe, () => stackOf(viewportId)?.getSliceIndex());
  if (slice === undefined) return <span className="ind ind--empty">—</span>;

  return (
    <SliderLine value={slice}>
      <input
        className="slider"
        type="range"
        min={0}
        value={slice}
        onChange={(event) => void stackOf(viewportId)?.setImageIdIndex(Number(event.target.value))}
      />
    </SliderLine>
  );
}
