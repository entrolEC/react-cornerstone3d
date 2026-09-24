import { Enums, getEnabledElementByViewportId, type Types } from '@cornerstonejs/core';
import { CornerstoneViewport, useImageLoadStates, useViewportState } from 'react-cornerstone3d';
import { useEffect, useRef } from 'react';
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
}: {
  viewportId: string;
  imageIds: string[];
  showOverlay?: boolean;
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
      {showOverlay && <div className="vp__hint">스크롤로 슬라이스 이동</div>}
      {showOverlay && <Overlay viewportId={viewportId} />}
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

/** A write path bound to read state: the slider position *is* Engine state. */
export function SliceSlider({ viewportId }: { viewportId: string }) {
  const slice = useViewportState(viewportId, (s) => s.sliceIndex);
  const total = useViewportState(viewportId, (s) => s.numberOfSlices);
  if (slice === undefined || !total) return null;

  return (
    <input
      className="slider"
      type="range"
      min={0}
      max={total - 1}
      value={slice}
      onChange={(event) => void stackOf(viewportId)?.setImageIdIndex(Number(event.target.value))}
    />
  );
}

/**
 * The load state of the whole stack, one cell per slice. `imageIds` and
 * `currentImageId` come from the viewport; whether each is in the cache comes
 * from the cache module, one Binding per image (ADR 0007). The join is the
 * app's — the library never combines the two. Drawing N cells is also the
 * app's: this one is a plain row of spans, fine for a few hundred slices.
 */
export function LoadTrack({ viewportId }: { viewportId: string }) {
  const imageIds = useViewportState(viewportId, (s) => (s.kind === 'stack' ? s.imageIds : undefined));
  const current = useViewportState(viewportId, (s) => s.currentImageId);
  const loaded = useImageLoadStates(imageIds);
  if (!imageIds || !loaded) return null;

  const count = loaded.filter(Boolean).length;
  return (
    <div className="track" aria-label="슬라이스별 로드 상태">
      <div className="track__cells">
        {imageIds.map((id, i) => (
          <span
            key={id}
            className={
              'track__cell' +
              (loaded[i] ? ' track__cell--loaded' : '') +
              (id === current ? ' track__cell--current' : '')
            }
          />
        ))}
      </div>
      <div className="track__caption">
        <code>useImageLoadStates(imageIds)</code> — 캐시에 들어온 슬라이스 {count}/{imageIds.length}
      </div>
    </div>
  );
}
