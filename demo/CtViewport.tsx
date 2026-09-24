import { Enums, getEnabledElementByViewportId, type Types } from '@cornerstonejs/core';
import { CornerstoneViewport, useViewportState } from 'react-cornerstone3d';
import { useEffect, useRef, type ReactNode } from 'react';
import { renderingEngineId } from './cornerstone';

const stackOf = (viewportId: string) =>
  getEnabledElementByViewportId(viewportId)?.viewport as Types.IStackViewport | undefined;

const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max);

/**
 * A live CT stack. Writes (scroll, slider) are plain Cornerstone3D calls —
 * the library has no write API; their effect reaches React by coming back as
 * an Engine event.
 */
export function CtViewport({
  viewportId,
  imageIds,
  showOverlay = true,
  control,
  failed,
}: {
  viewportId: string;
  imageIds: string[];
  showOverlay?: boolean;
  /** Sits inside the frame, the way a workstation puts its scrub bar. */
  control?: ReactNode;
  /** Covers the whole frame. A component that threw takes its surface with it. */
  failed?: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  // Child effects run first, so CornerstoneViewport has already enabled it.
  useEffect(() => {
    // resetCamera after the stack lands: CS3D 5 leaves the camera at the
    // pre-image scale, which renders the slice as a speck. Fitting a newly
    // loaded series to the viewport is what a real viewer does anyway.
    stackOf(viewportId)
      ?.setStack(imageIds, Math.floor(imageIds.length / 2))
      .then(() => {
        const viewport = stackOf(viewportId);
        viewport?.resetCamera();
        viewport?.render();
      })
      .catch((cause: unknown) => console.error('setStack failed', cause));
  }, [viewportId, imageIds]);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    // Not React's onWheel: that listener is passive, so it cannot stop the
    // page from scrolling along with the stack.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const viewport = stackOf(viewportId);
      if (!viewport) return;
      const next = viewport.getSliceIndex() + Math.sign(event.deltaY);
      void viewport.setImageIdIndex(clamp(next, viewport.getNumberOfSlices() - 1));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [viewportId]);

  return (
    <div className="vp" ref={wrapRef}>
      <CornerstoneViewport
        viewportId={viewportId}
        type={Enums.ViewportType.STACK}
        renderingEngineId={renderingEngineId}
        style={{ width: '100%', height: '100%' }}
      />
      {showOverlay && <Overlay viewportId={viewportId} />}
      {control && !failed && <div className="vp__control">{control}</div>}
      {failed && <div className="vp__failed">{failed}</div>}
    </div>
  );
}

function Overlay({ viewportId }: { viewportId: string }) {
  const slice = useViewportState(viewportId, (s) => s.sliceIndex);
  const total = useViewportState(viewportId, (s) => s.numberOfSlices);
  const voi = useViewportState(viewportId, (s) => s.voiRange);

  return (
    <div className="vp__overlay">
      <span>{slice === undefined ? '—' : `Im: ${slice + 1}/${total}`}</span>
      <span>
        {voi ? `W:${Math.round(voi.upper - voi.lower)} L:${Math.round((voi.upper + voi.lower) / 2)}` : ''}
      </span>
    </div>
  );
}

/** Pages through slices on a loop, so a readout can be seen following along. */
export function useAutoScroll(viewportId: string, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const viewport = stackOf(viewportId);
      if (!viewport) return;
      void viewport.setImageIdIndex((viewport.getSliceIndex() + 1) % viewport.getNumberOfSlices());
    }, 700);
    return () => clearInterval(id);
  }, [viewportId, active]);
}
