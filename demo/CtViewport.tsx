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
}: {
  viewportId: string;
  imageIds: string[];
  showOverlay?: boolean;
  /** Sits inside the frame, the way a workstation puts its scrub bar. */
  control?: ReactNode;
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

  // Window/level, the way a workstation does it: drag across for width, down
  // for centre. Hand-rolled with setProperties rather than pulling in
  // @cornerstonejs/tools — a write here has to stay a plain Cornerstone3D call
  // (ADR 0001), and the whole page is an argument about how its effect comes
  // back. It also gives the reader a second value to move, so a log or a
  // render counter is not waiting on the slice alone.
  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return;

    let from: { x: number; y: number; width: number; centre: number } | undefined;

    const down = (event: PointerEvent) => {
      // The slider and the buttons live inside this frame; a drag on them is
      // theirs.
      if ((event.target as HTMLElement).closest('input, button, a, summary')) return;
      const voi = stackOf(viewportId)?.getProperties().voiRange;
      if (!voi) return;
      from = {
        x: event.clientX,
        y: event.clientY,
        width: voi.upper - voi.lower,
        centre: (voi.upper + voi.lower) / 2,
      };
      element.setPointerCapture(event.pointerId);
    };

    const move = (event: PointerEvent) => {
      if (!from) return;
      const viewport = stackOf(viewportId);
      if (!viewport) return;
      // 4 HU per pixel: a drag across the frame covers roughly the range a
      // chest window needs, and one pixel is still a visible step.
      const width = Math.max(1, from.width + (event.clientX - from.x) * 4);
      const centre = from.centre + (event.clientY - from.y) * 4;
      viewport.setProperties({ voiRange: { lower: centre - width / 2, upper: centre + width / 2 } });
      viewport.render();
    };

    const up = (event: PointerEvent) => {
      from = undefined;
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    };

    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
    return () => {
      element.removeEventListener('pointerdown', down);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
    };
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
      {control && <div className="vp__control">{control}</div>}
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
